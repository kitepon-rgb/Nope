// パターンB（表示名のみ）コンテンツスクリプトエンジン。
// Yahoo ニュース / Yahoo! JAPAN / YouTube 視聴ページ関連動画 の3面で使用。
// 依存: CB_STORAGE, CB_KEYWORD_FILTER（連結読み込み順は v8a-manifest が管理する）
// パターンC（非同期解決）エンジン content-search.js とは別ファイル。
// 理由: パターンBは同期解決なので async queue が不要。面ごとに別 content_scripts エントリで動く。
// applyVisibility 系は content-search.js と同等のロジックをここにも持つ（共通化は将来課題）。
// CB_SEARCH と同じく <script> 連結読み込み前提のグローバル公開（ビルド工程なし・MV3 content_scripts）。

'use strict';

const CB_NAME = (() => {
  const DEFAULT_MODE = 'placeholder';
  const PLACEHOLDER_CLASS = 'cb-blocked-placeholder';
  const MASCOT_IMAGE_PATH = 'assets/mascot-blocked.png';
  const MASCOT_DISPLAY_SIZE = 120;

  // kitepon.dev ブランド正典（color-system.md）。content-search.js と同値を維持すること。
  const COLOR_ORANGE = '#ef8d32';
  const COLOR_ORANGE_DEEP = '#a84400';
  const COLOR_INK = '#111b35';
  const COLOR_WHITE = '#fffef9';

  function getMascotImageUrl() {
    return chrome.runtime.getURL(MASCOT_IMAGE_PATH);
  }

  const originalChildStateByWrapper = new WeakMap();

  function hideOriginalChildren(wrapper) {
    if (originalChildStateByWrapper.has(wrapper)) return;
    const children = Array.from(wrapper.children || []);
    const state = children.map((child) => ({ child, display: child.style ? child.style.display : '' }));
    originalChildStateByWrapper.set(wrapper, state);
    for (const { child } of state) {
      if (child.style) child.style.display = 'none';
    }
  }

  function restoreOriginalChildren(wrapper) {
    const state = originalChildStateByWrapper.get(wrapper);
    if (!state) return;
    for (const { child, display } of state) {
      if (child.style) child.style.display = display;
    }
    originalChildStateByWrapper.delete(wrapper);
  }

  function buildPlaceholderElement(sourceName, onUnblock) {
    const el = document.createElement('div');
    el.className = PLACEHOLDER_CLASS;
    Object.assign(el.style, {
      minHeight: '80px', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '8px', textAlign: 'center',
      backgroundColor: COLOR_WHITE, border: `1px solid ${COLOR_ORANGE}`,
      borderRadius: '8px', boxSizing: 'border-box',
    });

    const art = document.createElement('img');
    art.src = getMascotImageUrl();
    art.width = MASCOT_DISPLAY_SIZE;
    art.height = MASCOT_DISPLAY_SIZE;
    art.alt = '';
    art.ariaHidden = 'true';
    el.appendChild(art);

    const label = document.createElement('p');
    label.textContent = 'BLOCKED';
    Object.assign(label.style, {
      fontSize: '10px', letterSpacing: '0.14em', color: COLOR_ORANGE_DEEP,
      margin: '8px 0 0', fontWeight: 'bold',
    });
    el.appendChild(label);

    if (sourceName) {
      const nameEl = document.createElement('p');
      nameEl.textContent = sourceName;
      Object.assign(nameEl.style, { color: COLOR_INK, margin: '4px 0 0', fontSize: '12px' });
      el.appendChild(nameEl);
    }

    const unblockBtn = document.createElement('button');
    unblockBtn.type = 'button';
    unblockBtn.textContent = 'ブロック解除';
    Object.assign(unblockBtn.style, {
      marginTop: '8px', border: `1px solid ${COLOR_ORANGE}`, color: COLOR_ORANGE_DEEP,
      backgroundColor: 'transparent', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer',
    });
    unblockBtn.addEventListener('click', (event) => {
      if (event) {
        if (event.preventDefault) event.preventDefault();
        if (event.stopPropagation) event.stopPropagation();
      }
      if (onUnblock) onUnblock();
    });
    el.appendChild(unblockBtn);

    return el;
  }

  function insertPlaceholder(wrapper, sourceName, onUnblock) {
    if (wrapper.querySelector && wrapper.querySelector(`.${PLACEHOLDER_CLASS}`)) return;
    hideOriginalChildren(wrapper);
    const placeholder = buildPlaceholderElement(sourceName, onUnblock);
    if (wrapper.appendChild) wrapper.appendChild(placeholder);
  }

  function removePlaceholder(wrapper) {
    const placeholder = wrapper.querySelector && wrapper.querySelector(`.${PLACEHOLDER_CLASS}`);
    if (placeholder && placeholder.remove) placeholder.remove();
    restoreOriginalChildren(wrapper);
  }

  /**
   * @param {any} wrapper
   * @param {boolean} blocked
   * @param {{mode?: string, sourceName?: string, onUnblock?: Function}} [options]
   */
  function applyVisibility(wrapper, blocked, options) {
    if (!wrapper || !wrapper.style) return;
    const opts = options || {};
    const mode = opts.mode || DEFAULT_MODE;

    if (mode === 'collapse') {
      removePlaceholder(wrapper);
      wrapper.style.display = blocked ? 'none' : '';
      return;
    }

    wrapper.style.display = '';
    if (blocked) {
      insertPlaceholder(wrapper, opts.sourceName, opts.onUnblock);
    } else {
      removePlaceholder(wrapper);
    }
  }

  // ---- パターンBエンジン本体 ----

  /** @param {{document?: any, storage?: any, keywordFilter?: any, adapter: any}} deps */
  function init(deps) {
    const doc = (deps && deps.document) || document;
    const storage = (deps && deps.storage) || CB_STORAGE;
    const keywordFilter = (deps && deps.keywordFilter) || CB_KEYWORD_FILTER;
    const adapter = deps && deps.adapter;
    if (!adapter) throw new Error('content-name: init の deps.adapter が必要です');

    const { siteKey, cardSelector, getWrapper, resolver, getTitle } = adapter;

    const processedCards = new Set();
    const cardInfo = new Map(); // card -> { sourceName, wrapper }
    let blockedSources = {};
    let blockedKeywords = [];
    let displayMode = DEFAULT_MODE;
    let firstScanDone = false;

    function isSourceBlocked(sourceName) {
      return !!blockedSources[sourceName];
    }

    function isCardKeywordBlocked(card) {
      if (!blockedKeywords.length || !getTitle) return false;
      const title = getTitle(card);
      if (!title) return false;
      return keywordFilter.matchesAny(title, blockedKeywords);
    }

    function buildOptions(sourceName) {
      return {
        mode: displayMode,
        sourceName,
        onUnblock: () => storage.removeBlockedSource(siteKey, sourceName),
      };
    }

    function applyCardVisibility(card) {
      const info = cardInfo.get(card);
      if (!info) return;
      const { sourceName, wrapper } = info;
      const blocked = isSourceBlocked(sourceName) || isCardKeywordBlocked(card);
      applyVisibility(wrapper, blocked, buildOptions(sourceName));
    }

    function processCard(card) {
      if (processedCards.has(card)) return;
      processedCards.add(card);

      const result = resolver.getSource(card);
      if (!result) return;
      const { sourceName } = result;
      const wrapper = getWrapper(card);
      if (!wrapper) return;

      cardInfo.set(card, { sourceName, wrapper });
      applyCardVisibility(card);
    }

    function scan(root) {
      const cards = root.querySelectorAll(cardSelector);
      if (!firstScanDone) {
        firstScanDone = true;
        // 初回スキャン0件はセレクタ壊れの検知。「静かに効かなくなる」最悪ケースを防ぐ。
        if (cards.length === 0) {
          console.warn(
            `content-name: 初回スキャンでカードが0件。セレクタが壊れている可能性があります siteKey=${siteKey} cardSelector=${cardSelector}`
          );
        }
      }
      for (const card of cards) processCard(card);
    }

    async function start() {
      [blockedSources, blockedKeywords, displayMode] = await Promise.all([
        storage.getBlockedSources(siteKey),
        storage.getBlockedKeywords(siteKey),
        storage.getDisplayMode(),
      ]);
      scan(doc);

      const observer = new MutationObserver(() => scan(doc));
      observer.observe(doc.body, { childList: true, subtree: true });

      storage.onBlockedSourcesChanged(siteKey, (next) => {
        blockedSources = next;
        for (const card of processedCards) applyCardVisibility(card);
      });

      storage.onBlockedKeywordsChanged(siteKey, (next) => {
        blockedKeywords = next;
        for (const card of processedCards) applyCardVisibility(card);
      });

      storage.onDisplayModeChanged((next) => {
        displayMode = next;
        for (const card of processedCards) applyCardVisibility(card);
      });
    }

    return { start, scan };
  }

  return { applyVisibility, init };
})();
