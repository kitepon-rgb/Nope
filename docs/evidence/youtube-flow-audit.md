# YouTube 旧導線と対象面の監査（yt-flow-audit）

監査日: 2026-08-11 / 担当: mashiro（コード読解のみ、実ブラウザ実測は yt-dom-survey が別途担当）

対象: `manifest.json`, `src/content-search.js`(CB_SEARCH), `src/content-name.js`(CB_NAME),
`src/adapters/youtube.js`, `src/adapters/youtube_watch.js`, `src/storage.js`, `popup/`,
`test/content-search.test.mjs`, `test/content-name.test.mjs`, `test/adapters/youtube*.test.mjs`,
`README.md`, `docs/store/listing.md`, `docs/store/privacy.md`。

## 1. 現状、YouTube の各面に何が注入されているか

拡張には発信元ブロックのエンジンが2系統ある。

- **CB_SEARCH**（`src/content-search.js`, パターンA/C）: カードから同期的に ID を取る（`dom_id`）か、
  非同期解決する（`async_resolve`）。**ブロック済みリストの適用と、placeholder 内の「解除」ボタンだけを持つ。
  未ブロックカードへ登録用ボタンを注入する機能が無い。**
- **CB_NAME**（`src/content-name.js`, パターンB）: 表示名だけで判定する。`ensureSourceButton` で
  **未ブロックカードに hover/focus で現れる「🚫 発信元をブロック」ボタンを注入する**（`test/content-name.test.mjs`
  で汎用に検証済み）。ブロックは `storage.addBlockedSource(siteKey, sourceName, sourceName, true)` —
  **sourceId が表示名そのもの、`nameOnly: true`**。

YouTube に登録されている content_scripts エントリ（`manifest.json`）:

| マッチ | 読み込み順 | エンジン | siteKey |
|---|---|---|---|
| `*://www.youtube.com/*` | storage → content-search → adapters/youtube | CB_SEARCH | `youtube` |
| `*://www.youtube.com/watch*` | storage → keyword-filter → content-name → adapters/youtube_watch | CB_NAME | `youtube` |

**ホームへ現状何が注入されるか**: `*://www.youtube.com/*` は `watch*` を含む全 YouTube ページにマッチする
ワイルドカードであり、ホーム（`www.youtube.com/`）にも `src/adapters/youtube.js` が注入される。
`cardSelector: 'ytd-video-renderer'` で `document` 全体を `MutationObserver` 込みで走査するため、
**ホームのフィードに `ytd-video-renderer` が実際に存在すれば、検索結果と同じ CB_SEARCH ロジック
（適用のみ・登録不可）がそのまま効く。存在するかどうかはコードからは確定できない**——
plan の既知の罠のとおり「YouTube ホームは未ログイン調査だけで対象外にされ、ログイン済みの実 DOM を
確認していない」状態であり、実際にカードへ当たっているかは yt-dom-survey の実測が必要。

## 2. 検索が保存済み値を適用できても登録できない理由

構造的な欠落であり、バグではない。

- CB_SEARCH（`content-search.js`）には登録ボタンを生成するコードパスが存在しない。
  `applyVisibility` は `blocked` の時だけ placeholder（中に「解除」ボタン）を出し、`blocked=false` の
  カードには何も注入しない（`insertPlaceholder` は `blocked` 分岐でのみ呼ばれる）。
- popup（`popup/popup.js`）にも「発信元を追加」フォームは無い。`renderSourceRow` は既存エントリの
  「削除」ボタンしか作らず、キーワード追加フォーム（`#keyword-form`）はキーワードブロック専用。
- 唯一の登録 UI パターンは `src/content-item.js`（AliExpress の**商品詳細ページ**専用、`content-search.js`
  とは別ファイル・別 content_scripts エントリ）。これは検索結果カードではなく商品ページに独立注入される
  ボタンで、**CB_SEARCH エンジン自体の機能ではない**。この「詳細ページ側に登録ボタンを置く」パターンは
  rakuten / yahoo_shopping / yahoo_auction / amazon / youtube のいずれの CB_SEARCH サイトにも
  複製されていない。

結論: **YouTube 検索結果（および同じ CB_SEARCH エンジンを使う他サイトの検索結果全般）は、
「カードへの登録ボタン注入」という機能そのものが実装されていない。** 既存ブロックの表示・解除は動くが、
新規登録の入口はどこにも無い。これが plan 冒頭の「検索結果はブロック済みデータを適用できる一方、
利用者が発信元を登録する入口が無い」の直接の原因。

## 3. 視聴ページ関連動画: ボタンの現状

`youtube_watch.js` は CB_NAME（パターンB）を使っており、**`ensureSourceButton` は未ブロックの関連動画
カードに対して機能上は生成される**（`content-name.test.mjs` の hover/focus テストが該当ロジックを
汎用に検証済み。YouTube 固有の統合テストは存在せず、`resolver.getSource` の単体テストのみ
`test/adapters/youtube_watch.test.mjs` にある）。つまり**コード上は「ボタンが出ない」のではなく
「ボタンは出るが、表示名だけで登録される」**状態である。

