# b5-repackage 証跡

## 結果

- 実施日: 2026-08-12
- owner: ほたる
- version: `2.0.0`（room seq237 のオーナー裁定により据置）
- 配布ZIP: `dist/chromeblocker-v2.0.0.zip`
- stable unpacked: `dist/chromeblocker-v2.0.0-unpacked/`
- 結果: 再梱包、展開物smoke、full test PASS

## 配布契約の修正

`scripts/pack.mjs` の明示同梱一覧に `assets/mascot-blocked-hover.png` が無く、ソースでは動くが配布物では hover/focus 画像が欠ける状態だった。

1. `test/pack.test.mjs` に通常・hover両画像の同梱テストを追加した。
2. 修正前は4件中1件が red となり、`assets/mascot-blocked-hover.pngがunpacked面に含まれていない` を再現した。
3. `scripts/pack.mjs` に hover 画像を追加した。
4. 配布物全ファイルと repo の同名ファイルをバイト比較する回帰テストを追加した。
5. 撤去済み `assets/kitepon-dev-primary.png` が ZIP / stable unpacked の双方に無いことを固定した。
6. b3で追加したリンク属性に追随していなかった YouTube 契約テストの fake DOM へ `setAttribute` を追加した。

実装コミット: `00358cc`

## 配布物の同一性

- ZIP size: 281,455 bytes
- ZIP SHA-256: `2ed92e68fe393c0f4fb081cf28423ab539086d72c319b7d2166dbce4764ceced`
- 通常画像 SHA-256（repo / unpacked一致）: `eab02f9d26650cd7554a2d04af7591d271f5c5f07af39f2a3c5db009fe17837a`
- hover画像 SHA-256（repo / unpacked一致）: `b8f40ff22ac3cf22cc35195b9fc8f0da448cf799df6a273570a19cc8e7d1dc73`
- `manifest.json`、`src/`、`popup/`、`icons/`、両画像は repo と stable unpacked でバイト一致
- ZIP と stable unpacked のファイル一覧は一致
- ZIP 内の画像は `assets/mascot-blocked.png` と `assets/mascot-blocked-hover.png`
- 旧別ロゴ `assets/kitepon-dev-primary.png` は双方に不在

## stable unpacked の実ブラウザsmoke

ソースツリーではなく `dist/chromeblocker-v2.0.0-unpacked/` を headed Chrome へロードした。

- session: `nope-b5-f1a5a26c`
- namespace: `hotaru-b5`
- 配布物固有拡張ID: `fipgalkbpoinlgbmdiddbeknabooajel`
- Chrome拡張機能ページ: `Nope — 見たくないもの見せません` とマスコットアイコンを表示
- popup: ブランドUI、正確な `https://kitepon.dev/`、両表示モード、管理UIを表示
- AliExpress実検索面: 12カード中、キャッシュ済み実ストア `1100223114` の1件をプレースホルダー化
- 通常画像: 配布物URL `.../assets/mascot-blocked.png`
- hover画像: 配布物URL `.../assets/mascot-blocked-hover.png`、読込完了、自然寸法240×240
- 画像リンク: `https://kitepon.dev/`
- smoke終了後、自分のbrowser sessionだけをclose済み

証拠画像（すべて1280×800 PNG）:

- `docs/evidence/b5-package-extensions.png`
- `docs/evidence/b5-package-popup.png`
- `docs/evidence/b5-package-placeholder.png`
- `docs/evidence/b5-package-placeholder-hover.png`

## テスト

- focused red: `node --test test/pack.test.mjs` → 3 PASS / 1 FAIL（hover画像欠落を再現）
- focused green: `node --test test/pack.test.mjs` → 4/4 PASS
- YouTube fake DOM修正後: `node --test test/youtube-surfaces.test.mjs` → 25/25 PASS
- 最終 full gate: `node --test 'test/**/*.test.mjs'` → 236/236 PASS
- `git diff --check`: PASS

## 独立監査

- 監査者: なぎさ
- room: seq246
- 対象: commits `00358cc` / `448a0bb`、現物 ZIP / stable unpacked
- 結果: defect-free、確定欠陥0、実装変更なし
- 確認: 25ファイルの ZIP payload / unpacked / repo バイト一致、危険pathなし、欠陥版3 PASS / 1 FAIL、現行pack 4/4、YouTube 25/25、full 236/236、4枚のsmoke画像整合
- owner受理: bell seq250
