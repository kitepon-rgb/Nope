# yt-flow-audit 完了証跡

## 何を作ったか

`docs/evidence/youtube-flow-audit.md` — 現行の manifest・CB_SEARCH/CB_NAME 両エンジン・
YouTube アダプタ（検索結果・視聴ページ関連動画）・storage・popup・既存テストを読み、
以下を実測（コード読解）で確定した:

1. ホームは `*://www.youtube.com/*` の content_scripts マッチに含まれ現状も `youtube.js`
   (CB_SEARCH) が注入されるが、`ytd-video-renderer` が実際にホーム DOM に存在するかは未確認
   （yt-dom-survey の担当範囲として明記）。
2. 検索結果に登録入口が無い原因は CB_SEARCH エンジン（`content-search.js`）自体に
   登録ボタンを注入するコードパスが存在しないこと。popup にも発信元追加フォームは無い。
   登録ボタンパターンは AliExpress 商品ページ専用の `content-item.js` にしか存在せず、
   検索結果カードには複製されていない。
3. 視聴ページ関連動画は CB_NAME（`content-name.js` + `youtube_watch.js`）で、機能上は
   hover/focus ボタンが「出る」（出ないのではなく）。問題はボタンの不在ではなく、表示名のみを
   識別子として登録すること（`nameOnly: true`）と、siteKey `youtube` を検索結果と共有するため
   ID形式（`@handle`/`UCxxx`）と表示名が同一ブロックリストに混在しうること。
4. 旧テストの不足は CB_SEARCH 経路（検索結果全般）の登録フローテストの不在であり、
   CB_NAME 経路（yahoo_news 汎用テスト）には登録→解除フローのテストが存在する。
5. `yt-watch-retire` で撤去すべきコード・テスト・公開説明（README・store listing）の該当箇所を
   具体的に列挙した。

## どう確認したか

- 対象ファイルを Read で全文読み込み（`manifest.json`, `src/content-search.js`,
  `src/content-name.js`, `src/adapters/youtube.js`, `src/adapters/youtube_watch.js`,
  `src/storage.js`, `popup/popup.js`, `popup/popup.html`, `src/content-item.js`,
  `src/adapters/rakuten.js`, `src/adapters/amazon.js`）。
- 既存テスト（`test/content-search.test.mjs`, `test/content-name.test.mjs`,
  `test/adapters/youtube.test.mjs`, `test/adapters/youtube_watch.test.mjs`）を読み、
  何が検証済みで何が未検証かをテストケース単位で確認。
- README・`docs/store/listing.md`・`docs/store/privacy.md` を grep して YouTube 関連の
  公開説明箇所を特定。
- 実ブラウザでの DOM 確認は行っていない（本タスクの範囲外、yt-dom-survey が別途担当）。
  コードから確定できない事項（ホームの実際の DOM 構造）は「未確認」として明記した。

## 変更ファイル

- 追加: `docs/evidence/youtube-flow-audit.md`
- 追加: `evidence/nope-youtube-home/yt-flow-audit.md`（本ファイル）

製品コード・テストは変更していない（監査タスクの境界どおり）。
