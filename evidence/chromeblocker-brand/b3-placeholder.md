# b3-placeholder 証跡

## 実施

- `/Users/kite/Developer/RootSitePromotion/docs/color-system.md` と `identity-system.md` を読み、既存の White / Discovery Orange / Deep Orange / Ink の構成を維持した。
- 通常画像を指定された `nope-brand-preview-mascot-up-6.png`、hover/focus画像を指定された `nope-brand-preview-hover.png` とバイト一致する240×240 PNGとして同梱した。
- 検索カードと名前カードのプレースホルダーで、ロゴ込み画像全体を `https://kitepon.dev/` へのリンクにした。追跡パラメータと別ロゴDOMは置いていない。
- mouse hoverとkeyboard focusのどちらでもhover画像へ切り替え、hoverとfocusが重なった時は片方が継続する限りhover画像を保つ。
- 解除ボタンはブランドリンクの外に維持し、既存の `preventDefault` / `stopPropagation` / storage解除経路を変更していない。collapse経路も変更していない。
- `manifest.json` の `web_accessible_resources` へ通常・hover画像を登録した。

## 画像同一性

- 通常画像 SHA-256: `eab02f9d26650cd7554a2d04af7591d271f5c5f07af39f2a3c5db009fe17837a`
- hover画像 SHA-256: `b8f40ff22ac3cf22cc35195b9fc8f0da448cf799df6a273570a19cc8e7d1dc73`
- `cmp -s` で指定元ファイルと同梱先が双方一致した。

## 検証

- `git diff --check`: 成功
- `node --test test/content-search.test.mjs test/content-name.test.mjs`: 45件成功、失敗0件
- 正本上の後続 `b4-verify` が実ブラウザ検証を所有するため、この工程では実ブラウザと掲載画像撮影を実施していない。
- 正本上の後続 `b5-repackage` が配布物再生成を所有するため、この工程ではpackを実施していない。
