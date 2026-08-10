// AliExpress 検索結果ページで、ブロック済みストアの商品カードを完全に非表示にする。
// 実証済み: カードは a.search-card-item、href の /item/(\d+)\.html から productId。
// カード自体にストア情報は無いため productId→storeId は CB_MTOP.resolveStoreId（cache優先）で解決する。
// 外側ラッパ（.card-out-wrapper を含むグリッドセル）ごと display:none で完全に消す（ユーザー裁定）。
// mtop への同時リクエストは 2 並列・間隔 300ms に抑える（サーバ負荷/bot対策への配慮）。
// MutationObserver で無限スクロールと SPA 遷移に追従し、blockedStores の onChanged で即時再適用する。
// 解決失敗カードは表示のままにし console.warn する（静かなフォールバック禁止＝黙って消さない）。
// CB_MD5・CB_STORAGE・CB_MTOP と同じく <script> 連結読み込み前提のグローバル公開（ビルド工程なし）。

'use strict';

const CB_SEARCH = (() => {
  const CARD_SELECTOR = 'a.search-card-item';
  const WRAPPER_SELECTOR = '.card-out-wrapper';
  const CONCURRENCY = 2;
  const INTERVAL_MS = 300;

  /** @param {string} href @returns {string|null} */
  function extractProductId(href) {
    const match = (href || '').match(/\/item\/(\d+)\.html/);
    return match ? match[1] : null;
  }

  /** @param {{closest?: Function, parentElement?: any}} link @returns {any} */
  function findWrapper(link) {
    const wrapper = link.closest && link.closest(WRAPPER_SELECTOR);
    return wrapper || link.parentElement || null;
  }

  /** @param {{style: {display: string}}} wrapper @param {boolean} blocked */
  function applyVisibility(wrapper, blocked) {
    if (!wrapper || !wrapper.style) return;
    wrapper.style.display = blocked ? 'none' : '';
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

    const queue = createResolveQueue({ resolveStoreId: (productId) => mtop.resolveStoreId(productId) });

    function isBlocked(storeId) {
      return !!blockedStores[storeId];
    }

    function applyKnown(productId) {
      const storeId = storeIdByProductId.get(productId);
      const wrapper = wrapperByProductId.get(productId);
      if (storeId && wrapper) applyVisibility(wrapper, isBlocked(storeId));
    }

    function handleCard(link) {
      const productId = extractProductId(link.getAttribute ? link.getAttribute('href') : link.href);
      if (!productId || wrapperByProductId.has(productId)) return;
      const wrapper = findWrapper(link);
      wrapperByProductId.set(productId, wrapper);

      storage.getCachedStore(productId).then((cached) => {
        if (cached) {
          storeIdByProductId.set(productId, cached);
          applyVisibility(wrapper, isBlocked(cached));
          return;
        }
        queue.enqueue(productId, (storeId, err) => {
          if (err) {
            console.warn(`content-search: storeId解決に失敗しました productId=${productId}`, err);
            return;
          }
          storeIdByProductId.set(productId, storeId);
          applyVisibility(wrapper, isBlocked(storeId));
        });
      });
    }

    function scan(root) {
      for (const link of root.querySelectorAll(CARD_SELECTOR)) handleCard(link);
    }

    async function start() {
      blockedStores = await storage.getBlockedStores();
      scan(doc);

      const observer = new MutationObserver(() => scan(doc));
      observer.observe(doc.body, { childList: true, subtree: true });

      storage.onBlockedStoresChanged((next) => {
        blockedStores = next;
        for (const productId of storeIdByProductId.keys()) applyKnown(productId);
      });
    }

    return { start, scan };
  }

  return { extractProductId, findWrapper, applyVisibility, createResolveQueue, init };
})();

CB_SEARCH.init().start();