問題は不在ではなく識別子の質:

- `resolver.type: 'dom_name'` は `span.ytAttributedStringHost` の2番目の要素からチャンネル**表示名**
  しか取得しない（安定識別子である `/@handle` や `/channel/UC...` を取る手段が無い——
  コメントに明記: 「DOM にチャンネルリンクは存在しない」）。
- ブロック登録は `nameOnly: true` で保存され、popup 側は `renderSourceRow` で
  「⚠ 表示名で判定：改名・同名の別発信元に注意」の警告バッジを出す（表示名運用は既知の劣化パスとして
  扱われている）。
- **siteKey は検索結果アダプタと同じ `'youtube'`**（コメントで明記、意図的な共有）。したがって
  関連動画から表示名で登録したブロックと、検索結果から `@handle` / `UCxxx` で登録したブロックが
  **同一の `blockedSources.youtube` オブジェクトに、形式の異なるキーとして混在しうる**。同一チャンネルを
  検索から ID でブロックし、関連動画から表示名でも別エントリとしてブロックする、といった二重登録を
  防ぐ仕組みは無い。

結論: 関連動画は「見たい動画である可能性が高く主対象ではない」という設計判断に加え、**実装上も
表示名ベースの劣化した識別子でブロックリストを汚染しうる**。plan の既知の罠
「チャンネル表示名だけを識別子にする互換処理」を体現しているのはこの面であり、`yt-watch-retire` で
撤去すべき対象はこの CB_NAME + `youtube_watch.js` 経路全体である。

## 4. 旧テストが検証していなかったこと

- `test/content-search.test.mjs`: `scan` によるキャッシュ適用・mtop 解決・変更購読は厚く検証しているが、
  **「未ブロックカードから新規登録する」フローのテストは1つも無い**（そのようなコードパスが存在しないため）。
- `test/adapters/youtube.test.mjs`: `resolver.getSource` の handle/UC 抽出ロジックのみ。DOM 注入・
  MutationObserver・実際の CB_SEARCH 連結は「実地確認で担保する」とコメントされており、ユニットテストの
  対象外。
- `test/adapters/youtube_watch.test.mjs`: 同様に `resolver.getSource` の単体テストのみ。
  登録→解除のフルフローは `test/content-name.test.mjs` の汎用（`yahoo_news`）テストが代替しているが、
  YouTube 固有の統合テストは無い。

これは plan の指摘（「旧テストは storage へブロック済みデータを直接投入し、登録から解除までの利用者導線を
検証していなかった」）と一致する。ただし正確には、**登録→解除の導線テスト自体は CB_NAME 経路
（yahoo_news 汎用テスト）には存在する**。存在しないのは CB_SEARCH 経路（検索結果全般、YouTube 含む）
の登録テストであり、これはテストの不足ではなく機能そのものの不在が原因。

## 5. `yt-watch-retire` で撤去すべき対象（現時点で判明分。実装時に再確認すること）

- コード: `src/adapters/youtube_watch.js` 全体、および `manifest.json` の
  `*://www.youtube.com/watch*` content_scripts エントリ（`storage.js`, `keyword-filter.js`,
  `content-name.js`, `adapters/youtube_watch.js` の組）。
  - `content-name.js`・`keyword-filter.js` は `yahoo_news` / `yahoo_japan` でも使われる共有エンジンなので
    ファイル自体は残す。watch 用の content_scripts エントリと `youtube_watch.js` だけを外す。
- テスト: `test/adapters/youtube_watch.test.mjs`（アダプタ削除に伴い丸ごと不要）。
- 公開説明:
  - `README.md:22` の対応サイト表「YouTube | 検索結果・動画視聴ページの関連動画 | チャンネル」から
    「動画視聴ページの関連動画」を削る。
  - `docs/store/listing.md` の「視聴ページの関連動画」節（95–99行目付近、`*://www.youtube.com/watch*`
    のホストアクセス正当化）を削除し、`permissions`/`host_permissions` 申告からも watch エントリを除く。
  - `docs/store/listing.md:166` 付近の申告用テキスト「YouTube（youtube.com）の検索結果ページ・
    動画視聴ページの関連動画」からも同様に削る。
  - `docs/store/privacy.md` は YouTube を「表示中の DOM だけで判定し追加通信を行わない」サイト群に
    含めているだけで、面の名称までは書いていない。watch 撤去後も文言変更は不要（要再確認）。

## 6. 監査中に見つけた、現状スコープ外の既知の齟齬（申し送りのみ・対応不要）

`docs/store/listing.md:91` は「YouTube の検索結果ページでのみ適用される」と申告しているが、
実際の `manifest.json` のマッチパターンは `*://www.youtube.com/*` でホーム等も含む。
`yt-home-search` でホームが正式な対象面になれば整合するので、現時点では欠陥として扱わず記録のみ。
