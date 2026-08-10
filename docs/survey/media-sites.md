# メディア系サイト DOM 実地調査

調査日: 2026-08-11  
調査者: shiho  
調査ツール: `agent-browser --session shiho`（ヘッドレス Chromium）  
対象: YouTube・Yahoo ニュース・Yahoo JAPAN

---

## YouTube

### 対象ページ一覧

| 面 | URL パターン | 備考 |
|---|---|---|
| 検索結果 | `/results?search_query=*` | **未ログインでも閲覧可** |
| ホーム | `/` | **ログイン必須**（未ログインは「Try searching to get started」のみ） |
| 視聴ページ関連動画 | `/watch?v=*` | 右カラム。未ログインでも閲覧可 |
| チャンネル動画一覧 | `/@<handle>/videos` | 未ログインでも閲覧可 |

### SPA・無限スクロール

- **SPA: YES**。`history.pushState` によるクライアントサイドルーティング。  
  実測: `cats` 検索結果から動画ページへクリック遷移後、URL が `/results?...` → `/watch?...` に変化（`history.length` +1）、かつ旧DOM の `ytd-video-renderer` が一部残留していることを確認。**MutationObserver 必須**。
- **無限スクロール: YES**（検索結果）。`ytd-continuation-item-renderer` の存在を実測で確認。

### 面ごとのカード要素とチャンネルID

#### 検索結果 `/results?search_query=*`

**カード要素**: `ytd-video-renderer`  
実測マッチ件数: 15〜24 件（ページにより変動）

**外側要素（消す対象）**: `ytd-video-renderer` そのもの  
- `display: block`、親 `div#contents` も `display: block`  
- AliExpress とは異なり flex アイテムではない → `display: none` だけで空間が詰まる（実測確認）  
- 親構造: `ytd-video-renderer` > `div#contents` > `ytd-item-section-renderer` > `div#contents` > `ytd-section-list-renderer`

**チャンネルリンク（セレクタ）**: `ytd-video-renderer` 内の `a[href*="/@"], a[href*="/channel/"]`  
実測サンプル（5件中）:
- `/channel/UConh1BwKagscq7EAP2Vng-g` ← `/channel/UC...` 形式
- `/@MagicClub686` ← `/@handle` 形式
- `/@51TestClips`、`/@anime_oshinoko`、`/@MoreAliA`

> **重要**: 両形式が混在する。`/@handle` は表示名から自動生成されるため変わりうる。`/channel/UC...` は変わらない識別子。ブロックリストには両方を持つか、`/channel/UC...` だけを正としてハンドルからの解決機構を検討する。

**タイトルセレクタ**: `ytd-video-renderer a#video-title`  
実測テキスト例: `"CHANMINA - TEST ME (Official Music Video)"`

**Shadow DOM**: なし（`ytd-video-renderer.shadowRoot === null` を実測確認）

---

#### ホームページ `/`（ログインユーザーのみ）

**カード要素**: `ytd-rich-item-renderer`  
- 未ログイン状態では本要素が0件（ホームに動画コンテンツなし）。チャンネルページ（`/@handle/videos`）で内部構造は実測可能。
- 内部構造: `ytd-rich-item-renderer` > `yt-lockup-view-model`（詳細は下記「視聴ページ関連動画」と同じ構造）
- `ytd-rich-item-renderer` の `data-*` 属性: `items-per-row`, `lockup=true` のみ。チャンネルIDなし。

**チャンネルリンク**: **未確認（ログイン必須）**  
- チャンネルページの同要素では `yt-lockup-view-model` が内包され、チャンネルリンクなし（視聴ページと同構造と推定）。
- **実測が必要**: ログインユーザーのホームで `ytd-rich-item-renderer` 内の `a[href*="/channel/"]` が存在するかどうかは未確認。

---

#### 視聴ページ関連動画（右カラム） `/watch?v=*`

