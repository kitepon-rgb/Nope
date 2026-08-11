// YouTube 推薦面（ホーム・検索）の UI 契約を検証する受入テスト（yt-contract-tests）。
// 根拠: docs/design-youtube-surfaces.md。実装（yt-home-search・yt-watch-retire）より先に書く、
// 現時点では red のテスト。実DOMから縮約したセレクタ・構造は docs/survey/youtube-home-search.md の実測値を使う。
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const CONTENT_SEARCH_SRC = path.join(import.meta.dirname, '..', 'src', 'content-search.js');
const MANIFEST = path.join(import.meta.dirname, '..', 'manifest.json');
const YOUTUBE_WATCH_ADAPTER_PATH = path.join(import.meta.dirname, '..', 'src', 'adapters', 'youtube_watch.js');

class FakeMutationObserver {
  observe() {}
  disconnect() {}
}

function makeFakeElement(tagName) {
  const el = {
    tagName,
    className: '',
    style: { display: '', height: '', boxSizing: '', overflow: '', position: '' },
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

// docs/survey/youtube-home-search.md の実測: カードは div#dismissible(position:relative) を
// 操作UIのアンカーに使える。#dismissible を子に持つ ytd-video-renderer 相当の wrapper を作る。
function makeFakeYoutubeCardWrapper(measuredHeight) {
  const wrapper = makeFakeElement('ytd-video-renderer');
  const dismissible = makeFakeElement('div');
  dismissible.className = 'dismissible';
  dismissible.getAttribute = (name) => (name === 'id' ? 'dismissible' : null);
  wrapper.appendChild(dismissible);
  wrapper.querySelector = (selector) => {
    if (selector === '#dismissible') return dismissible;
    const match = /\.([\w-]+)/.exec(selector);
    const cls = match ? match[1] : selector;
    return wrapper.children.find((c) => c.className === cls) || null;
  };
  wrapper.getBoundingClientRect = () => ({ height: measuredHeight });
  return wrapper;
}

function loadContentSearch({ consoleImpl = console } = {}) {
  const globals = {
    document: { querySelectorAll: () => [], body: {}, createElement: (tag) => makeFakeElement(tag) },
    MutationObserver: FakeMutationObserver,
    setTimeout: (fn) => { fn(); return 0; },
    clearTimeout: () => {},
    console: consoleImpl,
    chrome: { runtime: { getURL: (p) => `chrome-extension://test-id/${p}` } },
    CB_STORAGE: {
      getBlockedSources: async () => ({}),
      getCachedSource: async () => null,
      onBlockedSourcesChanged: () => {},
      getDisplayMode: async () => 'placeholder',
      onDisplayModeChanged: () => {},
    },
  };
  const context = vm.createContext(globals);
  vm.runInContext(readFileSync(CONTENT_SEARCH_SRC, 'utf8'), context);
  return vm.runInContext('CB_SEARCH', context);
}

// docs/design-youtube-surfaces.md §3-2 で確定した契約: dom_id resolver への
// register.anchorSelector オプトインで、未ブロックカードへトグルボタンを注入する。
const YOUTUBE_LIKE_ADAPTER = {
  siteKey: 'youtube',
  cardSelector: 'ytd-video-renderer',
  getWrapper: (card) => card,
  resolver: {
    type: 'dom_id',
    getSource: (card) => ({ sourceId: '@MagicClub686', sourceName: 'Magic Club' }),
    register: { anchorSelector: '#dismissible' },
  },
};

test('【yt-contract-tests/red】CB_SEARCHは未ブロックカードへhover/focusで現れる登録ボタンを注入する（plan成功条件1）', async () => {
  const search = loadContentSearch();
  const card = makeFakeYoutubeCardWrapper(300);
  const storage = {
    getBlockedSources: async () => ({}),
    onBlockedSourcesChanged: () => {},
    getDisplayMode: async () => 'placeholder',
    onDisplayModeChanged: () => {},
    addBlockedSource: async () => {},
    removeBlockedSource: async () => {},
  };
  const doc = { querySelectorAll: () => [card], body: {}, createElement: (tag) => makeFakeElement(tag) };

  const controller = search.init({ document: doc, storage, adapter: YOUTUBE_LIKE_ADAPTER });
  await controller.start();

  const anchor = card.querySelector('#dismissible');
  const button = anchor.querySelector('.cb-search-register-button');
  assert.ok(button, '#dismissible配下に登録ボタンが無い（CB_SEARCHに登録UIが未実装）');
  assert.equal(button.style.opacity, '0');
  anchor.listeners.mouseenter && anchor.listeners.mouseenter();
  assert.equal(button.style.opacity, '1');
});

test('【yt-contract-tests/red】CB_SEARCHのplaceholderは元カードの実測高さを保持する（plan成功条件5）', async () => {
  const search = loadContentSearch();
  const wrapper = makeFakeYoutubeCardWrapper(412);

  search.applyVisibility(wrapper, true, { mode: 'placeholder', preserveHeight: true });

  assert.equal(wrapper.style.height, '412px', 'wrapperの高さが実測値(412px)に固定されていない（CB_SEARCHは高さ保持を実装していない）');

  search.applyVisibility(wrapper, false, { mode: 'placeholder', preserveHeight: true });
  assert.equal(wrapper.style.height, '', '解除後にwrapperの高さ指定が復元されていない');
});

test('【yt-contract-tests/red】CB_SEARCHは初回スキャン0件でセレクタ壊れをwarnする（content-name.jsと同等の安全弁）', async () => {
  const warnings = [];
  const search = loadContentSearch({ consoleImpl: { ...console, warn: (...args) => warnings.push(args) } });
  const storage = {
    getBlockedSources: async () => ({}),
    onBlockedSourcesChanged: () => {},
    getDisplayMode: async () => 'placeholder',
    onDisplayModeChanged: () => {},
  };
  // ホームで cardSelector が実際のDOMと一致しなかった場合を模す（0件）。
  const doc = { querySelectorAll: () => [], body: {}, createElement: (tag) => makeFakeElement(tag) };

  const controller = search.init({ document: doc, storage, adapter: YOUTUBE_LIKE_ADAPTER });
  await controller.start();

  assert.equal(warnings.length, 1, 'CB_SEARCHは初回0件スキャンでconsole.warnしない（content-name.jsのfirstScanDone相当の検知が無い）');
});

test('【yt-contract-tests/red】視聴ページ(watch*)向けcontent_scriptsエントリが存在しない（plan成功条件6・yt-watch-retire撤去後に真になる）', () => {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const watchEntry = manifest.content_scripts.find(
    (entry) => entry.matches.includes('*://www.youtube.com/watch*')
  );
  assert.equal(watchEntry, undefined, 'manifest.jsonにwatch*向けcontent_scriptsエントリがまだ残っている');
});

test('【yt-contract-tests/red】youtube_watch.js アダプタが撤去されている（plan成功条件6・yt-watch-retire撤去後に真になる）', () => {
  assert.equal(existsSync(YOUTUBE_WATCH_ADAPTER_PATH), false, 'src/adapters/youtube_watch.js がまだ存在する');
});

// room裁定[45][47][48][51][52]: 成功条件2「片方だけ再出現する状態を許さない」はUC正本化で満たす。
// blockedSourcesはUC ID 1件のみが正本。handle→UCの対応（alias）はblockedSourcesと同じく
// chrome.storage.sync（storage.getSourceAliases/setSourceAlias、端末間で共有）に持つ。
// 通信（canonicalize呼び出し）は「表示するだけ」では絶対に発生させず、ユーザーが登録ボタンを
// クリックした時だけ発生させる（bell異議[51]・kotone監査[52]で欠陥指摘、修正）。
function makeCanonicalizingAdapter(canonicalizeImpl, findHandleAliasImpl) {
  return {
    siteKey: 'youtube',
    cardSelector: 'ytd-video-renderer',
    getWrapper: (card) => card,
    resolver: {
      type: 'dom_id',
      getSource: (card) => card.__source,
      register: { anchorSelector: '#dismissible' },
      canonicalize: canonicalizeImpl,
      findHandleAlias: findHandleAliasImpl || (async () => { throw new Error('findHandleAlias未実装（このテストでは呼ばれない想定）'); }),
    },
  };
}

function makeAliasAwareStorage(overrides = {}) {
  let aliases = { ...(overrides.initialAliases || {}) };
  return {
    getBlockedSources: async () => ({}),
    onBlockedSourcesChanged: () => {},
    getDisplayMode: async () => 'collapse',
    onDisplayModeChanged: () => {},
    addBlockedSource: async () => {},
    removeBlockedSource: async () => {},
    getSourceAliases: async () => ({ ...aliases }),
    setSourceAlias: async (_siteKey, rawId, canonicalId) => {
      aliases = { ...aliases, [rawId]: canonicalId };
      return { ...aliases };
    },
    onSourceAliasesChanged: () => {},
    ...overrides,
  };
}

test('【yt-contract-tests】カードを表示するだけでは通信（canonicalize）を一切発生させない（未知handleカード複数でも0回）', async () => {
  const search = loadContentSearch();
  const cards = Array.from({ length: 5 }, (_, i) => {
    const c = makeFakeYoutubeCardWrapper(300);
    c.__source = { sourceId: `@handle${i}`, sourceName: `Channel ${i}` };
    return c;
  });
  let canonicalizeCalls = 0;
  const adapter = makeCanonicalizingAdapter(async () => { canonicalizeCalls += 1; return 'UCxxxxx'; });
  const storage = makeAliasAwareStorage();
  const doc = { querySelectorAll: () => cards, body: {}, createElement: (tag) => makeFakeElement(tag) };

  const controller = search.init({ document: doc, storage, adapter });
  await controller.start();
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));

  assert.equal(canonicalizeCalls, 0,
    'スキャン時（表示するだけ）にcanonicalizeが呼ばれている。これはbell異議[51]で指摘された欠陥そのもの');
});

