// Nope — ストレージ層。
// blocklist は端末間で同期したいので chrome.storage.sync、
// itemId→sourceId の解決キャッシュは容量が大きく端末固有でよいので chrome.storage.local に置く。
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

  async function getBlockedSources(siteKey) {
    const { blockedSources } = await chrome.storage.sync.get({ blockedSources: {} });
    return blockedSources[siteKey] ?? {};
  }

  async function addBlockedSource(siteKey, sourceId, name, nameOnly) {
    const { blockedSources } = await chrome.storage.sync.get({ blockedSources: {} });
    if (!blockedSources[siteKey]) blockedSources[siteKey] = {};
    const entry = { name: String(name || `source:${sourceId}`), addedAt: Date.now() };
    if (nameOnly) entry.nameOnly = true;
    blockedSources[siteKey][sourceId] = entry;
    await chrome.storage.sync.set({ blockedSources });
    return blockedSources[siteKey];
  }

  async function removeBlockedSource(siteKey, sourceId) {
    const { blockedSources } = await chrome.storage.sync.get({ blockedSources: {} });
    if (blockedSources[siteKey]) {
      delete blockedSources[siteKey][sourceId];
    }
    await chrome.storage.sync.set({ blockedSources });
    return blockedSources[siteKey] ?? {};
  }

  async function getCachedSource(siteKey, itemId) {
    const { itemSourceCache } = await chrome.storage.local.get({ itemSourceCache: {} });
    return itemSourceCache[`${siteKey}:${itemId}`] ?? null;
  }

  async function setCachedSource(siteKey, itemId, sourceId) {
    const { itemSourceCache } = await chrome.storage.local.get({ itemSourceCache: {} });
    itemSourceCache[`${siteKey}:${itemId}`] = sourceId;
    // 挿入順 = Object.keys 順を利用して古いものから削る。
    const keys = Object.keys(itemSourceCache);
    if (keys.length > CACHE_LIMIT) {
      for (const key of keys.slice(0, keys.length - CACHE_LIMIT)) delete itemSourceCache[key];
    }
    await chrome.storage.local.set({ itemSourceCache });
  }

  async function clearCache() {
    await chrome.storage.local.remove('itemSourceCache');
  }

  // blockedSources[siteKey] の変更を購読する（検索ページの即時再適用用）。解除関数を返す。
  // 対象 siteKey のエントリが変化した時だけリスナーを呼ぶ（他サイトの変更では発火しない）。
  function onBlockedSourcesChanged(siteKey, listener) {
    const wrapped = (changes, area) => {
      if (area !== 'sync' || !changes.blockedSources) return;
      const oldSite = changes.blockedSources.oldValue?.[siteKey];
      const newSite = changes.blockedSources.newValue?.[siteKey] ?? {};
      if (JSON.stringify(oldSite ?? {}) !== JSON.stringify(newSite)) listener(newSite);
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
    getBlockedSources, addBlockedSource, removeBlockedSource,
    getCachedSource, setCachedSource, clearCache, onBlockedSourcesChanged,
    getDisplayMode, setDisplayMode, onDisplayModeChanged,
  };
})();
