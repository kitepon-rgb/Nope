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
    disabled: false,
    isConnected: true, // floating buttonのdetach検知（bell裁定[107]）に使う
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
      el.isConnected = false;
    },
    querySelector(selector) {
      const match = /\.([\w-]+)/.exec(selector);
      const cls = match ? match[1] : selector;
      return el.children.find((c) => c.className === cls) || null;
    },
  };
  return el;
}

// floating button（bell裁定[107]）はdocument.body直下に生成される。body.appendChild/containsだけの
// 必要最小限のfakeを用意する（makeFakeElementの汎用querySelector探索は使わない専用の器）。
function makeFakeBody() {
  const body = {
    children: [],
    appendChild(child) { body.children.push(child); return child; },
    contains(node) { return body.children.includes(node); },
  };
  return body;
}

// docs/survey/youtube-home-search.md の実測: カードは div#dismissible(position:relative) を
// 操作UIのアンカーに使える。#dismissible を子に持つ ytd-video-renderer 相当の wrapper を作る。
// rect は floating button（bell裁定[107]）の位置計算に使う。省略時は既存呼び出しとの後方互換のため
// measuredHeightから機械的に組み立てる。
function makeFakeYoutubeCardWrapper(measuredHeight, rect) {
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
  const effectiveRect = rect || { top: 0, left: 0, right: 400, bottom: measuredHeight, width: 400, height: measuredHeight };
  wrapper.getBoundingClientRect = () => ({ ...effectiveRect, height: measuredHeight });
  return wrapper;
}

// bellの実Chrome実測[86]（オーナーのログイン済みホーム）: ホームの実カードは ytd-rich-item-renderer
// （ytd-video-renderer ではない）。#dismissible は存在せず、#content がアンカー候補。
// ytd-rich-item-renderer > div#content > yt-lockup-view-model > ... a[href="/@handle"] という構造。
function makeFakeHomeCardWrapper(measuredHeight, rect) {
  const wrapper = makeFakeElement('ytd-rich-item-renderer');
  const content = makeFakeElement('div');
  content.className = 'content';
  content.getAttribute = (name) => (name === 'id' ? 'content' : null);
  wrapper.appendChild(content);
  wrapper.querySelector = (selector) => {
    if (selector === '#dismissible') return null; // ホームには存在しない（実測[86]）
    if (selector === '#content') return content;
    const match = /\.([\w-]+)/.exec(selector);
    const cls = match ? match[1] : selector;
    return wrapper.children.find((c) => c.className === cls) || null;
  };
  const effectiveRect = rect || { top: 0, left: 0, right: 400, bottom: measuredHeight, width: 400, height: measuredHeight };
  wrapper.getBoundingClientRect = () => ({ ...effectiveRect, height: measuredHeight });
  return wrapper;
}

// win省略時は最小のダミーwindow（scroll/resize再配置テストだけがwinを明示的に渡す）。
function makeFakeWindow({ innerWidth = 1280, innerHeight = 800 } = {}) {
  const listeners = {};
  return {
    innerWidth,
    innerHeight,
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    removeEventListener(type, fn) {
      if (!listeners[type]) return;
      listeners[type] = listeners[type].filter((f) => f !== fn);
    },
    dispatch(type) { (listeners[type] || []).forEach((fn) => fn()); },
  };
}

