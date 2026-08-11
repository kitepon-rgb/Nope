// Yahoo!ショッピング 検索結果アダプタ（パターンA: DOM から発信元ID を直接取得）。
// 根拠: docs/survey/ec-sites.md（nagi 実地調査 2026-08-11）・docs/design-site-adapter.md（tsumugi 設計）。
// カード div[class*="SearchResult_SearchResultItem"] 内の store.shopping.yahoo.co.jp リンクから storeId を取得する。
// CSS Modules ハッシュ付きセレクタの壊れを検知するために、スキャン時に0件なら console.warn を出す。

'use strict';

const YAHOO_SHOPPING_ADAPTER = {
  siteKey: 'yahoo_shopping',
  matches: ['*://shopping.yahoo.co.jp/*'],

  // CSS Modules ハッシュ付き（例: SearchResult_SearchResultItem__mJ7vY）。
  // サイト側ビルドで変わりうるため部分一致 class*= で拾う。
  // 0件時は CB_SEARCH エンジンが warn を出すのが contract（§4-2 design-site-adapter.md）。
  cardSelector: 'div[class*="SearchResult_SearchResultItem"]',

  // カード自体が親 display:flex のフレックスアイテムなので card === wrapper。
  getWrapper: (card) => card,

  resolver: {
    type: 'dom_id',

    /**
     * カードから発信元 ID と表示名を取得する。
     * 広告カード（store.shopping.yahoo.co.jp 直リンクなし）は null を返す。
     * @param {Element} card `div[class*="SearchResult_SearchResultItem"]` 要素
     * @returns {{ sourceId: string, sourceName: string } | null}
     */
    getSource(card) {
      // 有機検索カードには store.shopping.yahoo.co.jp/{storeId}/{item}.html への直リンクがある。
      // 広告カードは shopping-item-reach.yahoo.co.jp/v1/click 経由のみで直リンクなし → null を返す。
      const a = card.querySelector('a[href^="https://store.shopping.yahoo.co.jp/"]');
      if (!a) return null;
      const m = /store\.shopping\.yahoo\.co\.jp\/([^\/]+)\//.exec(a.href);
      if (!m) return null;
      const sourceId = m[1];
      const sourceName = a.textContent.trim();
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
