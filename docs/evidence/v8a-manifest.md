# v8a-manifest: ヤフオク・Amazon登録エビデンス

- 日時: 2026-08-11
- 実装席: codex
- 対象: Pattern C（`yahoo_auctions` / `amazon`）

## 着手時の実測

- `web_accessible_resources.matches`には両サイトが既に登録済みだったため変更不要
- `content_scripts`には両サイトのentryが無かった
- `content-search.js`の`async_resolve`経路はAliExpress専用の`CB_MTOP`を無条件参照し、
  adapterの`resolver.resolveSource()`を呼ばなかった
- adapter解決結果を`itemSourceCache`へ保存する共通処理も無かった

entry追加だけでは両サイトで初期化時に失敗するため、Pattern C共通エンジンの接続も同じ受入単位で修正した。

## 実装

- `manifest.json`
  - ヤフオク: `storage.js → content-search.js → adapters/yahoo_auction.js`
  - Amazon: `storage.js → content-search.js → adapters/amazon.js`
  - 両entryとも`document_idle`
- `src/content-search.js`
  - adapterに`resolver.resolveSource`があればそれを使用
  - 解決結果の`sourceId`を`CB_STORAGE.setCachedSource(siteKey, itemId, sourceId)`で保存
  - `sourceId`欠落は例外にして静かに失敗させない
  - `resolveSource`を持たないAliExpressだけは既存の`CB_MTOP`経路を維持
- `test/content-search.test.mjs`
  - Pattern C adapterが`CB_MTOP`なしで解決・キャッシュ・ブロック判定できることを固定
  - 2サイトのmanifest読込順、`run_at`、画像公開先登録を固定

## 修正前の再現

- ヤフオクのcontent_scripts entry欠落
- Pattern C adapter初期化時に`CB_MTOP is not defined`

## 検証

- 共通エンジン・manifest: `node test/content-search.test.mjs` — 27/27 green
- ヤフオクadapter: `node test/adapters/yahoo_auction.test.mjs` — 11/11 green
- Amazon adapter: `node test/adapters/amazon.test.mjs` — 12/12 green
- 全体: `node --test test/*.test.mjs test/adapters/*.test.mjs` — 15 test files / 15 pass

## 未検証

実ブラウザでのヤフオク・Amazonのfetch、placeholder/collapse、解除、即時反映は本記録では未実施。
adapter単体のHTML fixtureと共通エンジン統合テストまでを確認した。