function loadContentSearch({ consoleImpl = console, win = makeFakeWindow() } = {}) {
  const globals = {
    document: { querySelectorAll: () => [], body: {}, createElement: (tag) => makeFakeElement(tag) },
    window: win,
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

// docs/design-youtube-surfaces.md §3-2（floating方式への改訂、bell裁定[107]）: dom_id resolver への
// register.mode==='floating' オプトインで、body直下の共有floating buttonを使う
// （カード内挿入だとYouTubeの管理DOM再描画でボタンごと消える欠陥があった。オーナー実測: 23個→0個）。
const YOUTUBE_LIKE_ADAPTER = {
  siteKey: 'youtube',
  cardSelector: 'ytd-video-renderer',
  getWrapper: (card) => card,
  resolver: {
    type: 'dom_id',
    getSource: (card) => ({ sourceId: '@MagicClub686', sourceName: 'Magic Club' }),
    register: { mode: 'floating' },
  },
};

// bell裁定[107]（オーナー実Chrome実測: カード内button挿入だと管理DOM再描画で23個→0個に消える）。
// document.body直下に1個だけ生成する共有floating buttonへ設計変更。hover/focus中のカードの
// getBoundingClientRectへ追従し、右下にinset配置する。
test('【yt-contract-tests】floating buttonはbody直下に1個だけ生成され、カード内には挿入されない（bell裁定[107]）', async () => {
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
  const body = makeFakeBody();
  const doc = { querySelectorAll: () => [card], body, createElement: (tag) => makeFakeElement(tag) };

  const controller = search.init({ document: doc, storage, adapter: YOUTUBE_LIKE_ADAPTER });
  await controller.start();

  const anchor = card.querySelector('#dismissible');
  assert.equal(anchor.querySelector('.cb-search-register-button'), null,
    'カード内(#dismissible配下)に登録ボタンが挿入されている（body直下の共有floating方式に反する・bell裁定[107]）');
  const buttons = body.children.filter((c) => c.className === 'cb-search-register-button');
  assert.equal(buttons.length, 1, 'body直下に生成されたfloating buttonが1個ではない');
  assert.equal(buttons[0].style.display, 'none', 'hover前からfloating buttonが表示されている');

  card.listeners.mouseenter();
  assert.notEqual(buttons[0].style.display, 'none', 'hover後にfloating buttonが表示されていない');
  // 2026-08-11 kotoneの実Chrome smokeで発見: textContent未設定のため視覚的に空欄ボタンだった欠陥[69]の回帰防止。
  assert.equal(buttons[0].textContent, '🚫 このチャンネルをブロック', '登録ボタンの表示テキストが空/想定と異なる');

  // 右下配置: position:fixedでカードのright/bottomから計算する（bell裁定[107]「ハイライト内の右下」）。
  assert.equal(buttons[0].style.position, 'fixed');
  const rect = card.getBoundingClientRect();
  assert.ok(parseFloat(buttons[0].style.right) >= 0 && parseFloat(buttons[0].style.right) < 1280 - rect.right + 40,
    `right座標(${buttons[0].style.right})がカード右端基準の想定範囲外`);
  assert.ok(parseFloat(buttons[0].style.bottom) >= 0 && parseFloat(buttons[0].style.bottom) < 800 - rect.bottom + 40,
    `bottom座標(${buttons[0].style.bottom})がカード下端基準の想定範囲外`);

  // カードからfloating button自身へpointerが移っても消えない（hover保持、bell裁定[107]）。
  card.listeners.mouseleave({ relatedTarget: buttons[0] });
  assert.notEqual(buttons[0].style.display, 'none', 'button自身への移動でfloating buttonが消えている（hover保持契約に反する）');
  buttons[0].listeners.mouseleave({ relatedTarget: null });
  assert.equal(buttons[0].style.display, 'none', 'button自身からの離脱後も表示されたまま');
});

test('【yt-contract-tests】YouTube管理DOMの再描画（カード要素の総入れ替え）でもfloating buttonは残り続け、新カードへ追従する（bell裁定[107]）', async () => {
  const search = loadContentSearch();
  const storage = {
    getBlockedSources: async () => ({}),
    onBlockedSourcesChanged: () => {},
    getDisplayMode: async () => 'placeholder',
    onDisplayModeChanged: () => {},
    addBlockedSource: async () => {},
    removeBlockedSource: async () => {},
  };
  const body = makeFakeBody();
  let cards = [makeFakeYoutubeCardWrapper(300)];
  const doc = { querySelectorAll: () => cards, body, createElement: (tag) => makeFakeElement(tag) };

  const controller = search.init({ document: doc, storage, adapter: YOUTUBE_LIKE_ADAPTER });
  await controller.start();

  const oldCard = cards[0];
  oldCard.listeners.mouseenter();
  const button = body.children.find((c) => c.className === 'cb-search-register-button');
  assert.notEqual(button.style.display, 'none');

  // 管理DOM再描画: 旧カードがdisconnectし、新しいDOM要素（同一チャンネル）に置き換わる想定。
  oldCard.remove();
  const newCard = makeFakeYoutubeCardWrapper(300);
  cards = [newCard];
  controller.scan(doc);

  assert.equal(button.style.display, 'none', 'disconnectしたカードのfloating buttonが隠れていない');
  const buttonsAfterRerender = body.children.filter((c) => c.className === 'cb-search-register-button');
  assert.equal(buttonsAfterRerender.length, 1, '再描画後にfloating buttonが増殖している（body直下1個の共有契約に反する）');

  newCard.listeners.mouseenter();
  assert.notEqual(button.style.display, 'none', '再描画後の新カードへのhoverでfloating buttonが出ていない');
});

test('【yt-contract-tests】scroll/resizeでfloating buttonの位置が再計算される（bell裁定[107]）', async () => {
  const win = makeFakeWindow();
  const search = loadContentSearch({ win });
  const card = makeFakeYoutubeCardWrapper(300, { top: 100, left: 50, right: 450, bottom: 400, width: 400, height: 300 });
  const storage = {
    getBlockedSources: async () => ({}),
    onBlockedSourcesChanged: () => {},
    getDisplayMode: async () => 'placeholder',
    onDisplayModeChanged: () => {},
    addBlockedSource: async () => {},
    removeBlockedSource: async () => {},
  };
  const body = makeFakeBody();
  const doc = { querySelectorAll: () => [card], body, createElement: (tag) => makeFakeElement(tag) };

  const controller = search.init({ document: doc, storage, adapter: YOUTUBE_LIKE_ADAPTER });
  await controller.start();

  card.listeners.mouseenter();
  const button = body.children.find((c) => c.className === 'cb-search-register-button');
  const bottomBefore = button.style.bottom;

  // カードがスクロールで移動した状態を模す。
  card.getBoundingClientRect = () => ({ top: -50, left: 50, right: 450, bottom: 250, width: 400, height: 300 });
  win.dispatch('scroll');
  assert.notEqual(button.style.bottom, bottomBefore, 'scroll後にfloating buttonの位置が再計算されていない');

  const rightBefore = button.style.right;
  card.getBoundingClientRect = () => ({ top: 10, left: 50, right: 900, bottom: 310, width: 850, height: 300 });
  win.dispatch('resize');
  assert.notEqual(button.style.right, rightBefore, 'resize後にfloating buttonの位置が再計算されていない');

  // bell裁定[119]: scrollでカードがviewport外へ完全に出たら、端に張り付かせず隠す
  // （width/heightだけの判定だとviewport外でも「見える」扱いになる不具合の回帰防止）。
  card.getBoundingClientRect = () => ({ top: -400, left: 50, right: 450, bottom: -100, width: 400, height: 300 });
  win.dispatch('scroll');
  assert.equal(button.style.display, 'none', 'カードがviewport外へ出てもfloating buttonが表示されたまま（端に張り付いている）');
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
    // 検索結果(ytd-video-renderer)とホーム(ytd-rich-item-renderer)の両方を1つのadapterで拾う
    // （本番のsrc/adapters/youtube.jsと同じcardSelector。bell実測[86]）。
    cardSelector: 'ytd-video-renderer, ytd-rich-item-renderer',
    getWrapper: (card) => card,
    resolver: {
      type: 'dom_id',
      getSource: (card) => card.__source,
      register: { mode: 'floating' },
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
  const body = makeFakeBody();
  const doc = { querySelectorAll: () => [card], body, createElement: (tag) => makeFakeElement(tag) };

  const controller = search.init({ document: doc, storage, adapter });
  await controller.start();
  await new Promise((r) => setImmediate(r));

  assert.equal(canonicalizeCalls, 0, '登録ボタンをクリックする前にcanonicalizeが呼ばれている');

  card.listeners.mouseenter();
  const button = body.children.find((c) => c.className === 'cb-search-register-button');
  assert.ok(button, '未確認handleカードにも通常のfloating buttonが出ているはず（エラー扱いにしない）');
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
  const body = makeFakeBody();
  const doc = { querySelectorAll: () => [card], body, createElement: (tag) => makeFakeElement(tag) };

  const controller = search.init({ document: doc, storage, adapter });
  await controller.start();
  await new Promise((r) => setImmediate(r));

  card.listeners.mouseenter();
  const button = body.children.find((c) => c.className === 'cb-search-register-button');
  assert.ok(button, '未確認handleカードの初期表示で通常のfloating buttonが出ていない（誤ってエラー扱いしている）');
  assert.equal(button.textContent, '🚫 このチャンネルをブロック', 'クリック前からエラー表示になっている');

  await button.listeners.click({ preventDefault() {}, stopPropagation() {} });

  // floating方式（bell裁定[107]）: エラーは別要素のバッジではなく、共有buttonのテキスト/disabledで表す。
  assert.equal(button.textContent, '⚠ 識別子解決に失敗', '解決失敗後にエラー表示へ切り替わっていない');
  assert.equal(button.disabled, true, '解決失敗後もクリック可能な登録ボタンのままになっている');
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
  const body = makeFakeBody();
  const doc = { querySelectorAll: () => [card], body, createElement: (tag) => makeFakeElement(tag) };

  const controller = search.init({ document: doc, storage, adapter });
  await controller.start();
  await new Promise((r) => setImmediate(r));

  card.listeners.mouseenter();
  const button = body.children.find((c) => c.className === 'cb-search-register-button');
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
  const body = makeFakeBody();
  const doc = { querySelectorAll: () => [card], body, createElement: (tag) => makeFakeElement(tag) };

  const controller = search.init({ document: doc, storage, adapter });
  await controller.start();
  await new Promise((r) => setImmediate(r));

  card.listeners.mouseenter();
  const button = body.children.find((c) => c.className === 'cb-search-register-button');
  await button.listeners.click({ preventDefault() {}, stopPropagation() {} });

  assert.equal(added.length, 0, 'handle解決に失敗したのにUC側がブロックされている');
  assert.equal(button.textContent, '⚠ 識別子解決に失敗', 'UCカードのhandle解決失敗時にエラー表示になっていない');
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

// bellの実Chrome実測[86]（オーナーのログイン済みホームでの差し戻し）: ホームのカードは
// ytd-rich-item-renderer で #dismissible が無く #content がアンカー候補。yt-lockup-view-model を
// cardSelectorに直接使うと広告カード内部の入れ子まで拾ってしまう。広告カードはgetSourceがnullを
// 返すため既存の「source無しはスキップ」処理で自然に除外される（広告固有の判定コードは無い）。
test('【yt-contract-tests】ホーム形式カード(ytd-rich-item-renderer)は#dismissibleが無くてもhoverでfloating buttonが出る', async () => {
  const search = loadContentSearch();
  const homeCard = makeFakeHomeCardWrapper(280);
  homeCard.__source = { sourceId: '@NASA', sourceName: 'NASA' };
  const adapter = makeCanonicalizingAdapter(async () => { throw new Error('このテストでは呼ばれない想定'); });
  const storage = makeAliasAwareStorage();
  const body = makeFakeBody();
  const doc = { querySelectorAll: () => [homeCard], body, createElement: (tag) => makeFakeElement(tag) };

  const controller = search.init({ document: doc, storage, adapter });
  await controller.start();
  await new Promise((r) => setImmediate(r));

  assert.equal(homeCard.querySelector('#dismissible'), null, '前提: ホームカードに#dismissibleは無い');
  homeCard.listeners.mouseenter();
  const button = body.children.find((c) => c.className === 'cb-search-register-button');
  assert.ok(button, 'ホーム形式カードのhoverでfloating buttonが出ていない');
  assert.equal(button.textContent, '🚫 このチャンネルをブロック');
});

test('【yt-contract-tests】発信元リンクが無いカード（広告カード相当）はhoverしてもfloating buttonが出ない', async () => {
  const search = loadContentSearch();
  const adCard = makeFakeHomeCardWrapper(280);
  adCard.__source = null; // getSourceが対象リンク無しでnullを返す実際の広告カードを模す（bell実測[86]）
  const adapter = makeCanonicalizingAdapter(async () => { throw new Error('このテストでは呼ばれない想定'); });
  const storage = makeAliasAwareStorage();
  const body = makeFakeBody();
  const doc = { querySelectorAll: () => [adCard], body, createElement: (tag) => makeFakeElement(tag) };

  const controller = search.init({ document: doc, storage, adapter });
  await controller.start();
  await new Promise((r) => setImmediate(r));

  assert.equal(adCard.listeners.mouseenter, undefined,
    '広告カード（source無し）にhoverリスナーが付いている（floating buttonの入口を持つべきでない）');
  assert.equal(body.children.filter((c) => c.className === 'cb-search-register-button').length, 0,
    '広告カード相当でfloating buttonが生成されている');
  assert.equal(adCard.style.display, '', '広告カードの表示状態が変更されている（触ってはいけない）');
});

test('【yt-contract-tests】検索結果カードとホームカードが混在するスキャンでも、それぞれのhoverで共有floating buttonが正しく追従する', async () => {
  const search = loadContentSearch();
  const searchCard = makeFakeYoutubeCardWrapper(300);
  searchCard.__source = { sourceId: '@SearchChannel', sourceName: 'Search Channel' };
  const homeCard = makeFakeHomeCardWrapper(280);
  homeCard.__source = { sourceId: '@HomeChannel', sourceName: 'Home Channel' };
  const adapter = makeCanonicalizingAdapter(async () => { throw new Error('このテストでは呼ばれない想定'); });
  const storage = makeAliasAwareStorage();
  const body = makeFakeBody();
  const doc = { querySelectorAll: () => [searchCard, homeCard], body, createElement: (tag) => makeFakeElement(tag) };

  const controller = search.init({ document: doc, storage, adapter });
  await controller.start();
  await new Promise((r) => setImmediate(r));

  searchCard.listeners.mouseenter();
  const button = body.children.find((c) => c.className === 'cb-search-register-button');
  assert.notEqual(button.style.display, 'none', '検索カードのhoverでfloating buttonが出ていない（混在スキャンで検索側が壊れた）');

  searchCard.listeners.mouseleave({ relatedTarget: null });
  homeCard.listeners.mouseenter();
  assert.notEqual(button.style.display, 'none', 'ホームカードのhoverでfloating buttonが出ていない（混在スキャンでホーム側が壊れた）');

  const buttonsInBody = body.children.filter((c) => c.className === 'cb-search-register-button');
  assert.equal(buttonsInBody.length, 1, '検索・ホーム混在でfloating buttonが複数生成されている');
});

