# p1-foundation 受入監査（2026-08-10 統括bell）

## 判断

**accept**。全 task（t1〜t7）done、受入条件を実測で満たしている。

## 監査内容（実物で確認した項目）

- 工程正本: `lattice todo status` で active_set / next_ready / blocked すべて空、t1〜t7 done を確認。
- テスト: `node --test test/*.test.mjs` → **43/43 green**（bell 自身で再実行して確認）。
- manifest.json 実物: MAIN world 中継スクリプト（`src/mtop-main-relay.js`、`document_start`）と isolated world 側 5 ファイル（md5/storage/mtop/content-item/content-search、`document_idle`）の2段構成を確認。
- E2E 証跡（`docs/evidence/t7-e2e.md`）: design memo 指定の商品 `1005012897132115`（NailNest Store / 1100223114）・検索語 `wholesale-CMP-170HX` で、①商品ページのブロックボタン→②検索結果のリロード無し非表示（mtop 実リクエスト33件で解決）→③popup の一覧・URL追加・削除、を1セッション通しで実測。スクリーンショット5枚付き。
- t4 の設計変更（isolated world からの script 注入が実際には動かない→ `content_scripts[].world:"MAIN"` 中継へ）は room へ宣言済みで、変更後の経路が実測で storeId 1104977015 を返すことを確認。
- storeId フィールドの罠（`GLOBAL_DATA.globalData.storeId` は DOM と不一致、`SHOP_CARD_PC.sellerInfo.storeNum` が正）は bell の実測（task note）と t7 の33件実リクエストの双方で再現・一貫。

## 残課題（受入を妨げない・記録のみ）

- 拡張は未 push・未配布。オーナーの実 Chrome への導入（`chrome://extensions` から Load unpacked）が配布の最終段。
- mtop bot 対策（punish）は時間帯により再発しうる。content-search.js は解決失敗時に throw する設計（静かなフォールバック禁止）で、その場合カードは残る。
