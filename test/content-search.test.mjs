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

function loadContentSearch({ includeMtop = true, consoleImpl = console } = {}) {
  const globals = {
    document: Object.assign({ querySelectorAll: () => [], body: {} }, makeFakeDocument()),
    MutationObserver: FakeMutationObserver,
    setTimeout: (fn) => { fn(); return 0; },
    clearTimeout: () => {},
    console: consoleImpl,
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

test('manifestはヤフオク・AmazonのPattern C読み込み順と画像公開先を登録する', () => {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const expectedEntries = [
    {
      match: '*://auctions.yahoo.co.jp/*',
      scripts: ['src/storage.js', 'src/content-search.js', 'src/adapters/yahoo_auction.js'],
    },
    {
      match: '*://www.amazon.co.jp/*',
      scripts: ['src/storage.js', 'src/content-search.js', 'src/adapters/amazon.js'],
    },
  ];
  const accessibleMatches = manifest.web_accessible_resources.flatMap((item) => item.matches || []);

  for (const expected of expectedEntries) {
    const entry = manifest.content_scripts.find((item) => item.matches.includes(expected.match));
    assert.ok(entry, `${expected.match} のcontent_scripts entryが必要`);
    assert.deepEqual(entry.js, expected.scripts);
    assert.equal(entry.run_at, 'document_idle');
    assert.ok(accessibleMatches.includes(expected.match), `${expected.match} の画像公開先登録が必要`);
  }
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

test('async_resolve adapterはCB_MTOPなしでresolveSourceを使い結果をキャッシュする', async () => {
  const search = loadContentSearch({ includeMtop: false });
  const wrapper = makeFakeWrapper();
  const card = { id: 'auction-card' };
  const cached = [];
  const storage = {
    getBlockedSources: async () => ({ seller123: { name: '対象出品者', addedAt: 0 } }),
    getCachedSource: async () => null,
    setCachedSource: async (...args) => { cached.push(args); },
    onBlockedSourcesChanged: () => {},
    getDisplayMode: async () => 'collapse',
    onDisplayModeChanged: () => {},
    removeBlockedSource: async () => {},
  };
  const adapter = {
    siteKey: 'yahoo_auctions',
    cardSelector: 'li.Product',
    getWrapper: () => wrapper,
    resolver: {
      type: 'async_resolve',
      getItemId: () => 'auction123',
      resolveSource: async () => ({ sourceId: 'seller123', sourceName: '対象出品者' }),
    },
  };
  const doc = { querySelectorAll: () => [card], body: {} };

  const controller = search.init({ document: doc, storage, adapter });
  await controller.start();
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(wrapper.style.display, 'none');
  assert.deepEqual(cached, [['yahoo_auctions', 'auction123', 'seller123']]);
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

function makeAsyncStorage(cachedWrites = []) {
  return {
    getBlockedSources: async () => ({}),
    getCachedSource: async () => null,
    setCachedSource: async (...args) => { cachedWrites.push(args); },
    onBlockedSourcesChanged: () => {},
    getDisplayMode: async () => 'collapse',
    onDisplayModeChanged: () => {},
    removeBlockedSource: async () => {},
  };
}

async function flushQueue() {
  for (let i = 0; i < 12; i += 1) await new Promise((resolve) => setImmediate(resolve));
}

test('async_resolveのnullは正常なsource不在として個別warnせず、全件なら集約warnを1回出す', async () => {
  const warnings = [];
  const search = loadContentSearch({
    includeMtop: false,
    consoleImpl: { ...console, warn: (...args) => warnings.push(args) },
  });
  const cards = Array.from({ length: 5 }, (_, index) => Object.assign(makeFakeWrapper(), { id: `item-${index}` }));
  const adapter = {
    siteKey: 'amazon',
    cardSelector: '.card',
    getWrapper: (card) => card,
    resolver: {
      type: 'async_resolve',
      getItemId: (card) => card.id,
      resolveSource: async () => null,
      noSourceWarning: { minAttempts: 5, message: 'amazon aggregate warning' },
    },
  };

  await search.init({ document: { querySelectorAll: () => cards, body: {} }, storage: makeAsyncStorage(), adapter }).start();
  await flushQueue();

  assert.equal(warnings.length, 1);
  assert.match(String(warnings[0][0]), /amazon aggregate warning/);
  assert.doesNotMatch(String(warnings[0][0]), /itemId=/);
});

test('async_resolveは1件でもsource解決に成功すればseller不在の集約warnを出さない', async () => {
  const warnings = [];
  const cachedWrites = [];
  const search = loadContentSearch({
    includeMtop: false,
    consoleImpl: { ...console, warn: (...args) => warnings.push(args) },
  });
  const cards = Array.from({ length: 5 }, (_, index) => Object.assign(makeFakeWrapper(), { id: `item-${index}` }));
  const adapter = {
    siteKey: 'amazon',
    cardSelector: '.card',
    getWrapper: (card) => card,
    resolver: {
      type: 'async_resolve',
      getItemId: (card) => card.id,
      resolveSource: async (itemId) => itemId === 'item-4'
        ? { sourceId: 'seller-1', sourceName: '販売者' }
        : null,
      noSourceWarning: { minAttempts: 5, message: '出てはいけない' },
    },
  };

  await search.init({ document: { querySelectorAll: () => cards, body: {} }, storage: makeAsyncStorage(cachedWrites), adapter }).start();
  await flushQueue();

  assert.equal(warnings.length, 0);
  assert.deepEqual(cachedWrites, [['amazon', 'item-4', 'seller-1']]);
});

test('async_resolveの本物の失敗はseller不在へ丸めず従来どおり個別warnする', async () => {
  const warnings = [];
  const search = loadContentSearch({
    includeMtop: false,
    consoleImpl: { ...console, warn: (...args) => warnings.push(args) },
  });
  const card = Object.assign(makeFakeWrapper(), { id: 'broken-item' });
  const adapter = {
    siteKey: 'amazon',
    cardSelector: '.card',
    getWrapper: (value) => value,
    resolver: {
      type: 'async_resolve',
      getItemId: (value) => value.id,
      resolveSource: async () => { throw new Error('HTTP構造エラー'); },
      noSourceWarning: { minAttempts: 1, message: '出てはいけない' },
    },
  };

  await search.init({ document: { querySelectorAll: () => [card], body: {} }, storage: makeAsyncStorage(), adapter }).start();
  await flushQueue();

  assert.equal(warnings.length, 1);
  assert.match(String(warnings[0][0]), /sourceId解決に失敗/);
  assert.match(warnings[0][1].message, /HTTP構造エラー/);
});

test('dom_id登録UIはadapterの発信元種別を表示し、clickしたIDと名称だけを保存・即時ブロック・解除する', async () => {
  const search = loadContentSearch({ includeMtop: false });
  const wrapper = makeFakeWrapper();
  const originalChild = makeFakeElement('a');
  wrapper.appendChild(originalChild);
  const card = { id: 'rakuten-card-1' };
  let blocked = {};
  const registered = [];
  const removed = [];
  const storage = {
    getBlockedSources: async () => blocked,
    onBlockedSourcesChanged: () => {},
    getDisplayMode: async () => 'placeholder',
    onDisplayModeChanged: () => {},
    addBlockedSource: async (siteKey, sourceId, sourceName) => {
      registered.push([siteKey, sourceId, sourceName]);
      blocked = { [sourceId]: { name: sourceName, addedAt: 1 } };
    },
    removeBlockedSource: async (siteKey, sourceId) => {
      removed.push([siteKey, sourceId]);
      blocked = {};
    },
  };
  const adapter = {
    siteKey: 'rakuten',
    cardSelector: '.dui-card',
    getWrapper: () => wrapper,
    resolver: {
      type: 'dom_id',
      getSource: () => ({ sourceId: 'shop123', sourceName: '対象店舗' }),
      register: { entityLabel: 'ショップ' },
    },
  };
  const doc = Object.assign({ querySelectorAll: () => [card], body: {} }, makeFakeDocument());

  const controller = search.init({ document: doc, storage, adapter });
  await controller.start();

  const button = wrapper.children.find((child) => child.className === 'cb-search-register-button');
  assert.ok(button, '登録ボタンがカードへ生成されていない');
  assert.equal(button.textContent, '🚫 このショップをブロック');

  let prevented = false;
  let stopped = false;
  await button.listeners.click({
    preventDefault() { prevented = true; },
    stopPropagation() { stopped = true; },
  });

  assert.equal(prevented, true);
  assert.equal(stopped, true);
  assert.deepEqual(registered, [['rakuten', 'shop123', '対象店舗']]);
  assert.ok(wrapper.querySelector('.cb-blocked-placeholder'), 'click直後にplaceholderへ切り替わっていない');

  const placeholder = wrapper.querySelector('.cb-blocked-placeholder');
  const unblock = placeholder.children.find((child) => child.className === 'cb-unblock-button');
  await unblock.listeners.click({ preventDefault() {}, stopPropagation() {} });

  assert.deepEqual(removed, [['rakuten', 'shop123']]);
  assert.equal(wrapper.querySelector('.cb-blocked-placeholder'), null);
  assert.equal(originalChild.style.display, '');
});

test('async_resolve登録UIは発信元不在nullのAmazon直販カードへボタンを出さない', async () => {
  const search = loadContentSearch({ includeMtop: false });
  const wrapper = makeFakeWrapper();
  const card = { id: 'amazon-direct-card' };
  const storage = {
    getBlockedSources: async () => ({}),
    getCachedSource: async () => null,
    setCachedSource: async () => {},
    onBlockedSourcesChanged: () => {},
    getDisplayMode: async () => 'placeholder',
    onDisplayModeChanged: () => {},
    addBlockedSource: async () => { throw new Error('呼ばれないはず'); },
    removeBlockedSource: async () => {},
  };
  const adapter = {
    siteKey: 'amazon',
    cardSelector: 'div[data-component-type="s-search-result"]',
    getWrapper: () => wrapper,
    resolver: {
      type: 'async_resolve',
      getItemId: () => 'B0DIRECT',
      resolveSource: async () => null,
      register: { entityLabel: '出品者' },
    },
  };
  const doc = Object.assign({ querySelectorAll: () => [card], body: {} }, makeFakeDocument());

  const controller = search.init({ document: doc, storage, adapter });
  await controller.start();
  await flushQueue();

  assert.equal(
    wrapper.children.some((child) => child.className === 'cb-search-register-button'),
    false,
  );
});
