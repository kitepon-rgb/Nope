// content-search.js の純粋ロジック（productId抽出、wrapper探索、可視制御、解決キュー、
// カード走査〜可視反映のオーケストレーション）を検証する。
// 実ブラウザでのDOM注入・MutationObserver統合・実mtop解決は agent-browser による実地確認で担保する。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const SRC = path.join(import.meta.dirname, '..', 'src', 'content-search.js');

class FakeMutationObserver {
  observe() {}
  disconnect() {}
}

function makeFakeWrapper() {
  return { style: {} };
}

function makeFakeLink(href, wrapper) {
  return {
    getAttribute: () => href,
    closest: () => wrapper,
    parentElement: wrapper,
  };
}

function loadContentSearch() {
  const context = vm.createContext({
    document: { querySelectorAll: () => [], body: {} },
    MutationObserver: FakeMutationObserver,
    setTimeout: (fn) => { fn(); return 0; },
    clearTimeout: () => {},
    console,
    CB_STORAGE: { getBlockedStores: async () => ({}), getCachedStore: async () => null, onBlockedStoresChanged: () => {} },
    CB_MTOP: { resolveStoreId: async () => { throw new Error('not stubbed'); } },
  });
  vm.runInContext(readFileSync(SRC, 'utf8'), context);
  return vm.runInContext('CB_SEARCH', context);
}

test('extractProductIdは/item/<id>.htmlからproductIdを取り出す', () => {
  const search = loadContentSearch();
  assert.equal(search.extractProductId('https://ja.aliexpress.com/item/1005009468037554.html'), '1005009468037554');
  assert.equal(search.extractProductId('https://ja.aliexpress.com/item/1005009468037554.html?spm=x'), '1005009468037554');
  assert.equal(search.extractProductId('https://ja.aliexpress.com/store/123'), null);
  assert.equal(search.extractProductId(''), null);
});

test('findWrapperはclosestで.card-out-wrapperを取る、無ければparentElementにフォールバック', () => {
  const search = loadContentSearch();
  const wrapper = { tag: 'wrapper' };
  assert.equal(search.findWrapper({ closest: () => wrapper, parentElement: { tag: 'parent' } }), wrapper);
  assert.equal(search.findWrapper({ closest: () => null, parentElement: { tag: 'parent' } }).tag, 'parent');
  assert.equal(search.findWrapper({ parentElement: null }), null);
});

test('applyVisibilityはblocked=trueでdisplay:noneにし、falseで解除する', () => {
  const search = loadContentSearch();
  const wrapper = makeFakeWrapper();
  search.applyVisibility(wrapper, true);
  assert.equal(wrapper.style.display, 'none');
  search.applyVisibility(wrapper, false);
  assert.equal(wrapper.style.display, '');
});

test('applyVisibilityはwrapperがnullでも例外を出さない', () => {
  const search = loadContentSearch();
  assert.doesNotThrow(() => search.applyVisibility(null, true));
});

test('createResolveQueueは同時実行数をconcurrencyまでに制限する', async () => {
  const search = loadContentSearch();
  let activeCount = 0;
  let maxActive = 0;
  const resolvers = [];
  const resolveStoreId = (productId) => new Promise((resolve) => {
    activeCount += 1;
    maxActive = Math.max(maxActive, activeCount);
    resolvers.push(() => { activeCount -= 1; resolve(`store-${productId}`); });
  });
  const queue = search.createResolveQueue({ resolveStoreId, concurrency: 2, intervalMs: 0 });

  const results = [];
  for (const id of ['a', 'b', 'c', 'd']) {
    queue.enqueue(id, (storeId, err) => results.push({ id, storeId, err }));
  }

  // concurrency=2なので、この時点で最初の2件だけ実行中のはず。
  await new Promise((r) => setImmediate(r));
  assert.equal(maxActive, 2);
  assert.equal(resolvers.length, 2);

  // 1件resolveすると次が始まる。
  resolvers.shift()();
  await new Promise((r) => setImmediate(r));
  resolvers.shift()();
  await new Promise((r) => setImmediate(r));
  resolvers.shift()();
  await new Promise((r) => setImmediate(r));
  resolvers.shift()();
  await new Promise((r) => setImmediate(r));

  assert.equal(results.length, 4);
  assert.equal(maxActive, 2);
});

