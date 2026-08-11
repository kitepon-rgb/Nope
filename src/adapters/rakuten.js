// 楽天市場 検索結果アダプタ（パターンA: DOM から発信元ID を直接取得）。
// 根拠: docs/survey/ec-sites.md（nagi 実地調査 2026-08-11）・docs/design-site-adapter.md（tsumugi 設計）。
// カード .dui-card の data-shop-id と .content.merchant からショップID・店舗名を取得する。
// CPC広告カードはショップリンクが grp*.ias.rakuten.co.jp の追跡URLへ変換されるため、
// 通常カードとCPCカードに共通する data-shop-id を正本IDとして使う（実Chrome実測 2026-08-12）。
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
      const sourceId = card.getAttribute('data-shop-id');
      if (!sourceId) return null;
      const merchant = card.querySelector('.content.merchant');
      const sourceName = (merchant && merchant.textContent.trim()) || sourceId;
      return { sourceId, sourceName };
      // 実測例: { sourceId: '299852', sourceName: 'スマホメモリ専門スターフォーカス' }
    },
    register: { entityLabel: 'ショップ' },
  },
};

// ブラウザ環境で CB_SEARCH エンジンが読み込まれていれば自動起動する。
if (typeof CB_SEARCH !== 'undefined') {
  CB_SEARCH.init({ adapter: RAKUTEN_ADAPTER }).start();
}
