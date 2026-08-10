# p2-search-hide 受入監査（2026-08-10 統括bell）

## 判断

**accept**。構成 task（t4-mtop / t5-search-hide）はいずれも done で、受入は実ブラウザの実測に支えられている。

## 監査内容（実物で確認した項目）

- **t4-mtop**: productId→storeId の解決が mtop 実レスポンスで成立することを実測済み。storeId の所在は `data.result.SHOP_CARD_PC.sellerInfo.storeNum`。`GLOBAL_DATA.globalData.storeId` および `sellerInfo.storeURL` は DOM の `/store/<id>` と一致しない別系統IDで、採用すると検索フィルタが恒久的に不発になる——この罠は task note と `docs/evidence/t4-mtop.md` に記録済み。
- **t4 の実行経路**: isolated world の content script から直接 `<script>` を注入する当初設計は実機で動かないことが判明し、`content_scripts[].world:"MAIN"` の中継スクリプト（`src/mtop-main-relay.js`）へ設計変更。変更後の経路で storeId 1104977015 が返ることを実測して閉じている。設計変更は room へ宣言済み。
- **t5-search-hide**: `src/content-search.js` が cache 優先・mtop 解決キュー（2並列・間隔300ms）・MutationObserver による無限スクロール追従・blockedStores 変更のリロード無し即時反映を備える。`docs/evidence/t5-search-hide.md` と `t7-e2e.md` に実検索ページでの非表示動作を記録。t7 の E2E では mtop 実リクエスト33件により、複数商品でフィールド名が一貫して機能することを再確認している。
- **テスト**: `node --test test/*.test.mjs` を bell が再実行し 43/43 green（2026-08-10）。
- **解決失敗時の挙動**: 静かなフォールバックをせず console.warn を出してカードを残す設計。bot 対策が再発した場合に「消えたのか解決に失敗したのか」を画面と log で区別できる。

## 受入時点で分かっている限界（accept を妨げない・記録のみ）

- カードの非表示は wrapper の `display:none` で行っており、後続カードが前へ詰まらない。これは後継 plan `chromeblocker-release` の r1-placeholder で 2 モード化（プレースホルダー表示 / 完全に消して詰める）として解消する。
- AliExpress の bot 対策（punish）は時間帯により再発しうる。再発時は storeId 解決が失敗し、当該カードは表示されたまま残る。