test('createResolveQueueはresolveStoreIdの失敗をonSettledのerrへ渡す', async () => {
  const search = loadContentSearch();
  const queue = search.createResolveQueue({
    resolveStoreId: async () => { throw new Error('mtop失敗'); },
    concurrency: 1,
    intervalMs: 0,
  });
  const result = await new Promise((resolve) => {
    queue.enqueue('x', (storeId, err) => resolve({ storeId, err }));
  });
  assert.equal(result.storeId, null);
  assert.match(result.err.message, /mtop失敗/);
});

test('scanはキャッシュ命中カードを即ブロック判定して非表示にする', async () => {
  const search = loadContentSearch();
  const wrapper = makeFakeWrapper();
  const link = makeFakeLink('https://ja.aliexpress.com/item/111.html', wrapper);
  const storage = {
    getBlockedStores: async () => ({ 999: { name: 'Blocked Store', addedAt: 0 } }),
    getCachedStore: async (productId) => (productId === '111' ? '999' : null),
    onBlockedStoresChanged: () => {},
  };
  const doc = { querySelectorAll: () => [link], body: {} };
  const controller = search.init({ document: doc, storage, mtop: { resolveStoreId: async () => { throw new Error('呼ばれないはず'); } } });
  await controller.start();
  await new Promise((r) => setImmediate(r));
  assert.equal(wrapper.style.display, 'none');
});

test('scanは未ブロックstoreのカードを表示のままにする', async () => {
  const search = loadContentSearch();
  const wrapper = makeFakeWrapper();
  const link = makeFakeLink('https://ja.aliexpress.com/item/222.html', wrapper);
  const storage = {
    getBlockedStores: async () => ({}),
    getCachedStore: async () => '888',
    onBlockedStoresChanged: () => {},
  };
  const doc = { querySelectorAll: () => [link], body: {} };
  const controller = search.init({ document: doc, storage, mtop: { resolveStoreId: async () => { throw new Error('呼ばれないはず'); } } });
  await controller.start();
  await new Promise((r) => setImmediate(r));
  assert.equal(wrapper.style.display, '');
});

test('scanはcache未ヒットならmtop.resolveStoreIdで解決して判定する', async () => {
  const search = loadContentSearch();
  const wrapper = makeFakeWrapper();
  const link = makeFakeLink('https://ja.aliexpress.com/item/333.html', wrapper);
  const storage = {
    getBlockedStores: async () => ({ 777: { name: 'Blocked', addedAt: 0 } }),
    getCachedStore: async () => null,
    onBlockedStoresChanged: () => {},
  };
  const mtop = { resolveStoreId: async (productId) => (productId === '333' ? '777' : null) };
  const doc = { querySelectorAll: () => [link], body: {} };
  const controller = search.init({ document: doc, storage, mtop });
  await controller.start();
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  assert.equal(wrapper.style.display, 'none');
});

test('blockedStoresの変更で既知カードへ即時再適用する', async () => {
  const search = loadContentSearch();
  const wrapper = makeFakeWrapper();
  const link = makeFakeLink('https://ja.aliexpress.com/item/444.html', wrapper);
  let changeListener = null;
  const storage = {
    getBlockedStores: async () => ({}),
    getCachedStore: async () => '555',
    onBlockedStoresChanged: (fn) => { changeListener = fn; },
  };
  const doc = { querySelectorAll: () => [link], body: {} };
  const controller = search.init({ document: doc, storage, mtop: { resolveStoreId: async () => { throw new Error('呼ばれないはず'); } } });
  await controller.start();
  await new Promise((r) => setImmediate(r));
  assert.equal(wrapper.style.display, '');

  changeListener({ 555: { name: 'X', addedAt: 0 } });
  assert.equal(wrapper.style.display, 'none');

  changeListener({});
  assert.equal(wrapper.style.display, '');
});
