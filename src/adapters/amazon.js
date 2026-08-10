// Amazon.co.jp 検索結果アダプタ（パターンC: 非同期解決）。
// 根拠: docs/survey/ec-sites.md（nagi 実地調査 2026-08-11）・docs/design-site-adapter.md（tsumugi 設計）。
// カード div[data-component-type="s-search-result"] の data-asin から ASIN を取得し、
// 商品詳細ページ（https://www.amazon.co.jp/dp/{asin}）を fetch して
// sellerId と sellerName を解決する。
// 実測（sumire 2026-08-11）:
//   - 検索カードに販売者情報は無い（a[href*="/seller/"] が0件）
//   - 詳細ページの CSR DOM には a[href*="seller="] がある（JS レンダリング後）
//   - fetch() の静的 HTML にも seller 情報が埋め込まれている（SSR コンポーネント混在）:
//     * href 属性内に &amp;seller={sellerId}&amp; の形で含まれる
//     * id="sellerProfileTriggerId" の anchor テキストが sellerName
//   - 例: sellerId=A3EMK34PT3V85P, sellerName=HK-JIMI（ASIN B0CT857V89）
//   - CORS・bot対策なし（同一 www.amazon.co.jp オリジン内 fetch のため）

'use strict';

const AMAZON_ADAPTER = {
  siteKey: 'amazon',
  matches: ['*://www.amazon.co.jp/*'],
  cardSelector: 'div[data-component-type="s-search-result"]',

  // カード自体が親 display:grid のグリッドアイテムなので card === wrapper。
  getWrapper: (card) => card,

  resolver: {
    type: 'async_resolve',

    /**
     * カードから ASIN を取得する。
     * @param {Element} card `div[data-component-type="s-search-result"]` 要素
     * @returns {string | null}
     */
    getItemId(card) {
      return card.getAttribute('data-asin') || null;
      // 実測例: 'B0CT857V89'
    },

    /**
     * 商品詳細ページを fetch して販売者 ID・名前を解決する。
     * 失敗は throw（静かなフォールバック禁止）。
     * @param {string} asin
     * @returns {Promise<{ sourceId: string, sourceName: string }>}
     */
    async resolveSource(asin) {
      const url = `https://www.amazon.co.jp/dp/${asin}`;
      let res;
      try {
        res = await fetch(url);
      } catch (err) {
        throw new Error(`amazon: fetch失敗 asin=${asin}: ${err && err.message}`);
      }
      if (!res.ok) {
        throw new Error(`amazon: HTTPエラー status=${res.status} asin=${asin}`);
      }
      const html = await res.text();

      // href 属性内に &amp;seller={id} の形で含まれる（SSR 確認済み）
      // &amp; は HTML エンティティとして埋め込まれているため ? や & ではなく &amp; でマッチ
      const idMatch = html.match(/(?:&amp;|[?&])seller=([A-Z0-9]+)/);
      if (!idMatch) {
        throw new Error(`amazon: seller ID が見つかりません asin=${asin}`);
      }
      const sourceId = idMatch[1];

      // id="sellerProfileTriggerId" のアンカーテキストが sellerName
      const nameMatch = html.match(/id=["']sellerProfileTriggerId["'][^>]*>([^<]+)</);
      const sourceName = nameMatch ? nameMatch[1].trim() : sourceId;

      return { sourceId, sourceName };
      // 実測例: { sourceId: 'A3EMK34PT3V85P', sourceName: 'HK-JIMI' }
    },
  },
};

// ブラウザ環境で CB_SEARCH エンジンが読み込まれていれば自動起動する。
if (typeof CB_SEARCH !== 'undefined') {
  CB_SEARCH.init({ adapter: AMAZON_ADAPTER }).start();
}
