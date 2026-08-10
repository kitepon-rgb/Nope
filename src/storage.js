// Nope — ストレージ層。
// blocklist は端末間で同期したいので chrome.storage.sync、
// productId→storeId の解決キャッシュは容量が大きく端末固有でよいので chrome.storage.local に置く。
// content script 群から <script> 連結で読み込まれる前提のグローバル公開（ビルド工程なし・MV3 content_scripts）。

'use strict';

const CB_STORAGE = (() => {
  const CACHE_LIMIT = 5000;
  const DEFAULT_DISPLAY_MODE = 'placeholder';
  const ALLOWED_DISPLAY_MODES = ['placeholder', 'collapse'];

  /** 不明値は既定 'placeholder' 扱いにするが黙って通さずconsole.warnする。 @param {string} mode */
  function normalizeDisplayMode(mode) {
    if (ALLOWED_DISPLAY_MODES.includes(mode)) return mode;
    console.warn(`storage: 不明なdisplayModeを既定値へフォールバックします value=${mode}`);
    return DEFAULT_DISPLAY_MODE;
  }

  async function getBlockedStores() {
    const { blockedStores } = await chrome.storage.sync.get({ blockedStores: {} });
    return blockedStores;
  }

  async function addBlockedStore(storeId, name) {
    if (!/^\d+$/.test(String(storeId))) throw new Error(`storeId が数値ではありません: ${storeId}`);
    const blockedStores = await getBlockedStores();
    blockedStores[storeId] = { name: String(name || `store:${storeId}`), addedAt: Date.now() };
    await chrome.storage.sync.set({ blockedStores });
    return blockedStores;
  }

  async function removeBlockedStore(storeId) {
    const blockedStores = await getBlockedStores();
    delete blockedStores[storeId];
    await chrome.storage.sync.set({ blockedStores });
    return blockedStores;
  }

  async function getCachedStore(productId) {
    const { productStoreCache } = await chrome.storage.local.get({ productStoreCache: {} });
    return productStoreCache[productId] ?? null;
  }

  async function setCachedStore(productId, storeId) {
    const { productStoreCache } = await chrome.storage.local.get({ productStoreCache: {} });
    productStoreCache[productId] = storeId;
    // 挿入順 = Object.keys 順を利用して古いものから削る。
    const keys = Object.keys(productStoreCache);
    if (keys.length > CACHE_LIMIT) {
      for (const key of keys.slice(0, keys.length - CACHE_LIMIT)) delete productStoreCache[key];
    }
    await chrome.storage.local.set({ productStoreCache });
  }

  async function clearCache() {
    await chrome.storage.local.remove('productStoreCache');
  }

  // blockedStores の変更を購読する（検索ページの即時再適用用）。解除関数を返す。
  function onBlockedStoresChanged(listener) {
    const wrapped = (changes, area) => {
      if (area === 'sync' && changes.blockedStores) listener(changes.blockedStores.newValue ?? {});
    };
    chrome.storage.onChanged.addListener(wrapped);
    return () => chrome.storage.onChanged.removeListener(wrapped);
  }

  async function getDisplayMode() {
    const { displayMode } = await chrome.storage.sync.get({ displayMode: DEFAULT_DISPLAY_MODE });
    return normalizeDisplayMode(displayMode);
  }

  async function setDisplayMode(mode) {
    const normalized = normalizeDisplayMode(mode);
    await chrome.storage.sync.set({ displayMode: normalized });
    return normalized;
  }

  // displayMode の変更を購読する（検索ページの即時再適用用）。解除関数を返す。
  function onDisplayModeChanged(listener) {
    const wrapped = (changes, area) => {
      if (area === 'sync' && changes.displayMode) listener(normalizeDisplayMode(changes.displayMode.newValue));
    };
    chrome.storage.onChanged.addListener(wrapped);
    return () => chrome.storage.onChanged.removeListener(wrapped);
  }

  return {
    getBlockedStores, addBlockedStore, removeBlockedStore,
    getCachedStore, setCachedStore, clearCache, onBlockedStoresChanged,
    getDisplayMode, setDisplayMode, onDisplayModeChanged,
  };
})();
