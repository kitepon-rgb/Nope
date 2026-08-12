# b4-verify 証跡

## 結果

- 実施日: 2026-08-12
- owner: ほたる
- 対象: Nope v2.0.0
- 結果: AC1〜AC5 PASS、変更契約の不具合なし

実測の全量は `docs/evidence/b4-verify.md` に記録した。room seq219 のオーナー裁定に従い、今回変更していない toolbar とアイコン資産は既存 b4 実ブラウザ証跡を継承し、`chrome://extensions` の拡張カード表示と現行 manifest 宣言を再確認した。

## 今回の実測

- popup のブランド描画、キーワード追加・削除、モード切替、キャッシュクリア
- AliExpress 実ストア `1100223114` のプレースホルダー表示
- 通常・hover・focus の画像切替
- 画像全体のリンク先 `https://kitepon.dev/`
- 解除時に親リンクへ遷移せずカードが復元
- collapse 後のカード座標移動（`top: 549 → 158`）
- 新掲載画像5枚がすべて 1280×800 PNG

## 成果物

- `docs/evidence/b4-verify.md`
- `docs/store/listing.md`
- `docs/evidence/ac1-extensions-page.png`
- `docs/evidence/ac2-popup.png`
- `docs/evidence/ac3-placeholder.png`
- `docs/evidence/ac3-unblock.png`
- `docs/evidence/ac5-collapse.png`

## 検証

- Chrome for Testing 151.0.0.0 / agent-browser headed
- セッション: `nope-b4-9878d533adb4` / namespace `hotaru-b4`
- `sips` で5画像の 1280×800 を確認
- `git diff --check` を完了前に実行

## 独立監査

監査結果を room で受領後に追記する。
