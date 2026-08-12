# b4-verify 実ブラウザ検証報告

- 検証者: ほたる（b4-verify owner）
- 実施日: 2026-08-12
- 対象: Nope v2.0.0（拡張ID: `jihinfddknleadkgniinbklbnpmggpio`）
- 環境: macOS / Chrome for Testing 151.0.0.0 / `agent-browser` headed
- セッション: `nope-b4-9878d533adb4`（namespace: `hotaru-b4`）

## 受入結果

| AC | 内容 | 結果 |
|---|---|---|
| AC1 | toolbar・拡張機能ページの 16/48/128px アイコン | **PASS（既存実ブラウザ証跡を継承）** |
| AC2 | ブランド適用済み popup と追加・削除・モード切替・キャッシュクリア | **PASS** |
| AC3 | プレースホルダー表示、hover/focus、画像リンク、解除時の非遷移 | **PASS** |
| AC4 | 表示モード文言 | **PASS** |
| AC5 | collapse 時に後続カードが前方へ詰まる | **PASS** |

今回の変更はアイコン資産・toolbar 設定を変更していない。room seq219 のオーナー裁定により、AC1 の toolbar は既存 b4 実ブラウザ証跡を継承し、今回の再試験を追加完了条件にしていない。今回の headed Chrome では `chrome://extensions` の拡張カードにマスコットアイコンが表示されることを再確認した。`manifest.json` の `icons` と `action.default_icon` はいずれも `icons/icon16.png`、`icons/icon48.png`、`icons/icon128.png` を宣言している。

## AC2: popup の描画と操作

`chrome-extension://jihinfddknleadkgniinbklbnpmggpio/popup/popup.html` を実ブラウザで開いて確認した。

- ブランド UI、`kitepon.dev` リンク、ブロック一覧、キーワード入力、表示モード、キャッシュクリアが描画された。
- Yahoo ニュースへキーワード `ほたる検証` を追加すると `blockedKeywords.yahoo_news` に保存され、削除すると空配列へ戻った。
- `非表示にして詰める` を選ぶと `displayMode` が `collapse` になった。
- `itemSourceCache` に検証用キーを入れてキャッシュクリアすると、そのキーが削除された。
- AC3 の確認前に `displayMode` を `placeholder` へ戻した。

証拠: `docs/evidence/ac2-popup.png`

## AC3: AliExpress 実検索面のプレースホルダー

対象ページ: `https://ja.aliexpress.com/w/wholesale-CMP-170HX.html`

実商品 `1005012900174730` の商品詳細ページを CSR 描画まで待ち、実ストアリンクから `storeId=1100223114`、表示名 `NailNest Store` を取得した。これをブロックし、検索面を再読込した。

- 検索カードは12件。
- 実解決された同一ストアの商品4件がプレースホルダーになった。
- 画像 `assets/mascot-blocked.png` が表示された。
- 画像全体のリンク先は正確に `https://kitepon.dev/` だった。
- mouseenter で `assets/mascot-blocked-hover.png` へ切り替わった。
- focus 中にマウスを外しても hover 画像を維持し、blur 後に通常画像へ戻った。
- プレースホルダー内に `BLOCKED`、`NailNest Store`、`ブロック解除` が表示された。
- `ブロック解除` を押すとプレースホルダーは4件から0件になり、カードが復元された。
- 解除前後の URL は同一で、親リンクへの遷移は発生しなかった。
- `blockedSources.aliexpress` は空になった。

証拠: `docs/evidence/ac3-placeholder.png`、`docs/evidence/ac3-unblock.png`

## AC4: 表示モード文言

popup の実 DOM で次の文言を確認した。

- `ブロック表示に置き換え`
- `非表示にして詰める`

## AC5: collapse の座標実測

同じ実ストアを再度ブロックし、`displayMode=collapse` へ切り替えた。商品 `1005012682655574` のカード位置を `getBoundingClientRect()` で前後比較した。

| 状態 | top | left |
|---|---:|---:|
| placeholder（切替前） | 549 | 344 |
| collapse（切替後） | 158 | 931.265625 |

切替後は同カードが次の行から先頭行へ移動し、ブロック対象 wrapper は `display:none`、矩形は0、プレースホルダーは0件になった。後続カードが空いた位置へ前方に詰まることを数値で確認した。

証拠: `docs/evidence/ac5-collapse.png`

## 掲載画像

今回更新した5枚はすべて 1280×800 PNG である。

- `docs/evidence/ac1-extensions-page.png`
- `docs/evidence/ac2-popup.png`
- `docs/evidence/ac3-placeholder.png`
- `docs/evidence/ac3-unblock.png`
- `docs/evidence/ac5-collapse.png`

以上の変更契約に不具合は見つからなかった。