**カード要素**: `yt-lockup-view-model`  
- 位置: `ytd-watch-next-secondary-results-renderer > div#items > ytd-item-section-renderer > div#contents`
- 実測マッチ件数: 20件（うち `ytd-reel-shelf-renderer` 1件を含む混在）

**旧要素 `ytd-compact-video-renderer`**: 実測でヒット件数 **0**。現行 YouTube では使われていない（`yt-lockup-view-model` に置き換わり済み）。

**チャンネルリンク**: **DOM に存在しない**  
実測: `yt-lockup-view-model` 内に `a[href*="/channel/"]` も `a[href*="/@"]` も0件。  
利用可能な情報:
- `span.ytAttributedStringHost` → チャンネル**表示名**テキスト（例: `"Rick Astley"`, `"Beluga"`）
- **チャンネルIDは取れない**。表示名は変更可能なため、名前だけでの識別は不安定。

> **設計への影響（重要）**: 視聴ページ関連動画でチャンネルIDによるブロックはできない。実装方針の選択肢:  
> 1. 視聴ページ関連動画は v1 の対象外にする  
> 2. チャンネル表示名でのブロックをオプションとして提供する  
> 3. チャンネルリンクが存在する面（検索結果）でのみ ID 解決し、視聴ページへのキャッシュ適用を試みる（複雑）

**Shadow DOM**: なし（`yt-lockup-view-model.shadowRoot === null` を実測確認）

---

## Yahoo ニュース (`news.yahoo.co.jp`)

### 対象ページ一覧

| 面 | URL パターン | 備考 |
|---|---|---|
| トップ | `https://news.yahoo.co.jp/` | 記事一覧あり |
| カテゴリ | `/categories/{domestic,world,business,entertainment,sports,it,science,life,local}` | 同じ構造 |
| トピックス | `/topics/{カテゴリ}` | pickup形式（出版社情報なし） |

> 注: `/categories/car` は存在しない（404）。車関連は `/categories/life` 等に含まれると推定。「特定出版社（車）」の対象はカテゴリに関係なく全面での出版社名マッチで対応可能。

### SPA・スクロール

- **SPA: YES**。実測: `/categories/entertainment` → `/categories/sports` のクリックで URL 変更、`history.length` +1。
- **無限スクロール: なし**。固定50件表示 + 末尾の「もっと見る」リンク（`<a href="/topics/…">`）で別ページへ遷移。

### カード要素とセレクタ

**カード要素**: `ul.newsFeed_list > li`  
実測件数: トップ・各カテゴリとも **50件**（うち約42件が `/articles/` リンク付き記事カード）

**外側要素（消す対象）**: `li` 要素そのもの  
- `ul.newsFeed_list` は `display: block`、`li` は `display: list-item`
- `display: none` で空間が詰まる（実測確認）

**記事カードの識別**: `ul.newsFeed_list > li:has(time)` または `ul.newsFeed_list > li:has(a[href*="/articles/"])`  
（残り8件は `/pickup/` リンクのみでtimeなし）

**出版社セレクタ**:  
- DOM: `time` の直前の `span` 要素（兄弟関係）  
- CSS: `ul.newsFeed_list > li span:has(+ time)` （`:has()` で選択可、Chrome 105+ 対応）  
- JS: `li.querySelector('time').previousElementSibling.textContent.trim()`

実測サンプル:
| publisher | time |
|---|---|
| `西スポWEB OTTO!` | `8/11(火) 0:00` |
| `スポーツ報知` | `8/10(月) 19:05` |
| `ABEMA TIMES` | `8/11(火) 0:12` |
| `毎日新聞` | `8/10(月) 22:50` |

**タイトルセレクタ**:  
- 安定セレクタなし（クラスが styled-components の難読化クラス `sc-3ls169-0 fYdrKC` 等）
- 実装方針: `a[href*="/articles/"]` の textContent から `time.textContent` と publisher を除去した残りがタイトル  
  実測: 正しく取得できることを確認（3件確認済み）
- 代替: `a[href*="/articles/"]` 直下の `div` で子要素数が0かつテキスト長 > 5 の要素（同内容）

