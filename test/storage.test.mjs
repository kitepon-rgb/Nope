// storage.js の focused test。chrome.storage を最小 mock して契約（設計メモ）を検証する。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const SRC = path.join(import.meta.dirname, '..', 'src', 'storage.js');

function chromeMock() {
  const areas = { sync: {}, local: {} };
  const listeners = [];
  const makeArea = (name) => ({
    async get(defaults) {
      const out = {};
      for (const key of Object.keys(defaults)) {
        out[key] = key in areas[name] ? areas[name][key] : defaults[key];
      }
      return out;
    },
    async set(values) {
      Object.assign(areas[name], values);
      if (name === 'sync' && values.blockedStores) {
        const changes = { blockedStores: { newValue: values.blockedStores } };
        for (const listener of listeners) listener(changes, 'sync');
      }
    },
    async remove(key) { delete areas[name][key]; },
  });
  return {
    areas,
    listeners,
    chrome: {
      storage: {
        sync: makeArea('sync'),
        local: makeArea('local'),
        onChanged: {
          addListener(fn) { listeners.push(fn); },
          removeListener(fn) { listeners.splice(listeners.indexOf(fn), 1); },
        },
      },
    },
  };
}

function loadStorage(mock) {
  const context = vm.createContext({ chrome: mock.chrome, Date });
  vm.runInContext(readFileSync(SRC, 'utf8'), context);
  // const宣言はcontextのglobalに載らないため、context内で評価して取り出す。
  return vm.runInContext('CB_STORAGE', context);
}

test('blocklistはsyncへ{storeId:{name,addedAt}}で保存し追加・削除できる', async () => {
  const mock = chromeMock();
  const storage = loadStorage(mock);
  await storage.addBlockedStore('12345', 'Store A');
  const stored = mock.areas.sync.blockedStores;
  assert.equal(stored['12345'].name, 'Store A');
  assert.equal(typeof stored['12345'].addedAt, 'number');
  await storage.removeBlockedStore('12345');
  // vm realm越しのobjectはprototypeが異なりdeepStrictEqualが使えないため、キーで比較する。
  assert.deepEqual(Object.keys(await storage.getBlockedStores()), []);
});

test('数値でないstoreIdは拒否する', async () => {
  const storage = loadStorage(chromeMock());
  await assert.rejects(() => storage.addBlockedStore('abc', 'x'), /storeId/u);
});

test('cacheはlocalへ保存し上限5000超過で挿入順の古いものから削る', async () => {
  const mock = chromeMock();
  const storage = loadStorage(mock);
  for (let index = 0; index < 5001; index += 1) {
    await storage.setCachedStore(`p${index}`, `s${index}`);
  }
  const cache = mock.areas.local.productStoreCache;
  assert.equal(Object.keys(cache).length, 5000);
  assert.equal(await storage.getCachedStore('p0'), null);
  assert.equal(await storage.getCachedStore('p5000'), 's5000');
  await storage.clearCache();
  assert.equal(await storage.getCachedStore('p5000'), null);
});

test('onBlockedStoresChangedはsync変更で発火し解除関数で止まる', async () => {
  const mock = chromeMock();
  const storage = loadStorage(mock);
  const seen = [];
  const unsubscribe = storage.onBlockedStoresChanged((value) => seen.push(value));
  await storage.addBlockedStore('7', 'S');
  assert.equal(seen.length, 1);
  assert.equal(seen[0]['7'].name, 'S');
  unsubscribe();
  await storage.addBlockedStore('8', 'T');
  assert.equal(seen.length, 1);
});
