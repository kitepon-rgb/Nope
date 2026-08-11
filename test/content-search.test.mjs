// content-search.js の純粋ロジック（productId抽出、wrapper探索、可視制御、解決キュー、
// カード走査〜可視反映のオーケストレーション）を検証する。
// 実ブラウザでのDOM注入・MutationObserver統合・実mtop解決は agent-browser による実地確認で担保する。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const SRC = path.join(import.meta.dirname, '..', 'src', 'content-search.js');
const ALIEXPRESS_INIT_SRC = path.join(import.meta.dirname, '..', 'src', 'content-aliexpress-init.js');
const MANIFEST = path.join(import.meta.dirname, '..', 'manifest.json');

class FakeMutationObserver {
  observe() {}
  disconnect() {}
}

// applyVisibility の placeholder モードが document.createElement / wrapper.appendChild /
// wrapper.querySelector / 子要素の style.display を操作するための最小 fake DOM。
// 実DOMに合わせ、style.display の初期値は ''（未設定なら空文字）、remove() は親の children から実際に取り除く。
function makeFakeElement(tagName) {
  const el = {
    tagName,
    className: '',
    style: { display: '' },
    textContent: '',
    innerHTML: '',
    children: [],
    parent: null,
    listeners: {},
    appendChild(child) { child.parent = el; el.children.push(child); return child; },
    addEventListener(type, fn) { el.listeners[type] = fn; },
    remove() {
      if (el.parent) {
        el.parent.children = el.parent.children.filter((c) => c !== el);
        el.parent = null;
      }
    },
    querySelector(selector) {
      const match = /\.([\w-]+)/.exec(selector);
      const cls = match ? match[1] : selector;
      return el.children.find((c) => c.className === cls) || null;
    },
  };
  return el;
}

function makeFakeDocument() {
  return { createElement: (tag) => makeFakeElement(tag) };
}

function makeFakeWrapper() {
  const wrapper = makeFakeElement('div');
  return wrapper;
}

function makeFakeLink(href, wrapper) {
  return {
    getAttribute: () => href,
    closest: () => wrapper,
    parentElement: wrapper,
  };
}

function loadContentSearch({ includeMtop = true } = {}) {
  const globals = {
    document: Object.assign({ querySelectorAll: () => [], body: {} }, makeFakeDocument()),
    MutationObserver: FakeMutationObserver,
    setTimeout: (fn) => { fn(); return 0; },
    clearTimeout: () => {},
    console,
    chrome: { runtime: { getURL: (path) => `chrome-extension://test-id/${path}` } },
    CB_STORAGE: {
      getBlockedSources: async () => ({}),
      getCachedSource: async () => null,
      onBlockedSourcesChanged: () => {},
      getDisplayMode: async () => 'placeholder',
      onDisplayModeChanged: () => {},
    },
  };
  if (includeMtop) {
    globals.CB_MTOP = { resolveStoreId: async () => { throw new Error('not stubbed'); } };
  }
  const context = vm.createContext(globals);
  vm.runInContext(readFileSync(SRC, 'utf8'), context);
  return vm.runInContext('CB_SEARCH', context);
}

test('content-search.jsは共通エンジンの読み込みだけでは自動起動しない', () => {
  let blockedSourcesReads = 0;
  const context = vm.createContext({
    document: Object.assign({ querySelectorAll: () => [], body: {} }, makeFakeDocument()),
    MutationObserver: FakeMutationObserver,
    setTimeout: (fn) => { fn(); return 0; },
    clearTimeout: () => {},
    console,
    chrome: { runtime: { getURL: (assetPath) => `chrome-extension://test-id/${assetPath}` } },
    CB_STORAGE: {
      getBlockedSources: async () => { blockedSourcesReads += 1; return {}; },
      getCachedSource: async () => null,
      onBlockedSourcesChanged: () => {},
      getDisplayMode: async () => 'placeholder',
      onDisplayModeChanged: () => {},
    },
    CB_MTOP: { resolveStoreId: async () => null },
  });

  vm.runInContext(readFileSync(SRC, 'utf8'), context);

  assert.equal(blockedSourcesReads, 0);
  assert.equal(vm.runInContext('typeof CB_SEARCH', context), 'object');
});

