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
      if (name === 'sync') {
        const changes = {};
        for (const key of Object.keys(values)) changes[key] = { oldValue: areas[name][key], newValue: values[key] };
        Object.assign(areas[name], values);
        if (Object.keys(changes).length) {
          for (const listener of listeners) listener(changes, 'sync');
        }
      } else {
        Object.assign(areas[name], values);
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

test('blocklistはsyncへblockedSources[siteKey][sourceId]で保存し追加・削除できる', async () => {
  const mock = chromeMock();
  const storage = loadStorage(mock);
  await storage.addBlockedSource('aliexpress', '12345', 'Store A');
  const stored = mock.areas.sync.blockedSources;
  assert.equal(stored.aliexpress['12345'].name, 'Store A');
  assert.equal(typeof stored.aliexpress['12345'].addedAt, 'number');
  await storage.removeBlockedSource('aliexpress', '12345');
  // vm realm越しのobjectはprototypeが異なりdeepStrictEqualが使えないため、キーで比較する。
  assert.deepEqual(Object.keys(await storage.getBlockedSources('aliexpress')), []);
});

test('sourceIdは文字列制限なし（storeId数値制限は廃止）', async () => {
  const mock = chromeMock();
  const storage = loadStorage(mock);
  await storage.addBlockedSource('youtube', '@MagicClub686', 'Magic Club');
  assert.equal((await storage.getBlockedSources('youtube'))['@MagicClub686'].name, 'Magic Club');
});

test('nameOnly:trueエントリを保存できる', async () => {
  const mock = chromeMock();
  const storage = loadStorage(mock);
  await storage.addBlockedSource('yahoo_news', '西スポWEB OTTO!', '西スポWEB OTTO!', true);
  const entry = (await storage.getBlockedSources('yahoo_news'))['西スポWEB OTTO!'];
  assert.equal(entry.nameOnly, true);
});

test('siteKeyを分けてblocklistを管理できる', async () => {
  const mock = chromeMock();
  const storage = loadStorage(mock);
  await storage.addBlockedSource('aliexpress', '111', 'AliStore');
  await storage.addBlockedSource('rakuten', 'shopA', '楽天店A');
  assert.deepEqual(Object.keys(await storage.getBlockedSources('aliexpress')), ['111']);
  assert.deepEqual(Object.keys(await storage.getBlockedSources('rakuten')), ['shopA']);
  assert.deepEqual(Object.keys(await storage.getBlockedSources('amazon')), []);
});

test('cacheはlocalへ{siteKey}:{itemId}で保存し上限5000超過で挿入順の古いものから削る', async () => {
  const mock = chromeMock();
  const storage = loadStorage(mock);
  for (let index = 0; index < 5001; index += 1) {
    await storage.setCachedSource('aliexpress', `p${index}`, `s${index}`);
  }
  const cache = mock.areas.local.itemSourceCache;
  assert.equal(Object.keys(cache).length, 5000);
  assert.equal(await storage.getCachedSource('aliexpress', 'p0'), null);
  assert.equal(await storage.getCachedSource('aliexpress', 'p5000'), 's5000');
  await storage.clearCache();
  assert.equal(await storage.getCachedSource('aliexpress', 'p5000'), null);
});

test('getCachedSourceはsiteKeyが異なるキーを区別する', async () => {
  const mock = chromeMock();
  const storage = loadStorage(mock);
  await storage.setCachedSource('aliexpress', 'item1', 'store1');
  await storage.setCachedSource('amazon', 'item1', 'seller1');
  assert.equal(await storage.getCachedSource('aliexpress', 'item1'), 'store1');
  assert.equal(await storage.getCachedSource('amazon', 'item1'), 'seller1');
});

test('onBlockedSourcesChangedはsync変更で発火し解除関数で止まる', async () => {
  const mock = chromeMock();
  const storage = loadStorage(mock);
  const seen = [];
  const unsubscribe = storage.onBlockedSourcesChanged('aliexpress', (value) => seen.push(value));
  await storage.addBlockedSource('aliexpress', '7', 'S');
  assert.equal(seen.length, 1);
  assert.equal(seen[0]['7'].name, 'S');
  unsubscribe();
  await storage.addBlockedSource('aliexpress', '8', 'T');
  assert.equal(seen.length, 1);
});

test('onBlockedSourcesChangedは対象siteKey以外の変更では発火しない', async () => {
  const mock = chromeMock();
  const storage = loadStorage(mock);
  const seen = [];
  storage.onBlockedSourcesChanged('aliexpress', (value) => seen.push(value));
  await storage.addBlockedSource('rakuten', 'shopA', '楽天店A');
  assert.equal(seen.length, 0);
});

test('getDisplayModeは未設定時に既定値placeholderを返す', async () => {
  const storage = loadStorage(chromeMock());
  assert.equal(await storage.getDisplayMode(), 'placeholder');
});

test('setDisplayModeで保存した値をgetDisplayModeが返す', async () => {
  const mock = chromeMock();
  const storage = loadStorage(mock);
  await storage.setDisplayMode('collapse');
  assert.equal(mock.areas.sync.displayMode, 'collapse');
  assert.equal(await storage.getDisplayMode(), 'collapse');
});

test('displayModeに不明値を渡すと既定値へフォールバックする', async () => {
  const mock = chromeMock();
  const storage = loadStorage(mock);
  await storage.setDisplayMode('bogus-mode');
  assert.equal(mock.areas.sync.displayMode, 'placeholder');
  assert.equal(await storage.getDisplayMode(), 'placeholder');
});

test('onDisplayModeChangedはsync変更で発火し解除関数で止まる', async () => {
  const mock = chromeMock();
  const storage = loadStorage(mock);
  const seen = [];
  const unsubscribe = storage.onDisplayModeChanged((value) => seen.push(value));
  await storage.setDisplayMode('collapse');
  assert.equal(seen.length, 1);
  assert.equal(seen[0], 'collapse');
  unsubscribe();
  await storage.setDisplayMode('placeholder');
  assert.equal(seen.length, 1);
});
