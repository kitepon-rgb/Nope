# A 二重起動バグ修正エビデンス

- 日時: 2026-08-11
- 実装席: codex（唯一のwriterとして直列実行）
- 対象: `src/content-search.js` の共通エンジン読込時の無条件起動

## 原因確認

`src/content-search.js` 末尾の `CB_SEARCH.init().start()` は、AliExpress以外のmanifest entryでも
adapter読込前にAliExpress既定adapterを起動していた。楽天・Yahoo!ショッピング・YouTube検索では
`CB_MTOP`を注入していないため、共通エンジンの読込時点で未定義参照になりうる。その後、各adapterも
`CB_SEARCH.init({ adapter }).start()`を呼ぶため、起動責務も重複していた。

修正前に追加した回帰テストで次の3件がすべて失敗することを確認した。

1. 共通エンジン読込だけで`getBlockedSources`が1回呼ばれ、自動起動していた
2. AliExpress専用entryが存在しなかった
3. AliExpressのmanifest entryは`content-search.js`で終わっていた

## 修正

- `src/content-search.js`: 末尾の無条件起動を削除
- `src/content-aliexpress-init.js`: AliExpress既定adapterだけを起動する専用entryを追加
- `manifest.json`: AliExpressのisolated world entry末尾へ専用entryを追加
- `test/content-search.test.mjs`: 自動起動なし・専用entryの1回起動・manifest読込順を固定

## 検証

- focused: `node test/content-search.test.mjs` — 24/24 green
- 全体: `node --test test/*.test.mjs test/adapters/*.test.mjs` — 15 test files / 15 pass
- manifest: 上記全体テスト内でJSON parseとAliExpress entry末尾2ファイルの順序を確認

## 未検証

A単独での実ブラウザブロック確認は未実施。パターンAサイトはB1の`dom_id`型不一致が残っており、
この時点では起動後のカード処理が成立しないため、B1修正後の実ブラウザ検証で確認する。