test('AliExpress専用entryは既定adapterを一度だけ起動する', () => {
  let initCalls = 0;
  let startCalls = 0;
  const context = vm.createContext({
    CB_SEARCH: {
      init(options) {
        initCalls += 1;
        assert.equal(options, undefined);
        return { start() { startCalls += 1; } };
      },
    },
  });

  vm.runInContext(readFileSync(ALIEXPRESS_INIT_SRC, 'utf8'), context);

  assert.equal(initCalls, 1);
  assert.equal(startCalls, 1);
});

test('manifestはAliExpress専用entryをcontent-search.jsの後に読み込む', () => {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const entry = manifest.content_scripts.find((item) => item.js.includes('src/content-search.js'));

  assert.ok(entry);
  assert.deepEqual(
    entry.js.slice(-2),
    ['src/content-search.js', 'src/content-aliexpress-init.js'],
  );
});

test('extractProductIdは/item/<id>.htmlからproductIdを取り出す', () => {
  const search = loadContentSearch();
  assert.equal(search.extractProductId('https://ja.aliexpress.com/item/1005009468037554.html'), '1005009468037554');
  assert.equal(search.extractProductId('https://ja.aliexpress.com/item/1005009468037554.html?spm=x'), '1005009468037554');
  assert.equal(search.extractProductId('https://ja.aliexpress.com/store/123'), null);
  assert.equal(search.extractProductId(''), null);
});

test('findWrapperは[class*="search-item-card-wrapper"]を最優先で使う', () => {
  const search = loadContentSearch();
  const searchCardWrapper = { tag: 'search-card' };
  const cardOutWrapper = { tag: 'card-out' };
  const link = {
    closest: (selector) => {
      if (selector.includes('search-item-card-wrapper')) return searchCardWrapper;
      if (selector === '.card-out-wrapper') return cardOutWrapper;
      return null;
    },
    parentElement: { tag: 'parent' },
  };
  assert.equal(search.findWrapper(link), searchCardWrapper);
});

test('findWrapperはsearch-item-card-wrapperが無ければ.card-out-wrapperへフォールバックする', () => {
  const search = loadContentSearch();
  const cardOutWrapper = { tag: 'card-out' };
  const link = {
    closest: (selector) => (selector === '.card-out-wrapper' ? cardOutWrapper : null),
    parentElement: { tag: 'parent' },
  };
  assert.equal(search.findWrapper(link), cardOutWrapper);
});

test('findWrapperはclosestが両方とも無ければparentElementへフォールバックする', () => {
  const search = loadContentSearch();
  const link = { closest: () => null, parentElement: { tag: 'parent' } };
  assert.equal(search.findWrapper(link).tag, 'parent');
});

test('findWrapperはclosestもparentElementも無ければnullを返す', () => {
  const search = loadContentSearch();
  assert.equal(search.findWrapper({ parentElement: null }), null);
});

test('applyVisibilityはcollapseモードでblocked=trueならdisplay:noneにしfalseで解除する', () => {
  const search = loadContentSearch();
  const wrapper = makeFakeWrapper();
  search.applyVisibility(wrapper, true, { mode: 'collapse' });
  assert.equal(wrapper.style.display, 'none');
  search.applyVisibility(wrapper, false, { mode: 'collapse' });
  assert.equal(wrapper.style.display, '');
});

test('applyVisibilityはmode省略時は既定のplaceholderモードで動作する', () => {
  const search = loadContentSearch();
  const wrapper = makeFakeWrapper();
  search.applyVisibility(wrapper, true);
  assert.equal(wrapper.style.display, '');
  assert.ok(wrapper.children.some((c) => c.className === 'cb-blocked-placeholder'));
});

test('applyVisibilityはwrapperがnullでも例外を出さない', () => {
  const search = loadContentSearch();
  assert.doesNotThrow(() => search.applyVisibility(null, true, { mode: 'collapse' }));
  assert.doesNotThrow(() => search.applyVisibility(null, true, { mode: 'placeholder' }));
});