test('【yt-contract-tests】既知のalias（同期済み）があればfetchなしでUC正本と照合する', async () => {
  const search = loadContentSearch();
  const card = makeFakeYoutubeCardWrapper(300);
  card.__source = { sourceId: '@NASA', sourceName: 'NASA' };
  let canonicalizeCalls = 0;
  const adapter = makeCanonicalizingAdapter(async () => { canonicalizeCalls += 1; return 'UCLA_DiR1FfKNvjuUpBHmylQ'; });
  const storage = makeAliasAwareStorage({
    getBlockedSources: async () => ({ UCLA_DiR1FfKNvjuUpBHmylQ: { name: 'NASA', addedAt: 0 } }),
    initialAliases: { '@NASA': 'UCLA_DiR1FfKNvjuUpBHmylQ' },
  });
  const doc = { querySelectorAll: () => [card], body: {}, createElement: (tag) => makeFakeElement(tag) };

  const controller = search.init({ document: doc, storage, adapter });
  await controller.start();
  await new Promise((r) => setImmediate(r));

  assert.equal(card.style.display, 'none', '既知aliasでのUC正本照合結果が反映されていない');
  assert.equal(canonicalizeCalls, 0, '既知aliasがあるのにcanonicalizeが呼ばれている（無駄な通信）');
});