**Shadow DOM**: なし（通常 DOM）

---

## Yahoo JAPAN (`www.yahoo.co.jp`)

### 対象ページ

`https://www.yahoo.co.jp/` のみ（ニュースセクション）

### カード要素とセレクタ

**カード要素**: `article:not(:has(article))` かつ内部に `cite` を持つもの  
実測: 葉 article 件数 67件中、`cite` 付き 40件がニュース記事カード

> `www.yahoo.co.jp` は `article` 要素の入れ子構造を使用。外側の section wrapper 記事（h1 = "ニュース", "おすすめの記事"）と内側の個別記事カードが同じタグ。  
> 1段階のネスト: `section wrapper article` > `individual article card`（ただし querySelectorAll では `article:has(article)` を使えば wrapper を除外可能）

**外側要素（消す対象）**: 個別記事 `article` 要素（leaf article）  
- `display: block`、親 `div` も `display: block`
- `display: none` で空間が詰まる

**出版社セレクタ**: `article cite`（`<cite>` 要素を使用。意味論的に安定）  
実測サンプル: `みんなの経済新聞ネットワーク`, `TRILL ニュース`, `ねとらぼ`, `TBS NEWS DIG Powered by JNN`

**タイトルセレクタ**: `article h1`（article card の h1 はタイトルテキスト）  
実測: `"ヒマワリ迷路"`, `"「二度見しちゃった」華原朋美、現在の姿にネット騒然…"` など正確に取得

**ニュース記事リンク形式**: `a[href*="news.yahoo.co.jp/articles/"]`

**Shadow DOM**: なし

---

## 設計インプリケーション（まとめ）

| 項目 | YouTube 検索結果 | YouTube 視聴ページ関連 | Yahoo ニュース | Yahoo JAPAN |
|---|---|---|---|---|
| カード要素 | `ytd-video-renderer` | `yt-lockup-view-model` | `ul.newsFeed_list > li` | `article:has(cite):not(:has(article))` |
| 消す単位 | カード要素自体 | カード要素自体 | `li` 要素 | `article` 要素 |
| レイアウト | block（詰まる） | block（詰まる） | list-item（詰まる） | block（詰まる） |
| 発信元の在処 | `a[href*="/@"]` or `a[href*="/channel/"]` | **なし**（表示名テキストのみ） | `time.previousElementSibling` の `span` | `cite` 要素 |
| チャンネル識別子 | `/@handle` or `/channel/UC...`（両形式混在） | **取得不可** | 出版社名テキスト（安定） | 出版社名テキスト（安定） |
| タイトル | `a#video-title` | `span.ytAttributedStringHost` | 記事リンクテキスト − 出版社名 − 日時 | `article h1` |
| SPA | YES | YES | YES | — |
| 無限スクロール | YES（continuation要素） | YES（scroll） | NO（固定50件+別ページリンク） | — |
| Shadow DOM | **なし**（実測確認） | **なし**（実測確認） | なし | なし |
| ログイン必須 | 不要 | 不要 | 不要 | 不要 |

### 重要な判断ポイント

1. **Shadow DOM は YouTube に存在しない**。`ytd-video-renderer` も `yt-lockup-view-model` も通常 DOM。AliExpress での「isolated world から script 注入が効かない」問題は発生しない。

2. **YouTube 視聴ページ関連動画はチャンネルIDが取れない**。v2 設計でこの面をどう扱うかは要オーナー裁定。

3. **YouTube ホームページ（ログイン時）は未実測**。ホームの `ytd-rich-item-renderer` でチャンネルリンクが取れるかは確認が必要（チャンネルページで確認した同要素では取れなかった）。

4. **Yahoo ニュースのタイトルセレクタが不安定**（styled-components の難読化クラス）。タイトルテキストは「リンクのテキスト全体 − 出版社名 − 日時」で取得可能で、実測で正確に取れることを確認。

5. **Yahoo JAPAN の `<cite>` タグは意味論的に安定**で、セレクタとして信頼できる。