test('applyVisibilityのplaceholderモードはwrapperを表示のままプレースホルダーを挿入する', () => {
  const search = loadContentSearch();
  const wrapper = makeFakeWrapper();
  search.applyVisibility(wrapper, true, { mode: 'placeholder', storeName: 'Evil Store' });
  assert.equal(wrapper.style.display, '');
  const placeholder = wrapper.children.find((c) => c.className === 'cb-blocked-placeholder');
  assert.ok(placeholder);
});

test('applyVisibilityのplaceholderはストア名をtextContentで入れる(innerHTMLに混ぜない)', () => {
  const search = loadContentSearch();
  const wrapper = makeFakeWrapper();
  const dangerous = '<script>alert(1)</script>';
  search.applyVisibility(wrapper, true, { mode: 'placeholder', storeName: dangerous });
  const placeholder = wrapper.children.find((c) => c.className === 'cb-blocked-placeholder');
  const nameEl = placeholder.children.find((c) => c.textContent === dangerous);
  assert.ok(nameEl);
  assert.ok(!placeholder.innerHTML.includes(dangerous));
});

test('applyVisibilityのplaceholderは二重挿入しない', () => {
  const search = loadContentSearch();
  const wrapper = makeFakeWrapper();
  search.applyVisibility(wrapper, true, { mode: 'placeholder' });
  search.applyVisibility(wrapper, true, { mode: 'placeholder' });
  const placeholders = wrapper.children.filter((c) => c.className === 'cb-blocked-placeholder');
  assert.equal(placeholders.length, 1);
});

test('applyVisibilityのplaceholderはblocked=falseで元の子要素を復元しプレースホルダーを取り除く', () => {
  const search = loadContentSearch();
  const wrapper = makeFakeWrapper();
  const originalChild = makeFakeElement('div');
  wrapper.children.push(originalChild);
  search.applyVisibility(wrapper, true, { mode: 'placeholder' });
  assert.equal(originalChild.style.display, 'none');
  search.applyVisibility(wrapper, false, { mode: 'placeholder' });
  assert.equal(originalChild.style.display, '');
  assert.equal(wrapper.children.some((c) => c.className === 'cb-blocked-placeholder'), false);
});

test('applyVisibilityのplaceholderの解除ボタンはonUnblockを呼びpreventDefault/stopPropagationする', () => {
  const search = loadContentSearch();
  const wrapper = makeFakeWrapper();
  let called = false;
  search.applyVisibility(wrapper, true, { mode: 'placeholder', onUnblock: () => { called = true; } });
  const placeholder = wrapper.children.find((c) => c.className === 'cb-blocked-placeholder');
  const button = placeholder.children.find((c) => c.textContent === 'ブロック解除');
  assert.ok(button);
  let prevented = false;
  let stopped = false;
  button.listeners.click({ preventDefault: () => { prevented = true; }, stopPropagation: () => { stopped = true; } });
  assert.ok(called);
  assert.ok(prevented);
  assert.ok(stopped);
});

test('applyVisibilityはcollapseモードへ切替時にplaceholderが残っていれば取り除いて復元する', () => {
  const search = loadContentSearch();
  const wrapper = makeFakeWrapper();
  const originalChild = makeFakeElement('div');
  wrapper.children.push(originalChild);
  search.applyVisibility(wrapper, true, { mode: 'placeholder' });
  assert.ok(wrapper.children.some((c) => c.className === 'cb-blocked-placeholder'));
  search.applyVisibility(wrapper, true, { mode: 'collapse' });
  assert.equal(wrapper.style.display, 'none');
  assert.equal(wrapper.children.some((c) => c.className === 'cb-blocked-placeholder'), false);
  assert.equal(originalChild.style.display, '');
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
    getBlockedSources: async () => ({ 999: { name: 'Blocked Store', addedAt: 0 } }),
    getCachedSource: async (_siteKey, productId) => (productId === '111' ? '999' : null),
    onBlockedSourcesChanged: () => {},
    getDisplayMode: async () => 'collapse',
    onDisplayModeChanged: () => {},
  };
  const doc = { querySelectorAll: () => [link], body: {} };
  const controller = search.init({ document: doc, storage, mtop: { resolveStoreId: async () => { throw new Error('呼ばれないはず'); } } });
  await controller.start();
  await new Promise((r) => setImmediate(r));
  assert.equal(wrapper.style.display, 'none');
});

