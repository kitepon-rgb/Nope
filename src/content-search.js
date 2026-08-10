// AliExpress 検索結果ページで、ブロック済みストアの商品カードを displayMode に応じて2モードで処理する。
// 実証済み: カードは a.search-card-item、href の /item/(\d+)\.html から productId。
// カード自体にストア情報は無いため productId→storeId は CB_MTOP.resolveStoreId（cache優先）で解決する。
// 外側ラッパ（[class*="search-item-card-wrapper"] → .card-out-wrapper → parentElement の優先順で探索）を対象に、
// placeholder モード（既定）では中身を猫あっかんべーSVGのプレースホルダーへ差し替え、
// collapse モードでは wrapper ごと display:none で完全に消す（displayMode は CB_STORAGE 経由で購読・即時再適用）。
// mtop への同時リクエストは 2 並列・間隔 300ms に抑える（サーバ負荷/bot対策への配慮）。
// MutationObserver で無限スクロールと SPA 遷移に追従し、blockedStores/displayMode の onChanged で即時再適用する。
// 解決失敗カードは表示のままにし console.warn する（静かなフォールバック禁止＝黙って消さない）。
// CB_MD5・CB_STORAGE・CB_MTOP と同じく <script> 連結読み込み前提のグローバル公開（ビルド工程なし）。

'use strict';

