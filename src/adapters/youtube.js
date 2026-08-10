// YouTube 検索結果アダプタ（パターンA: DOM から発信元ID を直接取得）。
// 根拠: docs/survey/media-sites.md（shiho 実地調査 2026-08-11）・docs/design-site-adapter.md（tsumugi 設計）。
// カード ytd-video-renderer 内の a[href*="/@"] または a[href*="/channel/"] からチャンネル識別子を取得する。
//
// 【handle/UC 2形式の方針（v1 決定・design-site-adapter.md §3-3）】
//   取れた形式をそのまま保存・照合する（正規化しない）。
//   handle 形式: '/@MagicClub686' → sourceId = '@MagicClub686'（@ 付き）
//   UC 形式    : '/channel/UCxxxxxx' → sourceId = 'UCxxxxxx'
//
// 【実測（nagi 2026-08-11）】
//   検索結果 23件中、handle 形式 11件・UC 形式 12件が混在。
//   同一チャンネルが両形式で出たケース: 0件。
//   各チャンネルは一方の形式のみで出た（YouTube が形式を決定する）。
//
// SPA・無限スクロール: MutationObserver 追従は CB_SEARCH エンジンが担当（shadow DOM なし・実測確認済み）。

'use strict';

const YOUTUBE_ADAPTER = {
  siteKey: 'youtube',
  matches: ['*://www.youtube.com/*'],

  // 検索結果のカード要素。Shadow DOM なし（実測確認）。
  cardSelector: 'ytd-video-renderer',

  // ytd-video-renderer 自体が block 要素で、display:none で空間が詰まる（実測確認）。
  getWrapper: (card) => card,

  resolver: {
    type: 'dom_id',

    /**
     * カードからチャンネル識別子と表示名を取得する。
     * @param {Element} card `ytd-video-renderer` 要素
     * @returns {{ sourceId: string, sourceName: string } | null}
     */
    getSource(card) {
      // handle 形式を優先（より新しい形式）。
      const handleLink = card.querySelector('a[href*="/@"]');
      if (handleLink) {
        const href = handleLink.getAttribute('href') || '';
        const m = /^\/@([^/?#]+)/.exec(href);
        if (m) {
          return {
            sourceId: `@${m[1]}`,
            sourceName: handleLink.textContent.trim(),
          };
          // 実測例: { sourceId: '@MagicClub686', sourceName: 'Magic Club' }
        }
      }

      // UC 形式にフォールバック。
      const channelLink = card.querySelector('a[href*="/channel/"]');
      if (channelLink) {
        const href = channelLink.getAttribute('href') || '';
        const m = /\/channel\/(UC[^/?#]+)/.exec(href);
        if (m) {
          return {
            sourceId: m[1],
            sourceName: channelLink.textContent.trim(),
          };
          // 実測例: { sourceId: 'UCMJEnW8naproLde7E2GInhw', sourceName: 'MELLOW SPOT' }
        }
      }

      return null;
    },
  },
};

// ブラウザ環境で CB_SEARCH エンジンが読み込まれていれば自動起動する。
if (typeof CB_SEARCH !== 'undefined') {
  CB_SEARCH.init({ adapter: YOUTUBE_ADAPTER }).start();
}