test('【yt-contract-tests】登録ボタンのクリック時だけcanonicalizeが呼ばれ、正本UC IDで保存・alias同期される', async () => {
  const search = loadContentSearch();
  const card = makeFakeYoutubeCardWrapper(300);
  card.__source = { sourceId: '@NASA', sourceName: 'NASA' };
  let canonicalizeCalls = 0;
  const adapter = makeCanonicalizingAdapter(async (rawId) => {
    canonicalizeCalls += 1;
    assert.equal(rawId, '@NASA');
    return 'UCLA_DiR1FfKNvjuUpBHmylQ';
  });
  const added = [];
  const storage = makeAliasAwareStorage({
    addBlockedSource: async (siteKey, sourceId, sourceName) => { added.push({ siteKey, sourceId, sourceName }); },
  });
  const doc = { querySelectorAll: () => [card], body: {}, createElement: (tag) => makeFakeElement(tag) };

  const controller = search.init({ document: doc, storage, adapter });
  await controller.start();
  await new Promise((r) => setImmediate(r));

  assert.equal(canonicalizeCalls, 0, '登録ボタンをクリックする前にcanonicalizeが呼ばれている');

  const anchor = card.querySelector('#dismissible');
  const button = anchor.querySelector('.cb-search-register-button');
  assert.ok(button, '未確認handleカードにも通常の登録ボタンが出ているはず（エラー扱いにしない）');
  await button.listeners.click({ preventDefault() {}, stopPropagation() {} });

  assert.equal(canonicalizeCalls, 1, 'クリック時に一度だけcanonicalizeが呼ばれるべき');
  assert.deepEqual(added, [{ siteKey: 'youtube', sourceId: 'UCLA_DiR1FfKNvjuUpBHmylQ', sourceName: 'NASA' }],
    '登録ボタンが生のhandle(@NASA)を保存している（UC正本での保存になっていない）');
  assert.equal(await storage.getSourceAliases('youtube').then((a) => a['@NASA']), 'UCLA_DiR1FfKNvjuUpBHmylQ',
    '解決したaliasがsourceAliases（sync）へ保存されていない');
});