const CB_SEARCH = (() => {
  const CARD_SELECTOR = 'a.search-card-item';
  const SEARCH_ITEM_CARD_WRAPPER_SELECTOR = '[class*="search-item-card-wrapper"]';
  const WRAPPER_SELECTOR = '.card-out-wrapper';
  const CONCURRENCY = 2;
  const INTERVAL_MS = 300;
  const DEFAULT_MODE = 'placeholder';
  const PLACEHOLDER_CLASS = 'cb-blocked-placeholder';

  // オーナー承認済みラフ（禁止マークの後ろから顔を出してあっかんべー）。定数のみを innerHTML に渡す。
  const CAT_SVG_MARKUP = '<svg viewBox="0 0 160 150" width="120" height="112" role="img" aria-label="ブロック済み"><path d="M62 46 L54 22 L74 34 Z" fill="#F5C4B3" stroke="#993C1D" stroke-width="2.5" stroke-linejoin="round"/><path d="M118 46 L126 22 L106 34 Z" fill="#F5C4B3" stroke="#993C1D" stroke-width="2.5" stroke-linejoin="round"/><ellipse cx="90" cy="62" rx="38" ry="32" fill="#FAECE7" stroke="#993C1D" stroke-width="2.5"/><circle cx="76" cy="56" r="3.5" fill="#4A1B0C"/><path d="M100 52 q6 6 12 0" fill="none" stroke="#4A1B0C" stroke-width="3" stroke-linecap="round"/><path d="M104 60 q4 4 10 2" fill="none" stroke="#D85A30" stroke-width="3" stroke-linecap="round"/><path d="M84 72 q6 5 12 0 q1 12 -6 13 q-7 -1 -6 -13 Z" fill="#ED93B1" stroke="#993556" stroke-width="2" stroke-linejoin="round"/><circle cx="80" cy="95" r="52" fill="none" stroke="#E24B4A" stroke-width="13"/><line x1="45" y1="59" x2="115" y2="131" stroke="#E24B4A" stroke-width="13" stroke-linecap="round"/><ellipse cx="42" cy="82" rx="9" ry="7" fill="#FAECE7" stroke="#993C1D" stroke-width="2.5"/><ellipse cx="120" cy="86" rx="9" ry="7" fill="#FAECE7" stroke="#993C1D" stroke-width="2.5"/></svg>';

  // placeholder挿入時に隠した元の子要素のdisplay値を退避しておく（DOM要素へ直接プロパティを生やさない）。
  const originalChildStateByWrapper = new WeakMap();

  /** @param {string} href @returns {string|null} */
  function extractProductId(href) {
    const match = (href || '').match(/\/item\/(\d+)\.html/);
    return match ? match[1] : null;
  }

  /** @param {{closest?: Function, parentElement?: any}} link @returns {any} */
  function findWrapper(link) {
    const bySearchCard = link.closest && link.closest(SEARCH_ITEM_CARD_WRAPPER_SELECTOR);
    if (bySearchCard) return bySearchCard;
    const byCardOut = link.closest && link.closest(WRAPPER_SELECTOR);
    if (byCardOut) return byCardOut;
    return link.parentElement || null;
  }

  /** wrapperの元の子要素を退避してdisplay:noneで隠す（二重退避防止）。 @param {any} wrapper */
  function hideOriginalChildren(wrapper) {
    if (originalChildStateByWrapper.has(wrapper)) return;
    const children = Array.from(wrapper.children || []);
    const state = children.map((child) => ({ child, display: child.style ? child.style.display : '' }));
    originalChildStateByWrapper.set(wrapper, state);
    for (const { child } of state) {
      if (child.style) child.style.display = 'none';
    }
  }

  /** 退避した元の子要素のdisplayを復元する。 @param {any} wrapper */
  function restoreOriginalChildren(wrapper) {
    const state = originalChildStateByWrapper.get(wrapper);
    if (!state) return;
    for (const { child, display } of state) {
      if (child.style) child.style.display = display;
    }
    originalChildStateByWrapper.delete(wrapper);
  }

  /** @param {string} [storeName] @param {Function} [onUnblock] @returns {any} */
  function buildPlaceholderElement(storeName, onUnblock) {
    const el = document.createElement('div');
    el.className = PLACEHOLDER_CLASS;
    Object.assign(el.style, {
      minHeight: '220px', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '12px', textAlign: 'center',
    });

    const art = document.createElement('div');
    art.innerHTML = CAT_SVG_MARKUP; // 定数のみをinnerHTMLへ渡す
    el.appendChild(art);

    const label = document.createElement('p');
    label.textContent = 'ブロック済み';
    el.appendChild(label);

    if (storeName) {
      const nameEl = document.createElement('p');
      nameEl.textContent = storeName; // XSS防止のためtextContentで入れる（innerHTMLに混ぜない）
      el.appendChild(nameEl);
    }

    const unblockBtn = document.createElement('button');
    unblockBtn.type = 'button';
    unblockBtn.textContent = 'ブロック解除';
    unblockBtn.addEventListener('click', (event) => {
      // カード全体が a タグのため、放置すると遷移してしまう。
      if (event) {
        if (event.preventDefault) event.preventDefault();
        if (event.stopPropagation) event.stopPropagation();
      }
      if (onUnblock) onUnblock();
    });
    el.appendChild(unblockBtn);

    return el;
  }

  /** @param {any} wrapper @param {string} [storeName] @param {Function} [onUnblock] */
  function insertPlaceholder(wrapper, storeName, onUnblock) {
    if (wrapper.querySelector && wrapper.querySelector(`.${PLACEHOLDER_CLASS}`)) return; // 二重挿入防止
    hideOriginalChildren(wrapper);
    const placeholder = buildPlaceholderElement(storeName, onUnblock);
    if (wrapper.appendChild) wrapper.appendChild(placeholder);
  }

  /** @param {any} wrapper */
  function removePlaceholder(wrapper) {
    const placeholder = wrapper.querySelector && wrapper.querySelector(`.${PLACEHOLDER_CLASS}`);
    if (placeholder && placeholder.remove) placeholder.remove();
    restoreOriginalChildren(wrapper);
  }

  /**
   * @param {{style: {display: string}}} wrapper @param {boolean} blocked
   * @param {{mode?: string, storeName?: string, onUnblock?: Function}} [options]
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

    // placeholder モード: wrapper自体は常に表示のままにし、中身をプレースホルダーで覆う。
    wrapper.style.display = '';
    if (blocked) {
      insertPlaceholder(wrapper, opts.storeName, opts.onUnblock);
    } else {
      removePlaceholder(wrapper);
    }
  }

  // productId→storeId 解決を 2並列・間隔300msに抑えるキュー。
  // resolveStoreId は注入可能にして純粋にテストできるようにする。
  /** @param {{resolveStoreId: Function, concurrency?: number, intervalMs?: number}} options */
  function createResolveQueue({ resolveStoreId, concurrency = CONCURRENCY, intervalMs = INTERVAL_MS }) {
    const pending = [];
    let active = 0;
    let timer = null;

    function scheduleNext() {
      if (timer) return;
      timer = setTimeout(() => { timer = null; pump(); }, intervalMs);
    }

    function pump() {
      if (active >= concurrency || pending.length === 0) return;
      const job = pending.shift();
      active += 1;
      resolveStoreId(job.productId)
        .then((storeId) => job.onSettled(storeId, null))
        .catch((err) => job.onSettled(null, err))
        .finally(() => {
          active -= 1;
          if (pending.length) scheduleNext();
        });
      if (pending.length && active < concurrency) scheduleNext();
    }

    /** @param {string} productId @param {(storeId: string|null, err: any) => void} onSettled */
    function enqueue(productId, onSettled) {
      pending.push({ productId, onSettled });
      pump();
    }

    return { enqueue };
  }

  /** @param {{document?: any, storage?: any, mtop?: any}} [deps] */
  function init(deps) {
    const doc = (deps && deps.document) || document;
    const storage = (deps && deps.storage) || CB_STORAGE;
    const mtop = (deps && deps.mtop) || CB_MTOP;

    const wrapperByProductId = new Map();
    const storeIdByProductId = new Map();
    let blockedStores = {};
    let displayMode = DEFAULT_MODE;

    const queue = createResolveQueue({ resolveStoreId: (productId) => mtop.resolveStoreId(productId) });

    function isBlocked(storeId) {
      return !!blockedStores[storeId];
    }

    /** @param {string} storeId @returns {{mode: string, storeName: string, onUnblock: Function}} */
    function buildVisibilityOptions(storeId) {
      const info = blockedStores[storeId];
      return {
        mode: displayMode,
        storeName: info ? info.name : '',
        onUnblock: () => storage.removeBlockedStore(storeId),
      };
    }

    function applyKnown(productId) {
      const storeId = storeIdByProductId.get(productId);
      const wrapper = wrapperByProductId.get(productId);
      if (storeId && wrapper) applyVisibility(wrapper, isBlocked(storeId), buildVisibilityOptions(storeId));
    }

    function handleCard(link) {
      const productId = extractProductId(link.getAttribute ? link.getAttribute('href') : link.href);
      if (!productId || wrapperByProductId.has(productId)) return;
      const wrapper = findWrapper(link);
      wrapperByProductId.set(productId, wrapper);

      storage.getCachedStore(productId).then((cached) => {
        if (cached) {
          storeIdByProductId.set(productId, cached);
          applyVisibility(wrapper, isBlocked(cached), buildVisibilityOptions(cached));
          return;
        }
        queue.enqueue(productId, (storeId, err) => {
          if (err) {
            console.warn(`content-search: storeId解決に失敗しました productId=${productId}`, err);
            return;
          }
          storeIdByProductId.set(productId, storeId);
          applyVisibility(wrapper, isBlocked(storeId), buildVisibilityOptions(storeId));
        });
      });
    }

    function scan(root) {
      for (const link of root.querySelectorAll(CARD_SELECTOR)) handleCard(link);
    }

    async function start() {
      blockedStores = await storage.getBlockedStores();
      displayMode = await storage.getDisplayMode();
      scan(doc);

      const observer = new MutationObserver(() => scan(doc));
      observer.observe(doc.body, { childList: true, subtree: true });

      storage.onBlockedStoresChanged((next) => {
        blockedStores = next;
        for (const productId of storeIdByProductId.keys()) applyKnown(productId);
      });

      storage.onDisplayModeChanged((next) => {
        displayMode = next;
        for (const productId of storeIdByProductId.keys()) applyKnown(productId);
      });
    }

    return { start, scan };
  }

  return { extractProductId, findWrapper, applyVisibility, createResolveQueue, init };
})();

CB_SEARCH.init().start();
