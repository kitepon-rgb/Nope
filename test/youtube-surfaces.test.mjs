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

// room裁定[45][47][48]: 成功条件2「片方だけ再出現する状態を許さない」はUC正本化で満たす。
// blockedSourcesはUC ID 1件のみが正本、handle→UCの対応はitemSourceCache（storage.getCachedSource/
// setCachedSource）を再利用する。以下はCB_SEARCHエンジン側のcanonicalize統合を検証する。
function makeCanonicalizingAdapter(canonicalizeImpl) {
  return {
    siteKey: 'youtube',
    cardSelector: 'ytd-video-renderer',
    getWrapper: (card) => card,
    resolver: {
      type: 'dom_id',
      getSource: (card) => card.__source,
      register: { anchorSelector: '#dismissible' },
      canonicalize: canonicalizeImpl,
    },
  };
}

test('【yt-contract-tests】handle形式カードは正本UC IDへ解決してから照合する（既にUCでブロック済みなら隠れる）', async () => {
  const search = loadContentSearch();
  const card = makeFakeYoutubeCardWrapper(300);
  card.__source = { sourceId: '@NASA', sourceName: 'NASA' };
  const adapter = makeCanonicalizingAdapter(async (rawId) => {
    assert.equal(rawId, '@NASA');
    return 'UCLA_DiR1FfKNvjuUpBHmylQ';
  });
  const storage = {
    getBlockedSources: async () => ({ UCLA_DiR1FfKNvjuUpBHmylQ: { name: 'NASA', addedAt: 0 } }),
    getCachedSource: async () => null,
    setCachedSource: async () => {},
    onBlockedSourcesChanged: () => {},
    getDisplayMode: async () => 'collapse',
    onDisplayModeChanged: () => {},
  };
  const doc = { querySelectorAll: () => [card], body: {}, createElement: (tag) => makeFakeElement(tag) };

  const controller = search.init({ document: doc, storage, adapter });
  await controller.start();
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));

  assert.equal(card.style.display, 'none', 'handle形式カードがUC正本での照合結果を反映していない');
});

test('【yt-contract-tests】登録ボタンでのブロックはキャッシュ済みの正本UC IDで保存する（生のhandleを保存しない）', async () => {
  const search = loadContentSearch();
  const card = makeFakeYoutubeCardWrapper(300);
  card.__source = { sourceId: '@NASA', sourceName: 'NASA' };
  let canonicalizeCalls = 0;
  const adapter = makeCanonicalizingAdapter(async () => { canonicalizeCalls += 1; return 'UCLA_DiR1FfKNvjuUpBHmylQ'; });
  const added = [];
  const storage = {
    getBlockedSources: async () => ({}),
    getCachedSource: async () => null,
    setCachedSource: async () => {},
    onBlockedSourcesChanged: () => {},
    getDisplayMode: async () => 'collapse',
    onDisplayModeChanged: () => {},
    addBlockedSource: async (siteKey, sourceId, sourceName) => { added.push({ siteKey, sourceId, sourceName }); },
    removeBlockedSource: async () => {},
  };
  const doc = { querySelectorAll: () => [card], body: {}, createElement: (tag) => makeFakeElement(tag) };

  const controller = search.init({ document: doc, storage, adapter });
  await controller.start();
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));

  const anchor = card.querySelector('#dismissible');
  const button = anchor.querySelector('.cb-search-register-button');
  assert.ok(button, '正本ID解決成功後に登録ボタンが出ていない');
  await button.listeners.click({ preventDefault() {}, stopPropagation() {} });

  assert.deepEqual(added, [{ siteKey: 'youtube', sourceId: 'UCLA_DiR1FfKNvjuUpBHmylQ', sourceName: 'NASA' }],
    '登録ボタンが生のhandle(@NASA)を保存している（UC正本での保存になっていない）');
  assert.equal(canonicalizeCalls, 1, 'canonicalizeが解決済みキャッシュ相当の再利用をせず余計に呼ばれている');
});

test('【yt-contract-tests】正本ID解決に失敗したカードは登録操作を提供せず、可視のエラーを出す（部分登録禁止）', async () => {
  const warnings = [];
  const search = loadContentSearch({ consoleImpl: { ...console, warn: (...args) => warnings.push(args) } });
  const card = makeFakeYoutubeCardWrapper(300);
  card.__source = { sourceId: '@broken', sourceName: 'Broken Channel' };
  const adapter = makeCanonicalizingAdapter(async () => { throw new Error('canonical linkが見つかりませんでした'); });
  const added = [];
  const storage = {
    getBlockedSources: async () => ({}),
    getCachedSource: async () => null,
    setCachedSource: async () => {},
    onBlockedSourcesChanged: () => {},
    getDisplayMode: async () => 'collapse',
    onDisplayModeChanged: () => {},
    addBlockedSource: async (siteKey, sourceId, sourceName) => { added.push({ siteKey, sourceId, sourceName }); },
    removeBlockedSource: async () => {},
  };
  const doc = { querySelectorAll: () => [card], body: {}, createElement: (tag) => makeFakeElement(tag) };

  const controller = search.init({ document: doc, storage, adapter });
  await controller.start();
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));

  const anchor = card.querySelector('#dismissible');
  const registerButton = anchor.querySelector('.cb-search-register-button');
  assert.equal(registerButton, null, '解決失敗カードに機能する登録ボタンを出してはいけない（部分登録の入口になる）');
  const errorBadge = anchor.querySelector('.cb-search-register-error');
  assert.ok(errorBadge, '解決失敗カードに可視のエラーが出ていない');
  assert.equal(errorBadge.style.opacity, undefined, 'エラーは常時可視であるべき（hover専用にしてはいけない）');
  assert.equal(added.length, 0, '解決失敗時に生IDでの部分登録が行われている');
  assert.equal(warnings.length, 1, '解決失敗をconsole.warnで記録していない');
});

