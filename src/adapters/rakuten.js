// 楽天市場 検索結果アダプタ（パターンA: DOM から発信元ID を直接取得）。
// 根拠: docs/survey/ec-sites.md（nagi 実地調査 2026-08-11）・docs/design-site-adapter.md（tsumugi 設計）。
// カード .dui-card 内の a[href^="https://www.rakuten.co.jp/"][href$="/"] から shopSlug と店舗名を取得する。
// 拡張が content-search.js の CB_SEARCH エンジンと連結されている場合は自動起動する。

'use strict';

const RAKUTEN_ADAPTER = {
  siteKey: 'rakuten',
  matches: ['*://search.rakuten.co.jp/*'],
  cardSelector: '.dui-card',

  // .dui-card 自体が親 display:grid のグリッドアイテムなので card === wrapper。
  getWrapper: (card) => card,

  resolver: {
    type: 'dom_id',

    /**
     * カードから発信元 ID と表示名を取得する。
     * @param {Element} card `.dui-card` 要素
     * @returns {{ sourceId: string, sourceName: string } | null}
     */
    getSource(card) {
      const a = card.querySelector('a[href^="https://www.rakuten.co.jp/"][href$="/"]');
      if (!a) return null;
      const m = /rakuten\.co\.jp\/([^\/]+)\//.exec(a.href);
      if (!m) return null;
      const sourceId = m[1];
      const sourceName = a.textContent.trim();
      if (!sourceId) return null;
      return { sourceId, sourceName };
      // 実測例: { sourceId: 'aidort', sourceName: '愛度楽天市場店' }
    },
  },
};

// ブラウザ環境で CB_SEARCH エンジンが読み込まれていれば自動起動する。
if (typeof CB_SEARCH !== 'undefined') {
  CB_SEARCH.init({ adapter: RAKUTEN_ADAPTER }).start();
}
