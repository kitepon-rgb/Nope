// AliExpress 検索結果ページで、ブロック済みストアの商品カードを displayMode に応じて2モードで処理する。
// 実証済み: カードは a.search-card-item、href の /item/(\d+)\.html から productId。
// カード自体にストア情報は無いため productId→storeId は CB_MTOP.resolveStoreId（cache優先）で解決する。
// 外側ラッパ（[class*="search-item-card-wrapper"] → .card-out-wrapper → parentElement の優先順で探索）を対象に、
// placeholder モード（既定）では中身をマスコット画像（assets/mascot-blocked.png、chrome.runtime.getURL経由で
// 拡張同梱リソースとして参照。web_accessible_resourcesへの登録が必要）を使ったプレースホルダーへ差し替え、
// collapse モードでは wrapper ごと display:none で完全に消す（displayMode は CB_STORAGE 経由で購読・即時再適用）。
// mtop への同時リクエストは 2 並列・間隔300ms に抑える（サーバ負荷/bot対策への配慮）。
// MutationObserver で無限スクロールと SPA 遷移に追従し、blockedSources/displayMode の onChanged で即時再適用する。
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

  // オーナー確定のマスコット画像（assets/mascot-source.pngをカード表示サイズへリサイズ済み）。
  // 拡張同梱リソースを chrome.runtime.getURL() 経由で参照する（外部URL禁止）。
  const MASCOT_IMAGE_PATH = 'assets/mascot-blocked.png';
  const MASCOT_DISPLAY_SIZE = 120;

  // kitepon.dev ブランド正典（color-system.md）の適用値。
  const COLOR_ORANGE = '#ef8d32'; // Discovery Orange: 枠・識別色
  const COLOR_ORANGE_DEEP = '#a84400'; // Deep Orange: 11px以下のlabel・解除ボタン文字
  const COLOR_INK = '#111b35'; // Ink: 本文（ストア名）
  const COLOR_WHITE = '#fffef9'; // White: card背景

  /** @returns {string} 拡張同梱のマスコット画像URL（chrome.runtime.getURL経由） */
  function getMascotImageUrl() {
    return chrome.runtime.getURL(MASCOT_IMAGE_PATH);
  }

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

  /** @param {string} [sourceName] @param {Function} [onUnblock] @returns {any} */
  function buildPlaceholderElement(sourceName, onUnblock) {
    const el = document.createElement('div');
    el.className = PLACEHOLDER_CLASS;
    Object.assign(el.style, {
      minHeight: '220px', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '12px', textAlign: 'center',
      backgroundColor: COLOR_WHITE, border: `1px solid ${COLOR_ORANGE}`,
      borderRadius: '8px', boxSizing: 'border-box',
    });

    const art = document.createElement('img');
    art.src = getMascotImageUrl();
    art.width = MASCOT_DISPLAY_SIZE;
    art.height = MASCOT_DISPLAY_SIZE;
    art.alt = ''; // 情報はlabel/ストア名側で伝えるため装飾画像として扱う
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
      nameEl.textContent = sourceName; // XSS防止のためtextContentで入れる（innerHTMLに混ぜない）
      Object.assign(nameEl.style, { color: COLOR_INK, margin: '4px 0 0' });
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

  /** @param {any} wrapper @param {string} [sourceName] @param {Function} [onUnblock] */
  function insertPlaceholder(wrapper, sourceName, onUnblock) {
    if (wrapper.querySelector && wrapper.querySelector(`.${PLACEHOLDER_CLASS}`)) return; // 二重挿入防止
    hideOriginalChildren(wrapper);
    const placeholder = buildPlaceholderElement(sourceName, onUnblock);
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

  // itemId→sourceId 解決を 2並列・間隔300msに抑えるキュー。
  // resolveStoreId は注入可能にして純粋にテストできるようにする。
  /** @param {{resolveStoreId: Function, concurrency?: number, intervalMs?: number, onIdle?: Function}} options */
  function createResolveQueue({ resolveStoreId, concurrency = CONCURRENCY, intervalMs = INTERVAL_MS, onIdle }) {
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
          else if (active === 0 && onIdle) onIdle();
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

  // AliExpress アダプタ（パターンC: 非同期解決）。
  // cardSelector は manifest.json content_scripts.matches に対応する面のカード要素。
  const ALIEXPRESS_ADAPTER = {
    siteKey: 'aliexpress',
    cardSelector: CARD_SELECTOR,
    getWrapper: (card) => findWrapper(card),
    resolver: {
      type: 'async_resolve',
      getItemId: (card) => extractProductId(card.getAttribute ? card.getAttribute('href') : card.href),
    },
  };

  /** @param {{document?: any, storage?: any, mtop?: any, adapter?: any}} [deps] */
  function init(deps) {
    const doc = (deps && deps.document) || document;
    const storage = (deps && deps.storage) || CB_STORAGE;
    const adapter = (deps && deps.adapter) || ALIEXPRESS_ADAPTER;
    const { siteKey, cardSelector, getWrapper, resolver } = adapter;
    if (!resolver || !['dom_id', 'async_resolve'].includes(resolver.type)) {
      throw new Error(`content-search: 未対応のresolver.typeです siteKey=${siteKey} type=${resolver && resolver.type}`);
    }

    const wrapperByItemId = new Map();
    const sourceIdByItemId = new Map();
    const directCardInfo = new Map();
    let blockedSources = {};
    let displayMode = DEFAULT_MODE;
    let resolvedSourceCount = 0;
    let noSourceCount = 0;
    let noSourceWarningSent = false;

    function warnIfAllSourcesMissing() {
      const policy = resolver.noSourceWarning;
      if (!policy || noSourceWarningSent || resolvedSourceCount > 0) return;
      const minimum = Number.isInteger(policy.minAttempts) ? policy.minAttempts : 1;
      if (noSourceCount < minimum) return;
      noSourceWarningSent = true;
      console.warn(
        `${policy.message || 'content-search: source不在が全件で続いています。resolver構造変更の可能性があります'} `
        + `siteKey=${siteKey} noSource=${noSourceCount} resolved=${resolvedSourceCount}`
      );
    }

    let queue = null;
    if (resolver.type === 'async_resolve') {
      let resolveSource;
      if (typeof resolver.resolveSource === 'function') {
        resolveSource = async (itemId) => {
          const source = await resolver.resolveSource(itemId);
          // nullはadapterが明示した「このitemに発信元が存在しない」という正常系。
          // undefinedやsourceId欠落は契約違反なので従来どおりthrowして個別warnへ送る。
          if (source === null) return null;
          if (!source || !source.sourceId) {
            throw new Error(`content-search: resolverがsourceIdを返しませんでした siteKey=${siteKey} itemId=${itemId}`);
          }
          await storage.setCachedSource(siteKey, itemId, source.sourceId);
          return source;
        };
      } else {
        // AliExpressだけは既存のCB_MTOPが解決とキャッシュ保存を担当する。
        const mtop = (deps && deps.mtop) || CB_MTOP;
        resolveSource = async (itemId) => {
          const sourceId = await mtop.resolveStoreId(itemId);
          if (!sourceId) {
            throw new Error(`content-search: mtopがsourceIdを返しませんでした siteKey=${siteKey} itemId=${itemId}`);
          }
          return { sourceId, sourceName: '' };
        };
      }
      queue = createResolveQueue({ resolveStoreId: resolveSource, onIdle: warnIfAllSourcesMissing });
    }

    function isBlocked(sourceId) {
      return !!blockedSources[sourceId];
    }

    /** @param {string} sourceId @param {string} [sourceName] @returns {{mode: string, storeName: string, onUnblock: Function}} */
    function buildVisibilityOptions(sourceId, sourceName) {
      const info = blockedSources[sourceId];
      return {
        mode: displayMode,
        storeName: info ? info.name : (sourceName || ''),
        onUnblock: () => storage.removeBlockedSource(siteKey, sourceId),
      };
    }

    function applyKnown(itemId) {
      const sourceId = sourceIdByItemId.get(itemId);
      const wrapper = wrapperByItemId.get(itemId);
      if (sourceId && wrapper) applyVisibility(wrapper, isBlocked(sourceId), buildVisibilityOptions(sourceId));
    }

    function applyDirectCard(card) {
      const info = directCardInfo.get(card);
      if (!info) return;
      applyVisibility(
        info.wrapper,
        isBlocked(info.sourceId),
        buildVisibilityOptions(info.sourceId, info.sourceName),
      );
    }

    function handleDirectCard(card) {
      if (directCardInfo.has(card)) return;
      const source = resolver.getSource(card);
      if (!source) return;
      const wrapper = getWrapper(card);
      if (!wrapper) return;
      directCardInfo.set(card, { ...source, wrapper });
      applyDirectCard(card);
    }

    function handleAsyncCard(card) {
      const itemId = resolver.getItemId(card);
      if (!itemId || wrapperByItemId.has(itemId)) return;
      const wrapper = getWrapper(card);
      wrapperByItemId.set(itemId, wrapper);

      storage.getCachedSource(siteKey, itemId).then((cached) => {
        if (cached) {
          sourceIdByItemId.set(itemId, cached);
          applyVisibility(wrapper, isBlocked(cached), buildVisibilityOptions(cached));
          return;
        }
        queue.enqueue(itemId, (source, err) => {
          if (err) {
            console.warn(`content-search: sourceId解決に失敗しました siteKey=${siteKey} itemId=${itemId}`, err);
            return;
          }
          if (source === null) {
            noSourceCount += 1;
            return;
          }
          resolvedSourceCount += 1;
          const { sourceId, sourceName } = source;
          sourceIdByItemId.set(itemId, sourceId);
          applyVisibility(wrapper, isBlocked(sourceId), buildVisibilityOptions(sourceId, sourceName));
        });
      });
    }

    function scan(root) {
      const handleCard = resolver.type === 'dom_id' ? handleDirectCard : handleAsyncCard;
      for (const card of root.querySelectorAll(cardSelector)) handleCard(card);
    }

    async function start() {
      blockedSources = await storage.getBlockedSources(siteKey);
      displayMode = await storage.getDisplayMode();
      scan(doc);

      const observer = new MutationObserver(() => scan(doc));
      observer.observe(doc.body, { childList: true, subtree: true });

      storage.onBlockedSourcesChanged(siteKey, (next) => {
        blockedSources = next;
        for (const itemId of sourceIdByItemId.keys()) applyKnown(itemId);
        for (const card of directCardInfo.keys()) applyDirectCard(card);
      });

      storage.onDisplayModeChanged((next) => {
        displayMode = next;
        for (const itemId of sourceIdByItemId.keys()) applyKnown(itemId);
        for (const card of directCardInfo.keys()) applyDirectCard(card);
      });
    }

    return { start, scan };
  }

  return { extractProductId, findWrapper, applyVisibility, createResolveQueue, init };
})();
