# t1-manifest 完了証拠（2026-08-10）

## 実施

- manifest.json を作成（MV3）。content_scripts は `*://*.aliexpress.com/*` 単一マッチで、md5→storage→mtop→content-item→content-search の順に連結読込（ビルド工程なし前提のグローバル公開方式）。
- permissions は `storage` のみ。host_permissions なし（mtop fetch は content script がページオリジンで行う設計のため）。
- popup は action.default_popup（popup/popup.html、t6 で実装）。
- default_locale/_locales は一度置いたが YAGNI で撤去（単一言語・ストア公開未定のため）。

## 検証

- `node -e "require('./manifest.json')"` で JSON 構文 OK、mv3・script 5 本を確認。
- Chrome への実読込は t7 実機 E2E（拡張機能読込はユーザー操作を含む）で行う。ここでは未実施＝未検証として明示。

## 未検証・注意

- src/*.js のうち storage.js 以外はこの時点で未作成。manifest が参照する 5 ファイルが揃うのは t2〜t5 完了時。読込順は storage/mtop が content-* より先である必要がある（グローバル参照）。
