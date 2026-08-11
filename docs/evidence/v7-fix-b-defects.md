# B 検証不具合修正エビデンス

- 日時: 2026-08-11
- 実装席: codex
- 進行: B1 → B3 → B4 を直列実行

## B1: `dom_id` resolver型不一致

### 原因

`src/content-search.js` が全adapterを `async_resolve` として扱い、`resolver.getItemId()`と
`CB_MTOP`を無条件に使用していた。`dom_id` adapterが実装するのは`resolver.getSource()`であり、
楽天・Yahoo!ショッピング・YouTube検索ではカード処理前に失敗していた。

### 修正

- `resolver.type`を`dom_id` / `async_resolve`で明示分岐
- `dom_id`は`getSource(card)`の`sourceId`を同期的にブロック判定
- `CB_MTOP`と解決キューは`async_resolve`だけで初期化
- 未対応の`resolver.type`は例外にして静かに失敗させない
- blocklist/displayMode変更時は`dom_id`の既知カードにも即時再適用

### 検証

- 修正前: focusedで`CB_MTOP is not defined`を再現
- focused: `node test/content-search.test.mjs` — 25/25 green
- 全体: `node --test test/*.test.mjs test/adapters/*.test.mjs` — 15 test files / 15 pass

## B3: YouTube watchが動画タイトルを発信元名として返す

### 原因

`yt-lockup-view-model`内の`span.ytAttributedStringHost`は、実測順でindex 0が動画タイトル、
index 1がチャンネル名だった。adapterは`querySelector()`でindex 0を取得していた。

### 修正

- `querySelectorAll('span.ytAttributedStringHost')[1]`をチャンネル名として使用
- 2番目の要素が無い、または空文字の場合は`null`を返す
- 実測DOM順（タイトル、チャンネル名、再生数、投稿日）をfixtureに固定

### 検証

- 修正前: focusedで`card.querySelector is not a function`となり旧取得経路を確認
- focused: `node test/adapters/youtube_watch.test.mjs` — 8/8 green
- 全体: `node --test test/*.test.mjs test/adapters/*.test.mjs` — 15 test files / 15 pass

## B4: Yahoo Newsでプレースホルダーが出ない

### 状態

未解決。原因未特定のまま推測修正せず、実ブラウザ起動のblockerで停止した。

### 確認済み

- manifestは`storage.js → keyword-filter.js → content-name.js → adapters/yahoo_news.js`の順
- adapterは調査正本どおり`ul.newsFeed_list > li`、`time.previousElementSibling`を使用
- `content-name.js`はblocklist・keyword・displayMode読込後にscanし、placeholderを適用する構造

### blocker

`agent-browser --session codex --extension <repo>`で実ブラウザ再現を試みたが起動できなかった。

1. 既定runtime: `Socket directory '/run/user/1000/agent-browser' is not writable: Read-only file system (os error 30)`
2. `XDG_RUNTIME_DIR=/tmp/agent-browser-codex-runtime`指定: `Daemon process exited during startup with no error output.`

実在する現在の記事・出版社を使ったblock設定とplaceholder確認は未実施。B4の修正コードも未実装。
