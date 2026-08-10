# v5-adapter-resolve 完了エビデンス

- worker: sumire
- date: 2026-08-11

## 成果物

| ファイル | 内容 |
|---------|------|
| `src/adapters/yahoo_auction.js` | Yahoo Auction Pattern C アダプタ |
| `src/adapters/amazon.js` | Amazon Pattern C アダプタ |
| `test/adapters/yahoo_auction.test.mjs` | Yahoo Auction テスト（11件） |
| `test/adapters/amazon.test.mjs` | Amazon テスト（12件） |

## fetch 実測結果（agent-browser 2026-08-11）

**Yahoo Auction**: `https://auctions.yahoo.co.jp/jp/auction/{auctionId}` を fetch → SSR HTML に `/seller/{id}` href あり。CORS・bot対策なし（同一オリジン）。実測: auctionId=q1240291994 → sellerId=DFvUrXQ8JX9MobKNnv8hnSWJXVbzj / sellerName=goanshinkudasai

**Amazon**: `https://www.amazon.co.jp/dp/{asin}` を fetch → 静的 HTML に `&amp;seller={id}` と `id="sellerProfileTriggerId"` アンカーあり。CORS・bot対策なし（同一オリジン）。実測: asin=B0CT857V89 → sellerId=A3EMK34PT3V85P / sellerName=HK-JIMI

## テスト結果

```
node --test test/*.test.mjs test/adapters/*.test.mjs
tests 165 / pass 165 / fail 0
```

## 発見事項（二重起動設計問題）

`content-search.js` 307行目の `CB_SEARCH.init().start()` が全サイトで AliExpress エンジンを起動する。manifest.json の各サイトエントリは `content-search.js` を共通で読み込むため、非 AliExpress サイトで不要な MutationObserver が走る。v5 アダプタは rakuten.js と同じパターンを踏襲。現時点では manifest.json に yahoo_auction・amazon のエントリ未追加のため実害なし。修正案を room で tsumugi・shiho へ報告済み。
