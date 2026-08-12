# chromeblocker-brand 終端監査

## 判断

**accept**。b1〜b5 はすべて done で、2026-08-12 の最新オーナー裁定による通常・hover画像、`kitepon.dev` 画像リンク、実ブラウザ受入、v2.0.0 配布物が一貫している。確定欠陥・未充足は0件。

## 工程境界

- b1-icons: 16/48/128pxのアイコン資産は前回terminal-audit受理後も不変。後続planで更新された現行manifestでも、icons/actionの3サイズ宣言を維持している。
- b2-popup: 後続のnope-v2/v6-popup等で機能UIは更新され、旧ADD STORE手動追加フォームを撤去して7サイト別一覧とキーワードUIへ置換した。Nopeブランドと`kitepon.dev`導線は維持され、現行b4/b5 smokeで再確認済み。
- b3-placeholder: 最新採用画像2枚、画像全体の正確な `https://kitepon.dev/` リンク、hover/focus合成、解除ボタンの非遷移を実装。
- b4-verify: 実ストア `1100223114` を使い、popup、通常/hover/focus、画像リンク、解除、collapse座標をheaded Chromeで確認。掲載画像5枚を1280×800で更新。
- b5-repackage: v2.0.0据置でZIP/stable unpackedを再生成し、hover画像の同梱漏れを回帰テストで塞いだ。

## 独立監査

実装者とは別の席「なぎさ」が、今回変更した全工程をread-onlyで反証した。

- b3-placeholder: room seq203、defect-free
- b4-verify: room seq226、defect-free
- b5-repackage: room seq246、defect-free

b5監査では、ZIP payload / stable unpacked / repo の25ファイルが全てバイト一致し、重複・危険pathなし、通常・hover両画像のhash一致、旧 `assets/kitepon-dev-primary.png` 不在を確認した。欠陥版packの3 PASS / 1 FAILと現行4/4、YouTube fake DOM 25/25、全階層236/236も独立再実行している。

## 実ブラウザと配布物

- ソースツリーのb4 extension ID: `jihinfddknleadkgniinbklbnpmggpio`
- stable unpackedのb5 extension ID: `fipgalkbpoinlgbmdiddbeknabooajel`
- 対象ページ: `https://ja.aliexpress.com/w/wholesale-CMP-170HX.html`
- popup、拡張カードアイコン、通常プレースホルダー、hover画像を配布物自身のURLで表示
- 画像リンク: `https://kitepon.dev/`
- 通常/hover画像: 240×240、読込成功
- ZIP: `dist/chromeblocker-v2.0.0.zip`
- ZIP SHA-256: `2ed92e68fe393c0f4fb081cf28423ab539086d72c319b7d2166dbce4764ceced`
- ZIP size: 281,455 bytes
- manifest version: `2.0.0`（room seq237のオーナー裁定で据置）

## 検証

- `node --test 'test/**/*.test.mjs'`: 236/236 PASS
- `test/pack.test.mjs`: 修正前3 PASS / 1 FAIL、修正後4/4 PASS
- `test/youtube-surfaces.test.mjs`: 25/25 PASS
- `git diff --check`: PASS
- b4掲載画像5枚、b5配布smoke画像4枚: 全て1280×800 PNG

## 証跡

- `evidence/chromeblocker-brand/b3-placeholder.md`
- `evidence/chromeblocker-brand/b4-verify.md`
- `evidence/chromeblocker-brand/b5-repackage.md`
- `docs/evidence/b4-verify.md`
- `docs/evidence/b5-package-extensions.png`
- `docs/evidence/b5-package-popup.png`
- `docs/evidence/b5-package-placeholder.png`
- `docs/evidence/b5-package-placeholder-hover.png`

`chromeblocker-release/r7-submit` は別planの外部依存であり、このブランド工程の未完了ではない。
