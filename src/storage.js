// Nope — ストレージ層。
// blocklist は端末間で同期したいので chrome.storage.sync、
// itemId→sourceId の解決キャッシュは容量が大きく端末固有でよいので chrome.storage.local に置く。
// sourceAlias（生ID→正本ID。例: YouTubeのhandle→チャンネルID）は blocklist と同じく
// 端末間で共有すべき正規データなので chrome.storage.sync に置く（room裁定2026-08-11、[51]）。
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

  async function setCachedSource(siteKey, itemId, sourceId, sourceName) {
    const { itemSourceCache } = await chrome.storage.local.get({ itemSourceCache: {} });
    // 発信元名まで解決できたアダプタ（Amazon等）は、登録ボタンがcache命中時にも
    // 正しい名称を保存できるようobjectで保持する。従来のID-only cache（AliExpress等）は
    // stringのまま維持し、既存データとの後方互換を保つ。
    itemSourceCache[`${siteKey}:${itemId}`] = sourceName
      ? { sourceId, sourceName }
      : sourceId;
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

  // sourceAlias: 生ID（例: YouTubeのhandle '@xxx'）→ 正本ID（例: チャンネルID 'UCxxx'）の対応。
  // blockedSourcesと同じくchrome.storage.syncに置き、端末間で共有する。
  // 解決（fetch等でaliasを知る操作）自体はここでは行わない——呼び出し側の責務。
  async function getSourceAliases(siteKey) {
    const { sourceAliases } = await chrome.storage.sync.get({ sourceAliases: {} });
    return sourceAliases[siteKey] ?? {};
  }

  async function setSourceAlias(siteKey, rawId, canonicalId) {
    const { sourceAliases } = await chrome.storage.sync.get({ sourceAliases: {} });
    if (!sourceAliases[siteKey]) sourceAliases[siteKey] = {};
    sourceAliases[siteKey][rawId] = canonicalId;
    await chrome.storage.sync.set({ sourceAliases });
    return sourceAliases[siteKey];
  }

  // sourceAliases[siteKey] の変更を購読する（他端末からの同期・同一端末内の別カードでの解決を反映）。
  function onSourceAliasesChanged(siteKey, listener) {
    const wrapped = (changes, area) => {
      if (area !== 'sync' || !changes.sourceAliases) return;
      const oldSite = changes.sourceAliases.oldValue?.[siteKey] ?? {};
      const newSite = changes.sourceAliases.newValue?.[siteKey] ?? {};
      if (JSON.stringify(oldSite) !== JSON.stringify(newSite)) listener(newSite);
    };
    chrome.storage.onChanged.addListener(wrapped);
    return () => chrome.storage.onChanged.removeListener(wrapped);
  }

  // すべてのサイトのブロックリストを一括取得する（popup のサイト別描画用）。
  async function getAllBlockedSources() {
    const { blockedSources } = await chrome.storage.sync.get({ blockedSources: {} });
    return blockedSources;
  }

  // キーワードブロック（yahoo_news / yahoo_japan 対象）。
  // chrome.storage.sync に blockedKeywords.{siteKey}: string[] で保存する。
  async function getBlockedKeywords(siteKey) {
    const { blockedKeywords } = await chrome.storage.sync.get({ blockedKeywords: {} });
    return blockedKeywords[siteKey] ?? [];
  }

  async function addBlockedKeyword(siteKey, keyword) {
    const trimmed = String(keyword).trim();
    if (!trimmed) return getBlockedKeywords(siteKey);
    const { blockedKeywords } = await chrome.storage.sync.get({ blockedKeywords: {} });
    if (!blockedKeywords[siteKey]) blockedKeywords[siteKey] = [];
    if (blockedKeywords[siteKey].includes(trimmed)) return blockedKeywords[siteKey];
    blockedKeywords[siteKey].push(trimmed);
    await chrome.storage.sync.set({ blockedKeywords });
    return blockedKeywords[siteKey];
  }

  async function removeBlockedKeyword(siteKey, keyword) {
    const { blockedKeywords } = await chrome.storage.sync.get({ blockedKeywords: {} });
    if (blockedKeywords[siteKey]) {
      blockedKeywords[siteKey] = blockedKeywords[siteKey].filter((k) => k !== keyword);
    }
    await chrome.storage.sync.set({ blockedKeywords });
    return blockedKeywords[siteKey] ?? [];
  }

  function onBlockedKeywordsChanged(siteKey, listener) {
    const wrapped = (changes, area) => {
      if (area !== 'sync' || !changes.blockedKeywords) return;
      const oldSite = changes.blockedKeywords.oldValue?.[siteKey] ?? [];
      const newSite = changes.blockedKeywords.newValue?.[siteKey] ?? [];
      if (JSON.stringify(oldSite) !== JSON.stringify(newSite)) listener(newSite);
    };
    chrome.storage.onChanged.addListener(wrapped);
    return () => chrome.storage.onChanged.removeListener(wrapped);
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
    getBlockedSources, addBlockedSource, removeBlockedSource, getAllBlockedSources,
    getCachedSource, setCachedSource, clearCache, onBlockedSourcesChanged,
    getSourceAliases, setSourceAlias, onSourceAliasesChanged,
    getBlockedKeywords, addBlockedKeyword, removeBlockedKeyword, onBlockedKeywordsChanged,
    getDisplayMode, setDisplayMode, onDisplayModeChanged,
  };
})();