test('dom_id adapterはCB_MTOPなしでgetSourceの結果をブロック判定する', async () => {
  const search = loadContentSearch({ includeMtop: false });
  const wrapper = makeFakeWrapper();
  const card = { id: 'card-1' };
  let changeListener = null;
  const storage = {
    getBlockedSources: async () => ({ shop123: { name: '対象店舗', addedAt: 0 } }),
    onBlockedSourcesChanged: (_siteKey, fn) => { changeListener = fn; },
    getDisplayMode: async () => 'collapse',
    onDisplayModeChanged: () => {},
    removeBlockedSource: async () => {},
  };
  const adapter = {
    siteKey: 'rakuten',
    cardSelector: '.card',
    getWrapper: () => wrapper,
    resolver: {
      type: 'dom_id',
      getSource: () => ({ sourceId: 'shop123', sourceName: '対象店舗' }),
    },
  };
  const doc = { querySelectorAll: () => [card], body: {} };

  const controller = search.init({ document: doc, storage, adapter });
  await controller.start();

  assert.equal(wrapper.style.display, 'none');
  changeListener({});
  assert.equal(wrapper.style.display, '');
});

test('scanは未ブロックstoreのカードを表示のままにする', async () => {
  const search = loadContentSearch();
  const wrapper = makeFakeWrapper();
  const link = makeFakeLink('https://ja.aliexpress.com/item/222.html', wrapper);
  const storage = {
    getBlockedSources: async () => ({}),
    getCachedSource: async () => '888',
    onBlockedSourcesChanged: () => {},
    getDisplayMode: async () => 'collapse',
    onDisplayModeChanged: () => {},
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
    getBlockedSources: async () => ({ 777: { name: 'Blocked', addedAt: 0 } }),
    getCachedSource: async () => null,
    onBlockedSourcesChanged: () => {},
    getDisplayMode: async () => 'collapse',
    onDisplayModeChanged: () => {},
  };
  const mtop = { resolveStoreId: async (productId) => (productId === '333' ? '777' : null) };
  const doc = { querySelectorAll: () => [link], body: {} };
  const controller = search.init({ document: doc, storage, mtop });
  await controller.start();
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  assert.equal(wrapper.style.display, 'none');
});

test('blockedSourcesの変更で既知カードへ即時再適用する', async () => {
  const search = loadContentSearch();
  const wrapper = makeFakeWrapper();
  const link = makeFakeLink('https://ja.aliexpress.com/item/444.html', wrapper);
  let changeListener = null;
  const storage = {
    getBlockedSources: async () => ({}),
    getCachedSource: async () => '555',
    onBlockedSourcesChanged: (_siteKey, fn) => { changeListener = fn; },
    getDisplayMode: async () => 'collapse',
    onDisplayModeChanged: () => {},
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

test('displayModeの変更で既知カードへ即時再適用する（collapse→placeholder）', async () => {
  const search = loadContentSearch();
  const wrapper = makeFakeWrapper();
  const link = makeFakeLink('https://ja.aliexpress.com/item/666.html', wrapper);
  let modeListener = null;
  const storage = {
    getBlockedSources: async () => ({ 555: { name: 'X', addedAt: 0 } }),
    getCachedSource: async () => '555',
    onBlockedSourcesChanged: () => {},
    getDisplayMode: async () => 'collapse',
    onDisplayModeChanged: (fn) => { modeListener = fn; },
    removeBlockedSource: async () => {},
  };
  const doc = { querySelectorAll: () => [link], body: {} };
  const controller = search.init({ document: doc, storage, mtop: { resolveStoreId: async () => { throw new Error('呼ばれないはず'); } } });
  await controller.start();
  await new Promise((r) => setImmediate(r));
  assert.equal(wrapper.style.display, 'none');
  assert.equal(wrapper.children.some((c) => c.className === 'cb-blocked-placeholder'), false);

  modeListener('placeholder');
  assert.equal(wrapper.style.display, '');
  assert.ok(wrapper.children.some((c) => c.className === 'cb-blocked-placeholder'));
});
