# r2-placeholder-verify 完了証拠（2026-08-10、kotoha実測）

r1-placeholder（sumire、displayMode API・content-search.js 2モード対応・popup 切替UI）の実ブラウザ検証。実装は sumire、検証は kotoha（実装者と検証者を分ける方針、bell指示）。

## 手段

`agent-browser --headed --extension "C:/Users/kite_/Documents/Program/ChromeBlocker" open "https://ja.aliexpress.com/w/wholesale-CMP-170HX.html"`（design memo指定の検索語、NailNest Store / storeId 1100223114 が出る）で拡張をロード。同期コマンド（open/wait/eval/click/screenshot）のみを使用。

ブロック対象の切替・displayMode切替は、拡張の popup ページ（`chrome-extension://efcgoleknjceombadjnbhopdmeeenaed/popup/popup.html`、`agent-browser tab new` で別タブとして開く）から `chrome.storage.sync.set` を直接呼んで行った（popup.js 経由のUI操作ではなく、popup タブが拡張のisolated worldと同じ `chrome.storage` にアクセスできることを利用。t5-search-hide.md の実測手法を踏襲）。

**mtop解決について**: 実測開始時、AliExpress の bot 対策（`FAIL_SYS_USER_VALIDATE`）により mtop API 呼び出しが失敗する状態だった（`docs/evidence/t4-mtop.md` 等で既知の間欠的な壁）。mtop 自体の可用性は t4-mtop で既に実測・doneであり、r2 の受入条件は「表示ロジック（プレースホルダー/collapse切替）」であって mtop 解決そのものの再検証ではないため、実装のキャッシュ命中経路（`storage.getCachedStore` がヒットした場合はmtopを呼ばずに即判定する、`content-search.js` の既存コードそのまま）を使うことにした。AGENTS.md記載の実測済み事実「商品 1005012897132115 → storeId 1100223114 NailNest Store」を `chrome.storage.local.productStoreCache` へ直接セットしてからページをリロードし、キャッシュ命中経路で検証した。これはmtopのモックではなく、実装済みの正規キャッシュ機構をそのまま使う実測である。

## 受入条件ごとの実測結果

### 1. 検索結果ページでブロック済みストアのカードが猫プレースホルダーに置き換わる

`blockedStores` に `1100223114`（NailNest Store）を追加し、`productStoreCache` に対応をセットした状態でページをリロード。対象カード（productId `1005012897132115`）の wrapper 内に `.cb-blocked-placeholder`（猫の禁止マークSVG・「ブロック済み」ラベル・ストア名・「ブロック解除」ボタン）が1件出現することを確認（`document.querySelectorAll('.cb-blocked-placeholder').length === 1`）。スクリーンショット: `r2-placeholder-visible.png`。

### 2. 「解除」ボタンで親リンクへ遷移せずブロックが外れ、元のカードが復元される

クリック前の `location.href` を記録した上で `.cb-blocked-placeholder button` をクリック。

- クリック後も `location.href` は変化なし（`https://ja.aliexpress.com/w/wholesale-CMP-170HX.html` のまま）→ **親リンクへ遷移していないことを確認**（`preventDefault`/`stopPropagation` が実際に効いている実測）
- `.cb-blocked-placeholder` は0件に戻り、`chrome.storage.sync` の `blockedStores` も `{}` に戻った（正しくブロック解除された）
- 対象カードの wrapper は `display: block`、`querySelector('img')` が存在し `children.length === 1`（元の商品カード内容が復元されている）ことを確認

スクリーンショット: `r2-unblocked-restored.png`。

### 3. popup で「完全に消す」へ切り替えると、リロード無しでカードが消え、後続カードが前へ詰まる

対象ストアを再ブロックし、`displayMode` を `collapse` に設定（popup タブから `chrome.storage.sync.set` で1回のcallに両方のキー変更をまとめて実行。`onBlockedStoresChanged`/`onDisplayModeChanged` 両方のリスナーが同一 `storage.onChanged` イベントで発火することを確認）。**検索結果タブをリロードせずに**、`getBoundingClientRect()` で座標を実測。

Before（placeholder モード、対象カードは検索結果中 index 23）:

| 要素 | top | left |
|---|---|---|
| 対象カード（NailNest, `1005012897132115`） | 500.67 | 1920.45 |
| 後続1（`1005012900210486`） | 852.56 | 641 |
| 後続2（`1005012900740322`） | 852.56 | 896.89 |
| 後続3（`1005012906567128`） | 852.56 | 1152.78 |

After（collapse モード、リロード無し）:

| 要素 | top | left |
|---|---|---|
| 対象カードの wrapper | `display: none`（`getBoundingClientRect()` は 0,0,0,0） |
| 後続1（`1005012900210486`） | **500.67** | **1920.45** |
| 後続2（`1005012900740322`） | 852.56 | 641 |
| 後続3（`1005012906567128`） | 852.56 | 896.89 |

**後続1のカードが、対象カードが消える前に対象カードが占めていた座標（top=500.67, left=1920.45）へちょうど移動している**——後続カードが1つずつ前へ詰まったことを数値で確認した。printed impression ではなく `getBoundingClientRect()` の実測値による確認。スクリーンショット: `r2-collapse-mode.png`。

### 4. 「あっかんべー表示」へ戻すとプレースホルダー表示に復帰する

`displayMode` を `placeholder` に戻す（リロード無し）。対象カードの wrapper が `display: block` に戻り、`.cb-blocked-placeholder` が1件再出現、座標も元の `top=500.67, left=1920.45` に戻ることを確認。

## ストア掲載用スクリーンショット（1280x800、docs/store/listing.md 用）

design memo の指示通り、実測と同一セッションで撮影。viewport は `agent-browser set viewport 1280 800` で設定。

| ファイル | 内容 |
|---|---|
| `r2-store-search-before-block.png` | ブロック前の検索結果ページ |
| `r2-placeholder-visible.png` | プレースホルダー表示（受入条件1と共用） |
| `r2-collapse-mode.png` | collapse モード適用後（受入条件3と共用） |
| `r2-popup-closeup.png` | popup 画面のクローズアップ。**1280x800ではなく実サイズ360x420で撮影**——popup.css の `body { width: 320px }` により、拡張アイコンクリック時の実際のpopupウィンドウはこのサイズ感になる。1280x800キャンバスの検索結果ページ上へ popup を合成する形の掲載素材が要るなら、それは編集作業として別途行う必要がある（この文書ではその判断・実行はしていない） |

`docs/store/listing.md` のスクリーンショット表の「未撮影」（4・5番）はこの実測画像で更新済み（同ファイルの変更履歴参照）。

## 結論

r1-placeholder の受入条件4件すべてを実ブラウザ・同期コマンドで実測確認した（「たぶん動く」の推測なし）。座標シフトは `getBoundingClientRect()` の数値で確認し、遷移しないことは `location.href` の不変で確認した。ストア掲載用スクリーンショットも同一セッションで取得済み。done とする。
