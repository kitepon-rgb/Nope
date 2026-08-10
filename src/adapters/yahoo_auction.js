// ヤフオク 検索結果アダプタ（パターンC: 非同期解決）。
// 根拠: docs/survey/ec-sites.md（nagi 実地調査 2026-08-11）・docs/design-site-adapter.md（tsumugi 設計）。
// カード li.Product の a[data-auction-id] からオークションIDを取得し、
// 詳細ページ（https://auctions.yahoo.co.jp/jp/auction/{id}）を fetch して
// a[href*="/seller/"] から sellerId と sellerName を解決する。
// 実測（sumire 2026-08-11）:
//   - 検索結果カードに出品者情報は無い（li.Product に seller 関連要素ゼロ）
//   - 詳細ページは SSR（fetch() でも /seller/{id} を含む HTML が返る）
//   - 例: /seller/DFvUrXQ8JX9MobKNnv8hnSWJXVbzj テキスト "goanshinkudasai"
//   - CORS・bot対策なし（同一 auctions.yahoo.co.jp オリジン内 fetch のため）

'use strict';

const YAHOO_AUCTIONS_ADAPTER = {
  siteKey: 'yahoo_auctions',
  matches: ['*://auctions.yahoo.co.jp/*'],
  cardSelector: 'li.Product',

  // li.Product 自体が親 display:flex のフレックスアイテムなので card === wrapper。
  getWrapper: (card) => card,

  resolver: {
    type: 'async_resolve',

    /**
     * カードからオークション ID を取得する。
     * @param {Element} card `li.Product` 要素
     * @returns {string | null}
     */
    getItemId(card) {
      const a = card.querySelector('a[data-auction-id]');
      return a ? a.getAttribute('data-auction-id') : null;
      // 実測例: 'q1240291994'
    },

    /**
     * オークション詳細ページを fetch して出品者 ID・名前を解決する。
     * 失敗は throw（静かなフォールバック禁止）。
     * @param {string} auctionId
     * @returns {Promise<{ sourceId: string, sourceName: string }>}
     */
    async resolveSource(auctionId) {
      const url = `https://auctions.yahoo.co.jp/jp/auction/${auctionId}`;
      let res;
      try {
        res = await fetch(url);
      } catch (err) {
        throw new Error(`yahoo_auction: fetch失敗 auctionId=${auctionId}: ${err && err.message}`);
      }
      if (!res.ok) {
        throw new Error(`yahoo_auction: HTTPエラー status=${res.status} auctionId=${auctionId}`);
      }
      const html = await res.text();

      // /seller/{sellerId} の形で href に埋め込まれている（SSR 確認済み）
      const idMatch = html.match(/\/seller\/([^"'?/\s]+)/);
      if (!idMatch) {
        throw new Error(`yahoo_auction: seller リンクが見つかりません auctionId=${auctionId}`);
      }
      const sourceId = idMatch[1];

      // seller リンクのアンカーテキストを seller 名として使う
      const nameMatch = html.match(/href="[^"]*\/seller\/[^"]*"[^>]*>([^<]+)</);
      const sourceName = nameMatch ? nameMatch[1].trim() : sourceId;

      return { sourceId, sourceName };
      // 実測例: { sourceId: 'DFvUrXQ8JX9MobKNnv8hnSWJXVbzj', sourceName: 'goanshinkudasai' }
    },
  },
};

// ブラウザ環境で CB_SEARCH エンジンが読み込まれていれば自動起動する。
if (typeof CB_SEARCH !== 'undefined') {
  CB_SEARCH.init({ adapter: YAHOO_AUCTIONS_ADAPTER }).start();
}