test('【yt-contract-tests】未確認handleカードは通常の登録ボタンを出し、クリック時の解決失敗でだけ可視エラーへ切り替わる（部分登録禁止）', async () => {
  const warnings = [];
  const search = loadContentSearch({ consoleImpl: { ...console, warn: (...args) => warnings.push(args) } });
  const card = makeFakeYoutubeCardWrapper(300);
  card.__source = { sourceId: '@broken', sourceName: 'Broken Channel' };
  const adapter = makeCanonicalizingAdapter(async () => { throw new Error('canonical linkが見つかりませんでした'); });
  const added = [];
  const storage = makeAliasAwareStorage({
    addBlockedSource: async (siteKey, sourceId, sourceName) => { added.push({ siteKey, sourceId, sourceName }); },
  });
  const doc = { querySelectorAll: () => [card], body: {}, createElement: (tag) => makeFakeElement(tag) };

  const controller = search.init({ document: doc, storage, adapter });
  await controller.start();
  await new Promise((r) => setImmediate(r));

  const anchor = card.querySelector('#dismissible');
  const buttonBeforeClick = anchor.querySelector('.cb-search-register-button');
  assert.ok(buttonBeforeClick, '未確認handleカードの初期表示で通常の登録ボタンが出ていない（誤ってエラー扱いしている）');
  assert.equal(anchor.querySelector('.cb-search-register-error'), null, 'クリック前からエラーバッジが出ている');

  await buttonBeforeClick.listeners.click({ preventDefault() {}, stopPropagation() {} });

  const registerButtonAfterClick = anchor.querySelector('.cb-search-register-button');
  assert.equal(registerButtonAfterClick.style.display, 'none', '解決失敗後も機能する登録ボタンが見えている');
  const errorBadge = anchor.querySelector('.cb-search-register-error');
  assert.ok(errorBadge, '解決失敗後に可視のエラーが出ていない');
  assert.equal(errorBadge.style.opacity, undefined, 'エラーは常時可視であるべき（hover専用にしてはいけない）');
  assert.equal(added.length, 0, '解決失敗時に生IDでの部分登録が行われている');
  assert.equal(warnings.length, 1, '解決失敗をconsole.warnで記録していない');
});

// room裁定[55][58]（bell異議・kotone監査[57]で確定した欠陥の修正）: UC形式カードをクリックして
// ブロックする時も、逆方向（UC→handle）を解決してsourceAliasesへ保存しなければならない。
// そうしないと、同じチャンネルが後でhandle形式カードとして現れた時に「片方だけ再出現する」
// （plan成功条件2違反）。
test('【yt-contract-tests】UC形式カードのブロック時にもhandle側aliasを解決・保存する（片方だけ再出現させない）', async () => {
  const search = loadContentSearch();
  const card = makeFakeYoutubeCardWrapper(300);
  card.__source = { sourceId: 'UCLA_DiR1FfKNvjuUpBHmylQ', sourceName: 'NASA' };
  let findHandleAliasCalls = 0;
  const adapter = makeCanonicalizingAdapter(
    async () => { throw new Error('このテストではcanonicalizeは呼ばれない想定'); },
    async (uc) => { findHandleAliasCalls += 1; assert.equal(uc, 'UCLA_DiR1FfKNvjuUpBHmylQ'); return '@NASA'; },
  );
  const added = [];
  const storage = makeAliasAwareStorage({
    addBlockedSource: async (siteKey, sourceId, sourceName) => { added.push({ siteKey, sourceId, sourceName }); },
  });
  const doc = { querySelectorAll: () => [card], body: {}, createElement: (tag) => makeFakeElement(tag) };

  const controller = search.init({ document: doc, storage, adapter });
  await controller.start();
  await new Promise((r) => setImmediate(r));

  const anchor = card.querySelector('#dismissible');
  const button = anchor.querySelector('.cb-search-register-button');
  await button.listeners.click({ preventDefault() {}, stopPropagation() {} });

  assert.equal(findHandleAliasCalls, 1, 'UCカードのブロック時にfindHandleAliasが呼ばれていない');
  assert.deepEqual(added, [{ siteKey: 'youtube', sourceId: 'UCLA_DiR1FfKNvjuUpBHmylQ', sourceName: 'NASA' }]);
  assert.equal(await storage.getSourceAliases('youtube').then((a) => a['@NASA']), 'UCLA_DiR1FfKNvjuUpBHmylQ',
    'UC起点のブロックでhandle側aliasがsourceAliasesへ保存されていない');
});

