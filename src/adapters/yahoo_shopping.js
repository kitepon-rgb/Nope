// Yahoo!ショッピング 検索結果アダプタ（パターンA: DOM から発信元ID を直接取得）。
// 根拠: docs/survey/ec-sites.md（nagi 実地調査 2026-08-11）・docs/design-site-adapter.md（tsumugi 設計）。
// 検索結果直下の商品カード内の store.shopping.yahoo.co.jp リンクから storeId を取得する。
// CSS Modules ハッシュ付きセレクタの壊れを検知するために、スキャン時に0件なら console.warn を出す。

'use strict';

const YAHOO_SHOPPING_ADAPTER = {
  siteKey: 'yahoo_shopping',
  matches: ['*://shopping.yahoo.co.jp/*'],

  // CSS Modules ハッシュ付き（例: SearchResult_SearchResultItem__mJ7vY）。
  // 子要素も同じ class 接頭辞を使うため、検索結果コンテナの直下だけを商品カードとして拾う。
  // 0件時は CB_SEARCH エンジンが warn を出すのが contract（§4-2 design-site-adapter.md）。
  cardSelector: 'div[class*="SearchResult_SearchResult__"] > div[class^="SearchResult_SearchResultItem__"]',

  // カード自体が親 display:flex のフレックスアイテムなので card === wrapper。
  getWrapper: (card) => card,

  resolver: {
    type: 'dom_id',

    /**
     * カードから発信元 ID と表示名を取得する。
     * 広告カード（store.shopping.yahoo.co.jp 直リンクなし）は null を返す。
     * @param {Element} card 検索結果直下の商品カード要素
     * @returns {{ sourceId: string, sourceName: string } | null}
     */
    getSource(card) {
      // 有機検索カードには store.shopping.yahoo.co.jp/{storeId}/{item}.html への直リンクがある。
      // 広告カードは shopping-item-reach.yahoo.co.jp/v1/click 経由のみで直リンクなし → null を返す。
      const links = Array.from(card.querySelectorAll('a[href^="https://store.shopping.yahoo.co.jp/"]'));
      const a = links[0];
      if (!a) return null;
      const m = /store\.shopping\.yahoo\.co\.jp\/([^\/]+)\//.exec(a.href);
      if (!m) return null;
      const sourceId = m[1];
      // 商品画像・商品名リンクも同じストアドメインを指す。表示名は /{storeId}/ の
      // ストアホームリンクから取得し、見つからない場合だけ ID を表示名にする。
      const storeHome = links.find((link) => {
        try {
          return new URL(link.href).pathname === `/${sourceId}/`;
        } catch {
          return false;
        }
      });
      const sourceName = storeHome?.textContent.trim() || sourceId;
      if (!sourceId) return null;
      return { sourceId, sourceName };
      // 実測例: { sourceId: 'smahoservic', sourceName: 'L&Lスマホサービス' }
    },
    register: { entityLabel: 'ショップ' },
  },
};

// ブラウザ環境で CB_SEARCH エンジンが読み込まれていれば自動起動する。
if (typeof CB_SEARCH !== 'undefined') {
  CB_SEARCH.init({ adapter: YAHOO_SHOPPING_ADAPTER }).start();
}