test('【yt-contract-tests】UC形式カードのhandle解決に失敗したらブロックせず可視エラーを出す（canonicalBaseUrl不在をhandleなしと推測しない・bell裁定[58]）', async () => {
  const warnings = [];
  const search = loadContentSearch({ consoleImpl: { ...console, warn: (...args) => warnings.push(args) } });
  const card = makeFakeYoutubeCardWrapper(300);
  card.__source = { sourceId: 'UCbroken', sourceName: 'Broken Channel' };
  const adapter = makeCanonicalizingAdapter(
    async () => { throw new Error('このテストではcanonicalizeは呼ばれない想定'); },
    async () => { throw new Error('canonicalBaseUrlが見つかりませんでした'); },
  );
  const added = [];
  const storage = makeAliasAwareStorage({
    addBlockedSource: async (siteKey, sourceId, sourceName) => { added.push({ siteKey, sourceId, sourceName }); },
  });
  const doc = { querySelectorAll: () => [card], body: {}, createElement: (tag) => makeFakeElement(tag) };

  const controller = search.init({ document: doc, storage, adapter });
  await controller.start();
  await new Promise((r) => setImmediate(r));

  const anchor = card.querySelector('#dismissible');
  const button = anchor.querySelector('.cb-search-register-button');
  await button.listeners.click({ preventDefault() {}, stopPropagation() {} });

  assert.equal(added.length, 0, 'handle解決に失敗したのにUC側がブロックされている');
  assert.ok(anchor.querySelector('.cb-search-register-error'), 'UCカードのhandle解決失敗時に可視エラーが出ていない');
  assert.equal(warnings.length, 1);
});

test('【yt-contract-tests】ブロック済みUC形式カードの解除（placeholderの解除ボタン）はhandle解決の通信をしない', async () => {
  const search = loadContentSearch();
  const card = makeFakeYoutubeCardWrapper(300);
  card.__source = { sourceId: 'UCLA_DiR1FfKNvjuUpBHmylQ', sourceName: 'NASA' };
  let findHandleAliasCalls = 0;
  const adapter = makeCanonicalizingAdapter(
    async () => { throw new Error('このテストではcanonicalizeは呼ばれない想定'); },
    async () => { findHandleAliasCalls += 1; return '@NASA'; },
  );
  const removed = [];
  const storage = makeAliasAwareStorage({
    getBlockedSources: async () => ({ UCLA_DiR1FfKNvjuUpBHmylQ: { name: 'NASA', addedAt: 0 } }),
    getDisplayMode: async () => 'placeholder',
    removeBlockedSource: async (siteKey, sourceId) => { removed.push({ siteKey, sourceId }); },
  });
  const doc = { querySelectorAll: () => [card], body: {}, createElement: (tag) => makeFakeElement(tag) };

  const controller = search.init({ document: doc, storage, adapter });
  await controller.start();
  await new Promise((r) => setImmediate(r));

  // ブロック済みカードは登録ボタンが隠れているのでplaceholderの解除ボタンから操作する。
  assert.equal(card.style.display, '', '前提: placeholderモードではwrapper自体は表示のまま');

  const wrapperUnblock = card.children.find((c) => c.className === 'cb-blocked-placeholder');
  assert.ok(wrapperUnblock, '前提: placeholderが出ているはず');
  const unblockBtn = wrapperUnblock.children.find((c) => c.textContent === 'ブロック解除');
  await unblockBtn.listeners.click({ preventDefault() {}, stopPropagation() {} });

  assert.deepEqual(removed, [{ siteKey: 'youtube', sourceId: 'UCLA_DiR1FfKNvjuUpBHmylQ' }]);
  assert.equal(findHandleAliasCalls, 0, '解除操作でhandle解決（通信）が起きている（不要な通信）');
});

