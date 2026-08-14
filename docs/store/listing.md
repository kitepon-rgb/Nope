# Chrome Web Store 掲載情報（listing）

r6-store-listing の成果物。Chrome Web Store デベロッパーダッシュボードの「Store listing」タブ入力時にこのまま転記できる形でまとめる。r7-submit が実際の入力・提出を行う。

事実確認元: `manifest.json`（permissions・content_scripts）、`src/storage.js`、`src/mtop.js`、`src/mtop-main-relay.js`、`src/content-item.js`、`popup/popup.html`、`docs/evidence/*`、`docs/plan_chromeblocker-release.md`（2026-08-12 時点）。

---

## 製品名・URL

- **製品名**: Nope — 見たくないもの見せません
- **Homepage URL**: https://kitepon.dev/
- **Privacy policy URL**: https://github.com/kitepon/Nope/blob/main/docs/store/privacy.md

---

## Single purpose（単一目的の宣言）

> ユーザーが指定した発信元またはキーワードに基づいて、閲覧中の Web ページから不要なコンテンツを非表示にする。

**日本語（ダッシュボード入力用、そのまま）:**

ユーザーが指定した発信元またはキーワードに基づいて、閲覧中の Web ページから不要なコンテンツを非表示にします。

**この宣言の根拠と実装の現状:**

v2.0.0 では7サイトの発信元ブロックと、Yahoo ニュース / Yahoo! JAPAN のキーワードブロックを実装済み（`docs/roadmap-block-targets.md`、`docs/evidence/nope-v2-terminal-audit.md` 参照）。宣言文は将来像ではなく、現在の実装をそのまま要約している。

拡張の実装は複数の対応ページとポップアップにまたがるが、すべて上記1目的のための手段でしかない。

- `src/content-search.js`（検索結果ページ）: 非表示そのものを実行する中核機能
- `src/content-name.js`（ニュース一覧）: 表示名で発信元を判定し、非表示を実行する中核機能
- `src/content-item.js`（商品ページ）: 「このストアをブロック」ボタン＝非表示対象（ブロックリスト）への追加・解除の入力手段
- `popup/`（拡張アイコンクリック時）: ブロック対象とキーワードの一覧表示・追加・削除・キャッシュクリア＝非表示対象を管理する手段

---

## Permission justification（権限の正当化）

Chrome Web Store の権限一覧には `manifest.json` の `permissions` と `content_scripts.matches` の両方がホストアクセスとして表示される。実際の `manifest.json`（v2.0.0 時点）は次の通り:

```json
"permissions": ["storage"],
"content_scripts": [
  { "matches": ["*://*.aliexpress.com/*"], "js": ["src/mtop-main-relay.js"], "world": "MAIN", "run_at": "document_start" },
  { "matches": ["*://*.aliexpress.com/*"], "js": ["src/md5.js", "src/storage.js", "src/mtop.js", "src/content-item.js", "src/content-search.js", "src/content-aliexpress-init.js"], "run_at": "document_idle" },
  { "matches": ["*://search.rakuten.co.jp/*"], "js": ["src/storage.js", "src/content-search.js", "src/adapters/rakuten.js"], "run_at": "document_idle" },
  { "matches": ["*://shopping.yahoo.co.jp/*"], "js": ["src/storage.js", "src/content-search.js", "src/adapters/yahoo_shopping.js"], "run_at": "document_idle" },
  { "matches": ["*://www.youtube.com/*"], "js": ["src/storage.js", "src/content-search.js", "src/adapters/youtube.js"], "run_at": "document_idle" },
  { "matches": ["*://auctions.yahoo.co.jp/*"], "js": ["src/storage.js", "src/content-search.js", "src/adapters/yahoo_auction.js"], "run_at": "document_idle" },
  { "matches": ["*://www.amazon.co.jp/*"], "js": ["src/storage.js", "src/content-search.js", "src/adapters/amazon.js"], "run_at": "document_idle" },
  { "matches": ["*://news.yahoo.co.jp/*"], "js": ["src/storage.js", "src/keyword-filter.js", "src/content-name.js", "src/adapters/yahoo_news.js"], "run_at": "document_idle" },
  { "matches": ["*://www.yahoo.co.jp/*"], "js": ["src/storage.js", "src/keyword-filter.js", "src/content-name.js", "src/adapters/yahoo_japan.js"], "run_at": "document_idle" }
]
```

**`src/content-aliexpress-init.js` について**: 共通エンジン `content-search.js` は AliExpress 以外の
entry でも読み込まれるため、AliExpress 既定アダプタの起動だけをこの専用 entry が担う。
共通エンジン末尾で無条件に起動していた実装は、他サイトで意図しない起動を招いたため撤去した
（`docs/evidence/v7-fix-a-double-start.md`）。

**注意**: `manifest.json` に `host_permissions` フィールドは存在しない。各ドメインは `content_scripts[].matches` としてのみ宣言されている（`host_permissions` の明示追加は t4-mtop で「不要と判明」として見送られた——`docs/evidence/t4-mtop.md` 参照）。Chrome Web Store の権限表示・審査上は `content_scripts.matches` も実質的にホストアクセスとして扱われるため、以下ではこれを「ホストアクセス（content script 経由）」と呼ぶ。

### `storage`

ブロック対象の発信元一覧（`chrome.storage.sync` の `blockedSources`。サイト別にキー分けされた構造）、キーワード一覧（同 `blockedKeywords`。Yahoo ニュース / Yahoo! JAPAN のサイト別配列）、表示モード設定（同 `displayMode`、既定値 `placeholder`）、発信元IDの別形式対応（同 `sourceAliases`。YouTubeのhandle→チャンネルID対応。blockedSourcesと同じく端末間同期が必要なため`sync`に置く）を端末間で同期して保持するために必要。加えて itemId→sourceId の解決結果キャッシュ（`chrome.storage.local` の `itemSourceCache`、`{siteKey}:{itemId}` 形式のキーでフラット保存）を保存するために必要。これらはすべて拡張の中核機能（非表示判定の高速化・ブロック対象の永続化）に直結し、他の権限では代替できない。

### ホストアクセス `*://*.aliexpress.com/*`（content script）

以下すべて AliExpress ドメイン上でのみ実行され、他ドメインでは一切動作しない。

- **検索結果ページ**（`content-search.js` + `aliexpress` アダプタ）: 商品カード（`a.search-card-item`）の href から productId を読み取り、ブロック対象ストアかどうか判定して非表示にするために必要。
- **商品ページ**（`content-item.js`）: ページ内のストアリンク（`a[href*="/store/"]`）から storeId を取得し、「このストアをブロック」ボタンを注入するために必要。
- **mtop API 中継**（`mtop.js` / `mtop-main-relay.js`）: 検索結果カードの href には storeId が含まれないため、productId→storeId の解決に AliExpress 自身の内部 API（`mtop.aliexpress.pdp.pc.query`、エンドポイント `acs.aliexpress.com`）を呼ぶ。**これは AliExpress 自身のエンドポイントであり、拡張の開発者を含むいかなる外部サーバーへも何も送信していない。** ブラウザの CORS 制約を避けるため、`content_scripts[].world:"MAIN"`（Chrome 111+ の正規機能）でページと同じコンテキストから JSONP リクエストを行う設計（`docs/evidence/t4-mtop.md` 参照）。

### ホストアクセス `*://search.rakuten.co.jp/*`（content script）

楽天市場の検索結果ページのみで実行される。

- **検索結果ページ**（`content-search.js` + `rakuten` アダプタ）: 商品カード（`.dui-card`）の`data-shop-id`から店舗IDを、`.content.merchant`から表示名を取得し、ブロック対象かどうか判定して非表示にするために必要。通常商品とCPC広告の双方をDOMだけで判定し、外部APIへのリクエストは行わない。

### ホストアクセス `*://shopping.yahoo.co.jp/*`（content script）

Yahoo!ショッピングの検索結果ページのみで実行される。

- **検索結果ページ**（`content-search.js` + `yahoo_shopping` アダプタ）: 商品カード内の`store.shopping.yahoo.co.jp/{storeId}/{item}.html`形式のリンクからstoreIdを取得し、ストアホームリンクから表示名を取得して、ブロック対象かどうか判定し非表示にするために必要。発信元の識別子はDOMから同期取得できるため、外部APIへのリクエストは行わない。

### ホストアクセス `*://www.youtube.com/*`（content script、検索結果・ホーム）

マッチパターンはYouTube全ページに及ぶが、動画カードが実在する検索結果ページとホームでのみ実質的に動作する。ホームと検索結果の双方で、同じチャンネルを正しくブロック・解除できることを実ブラウザで確認済み。

- **検索結果ページ・ホーム**（`content-search.js` + `youtube` アダプタ、パターンA）: 動画カード内のチャンネルリンク（`a[href*="/@"]` または `a[href*="/channel/"]`）からチャンネル識別子を取得し、ブロック対象かどうか判定して非表示にするために必要。
- **チャンネルID解決**: handle形式（`/@handle`）とチャンネルID形式（`/channel/UC...`）が同一チャンネルを指す場合に片方だけブロックが効かなくなる問題を避けるため、ユーザーがチャンネルをブロック/解除する操作をした時だけ（カードの表示・スキャンだけでは発生しない）、当該チャンネル自身のページ（`https://www.youtube.com/@{handle}` または `https://www.youtube.com/channel/{チャンネルID}`）を取得し、応答に含まれる`canonical link`から正本のチャンネルIDを解決する。**アクセス先はYouTube自身のドメインのみ。拡張の開発者サーバーへは何も送信しない。** 解決結果は`chrome.storage.sync`の`sourceAliases`に保存し（blockedSourcesと同じく端末間で共有し、同じhandleへの重複リクエストを他端末でも回避する）、解決に失敗した場合はブロック操作自体を提供しない（表示名などへの推測フォールバックはしない）。

### ホストアクセス `*://news.yahoo.co.jp/*`（content script）

Yahoo ニュースのニュース一覧ページのみで実行される。

- **ニュース一覧**（`content-name.js` + `yahoo_news` アダプタ、パターンB）: 記事カード（`ul.newsFeed_list > li`）内の出版社名テキスト（`time` の前の要素）でブロック対象かどうか判定して非表示にするために必要。DOM に出版社へのリンクが存在しないため表示名マッチを使用する（`nameOnly: true` エントリ）。キーワードフィルタ（`keyword-filter.js`）も同一エントリでロードし、指定キーワードを含む記事タイトルを追加でブロックできる。外部 API へのリクエストは行わない。

### ホストアクセス `*://www.yahoo.co.jp/*`（content script）

Yahoo! JAPAN のトップページのみで実行される。

- **トップページのニュースフィード**（`content-name.js` + `yahoo_japan` アダプタ、パターンB）: 記事カード（`article:has(cite):not(:has(article))`）内の `cite` 要素から出版社名を取得し、ブロック対象かどうか判定して非表示にするために必要。DOM に出版社へのリンクが存在しないため表示名マッチを使用する（`nameOnly: true` エントリ）。キーワードフィルタ（`keyword-filter.js`）も同一エントリでロードし、指定キーワードを含む記事タイトルを追加でブロックできる。外部 API へのリクエストは行わない。

### ホストアクセス `*://auctions.yahoo.co.jp/*`（content script）

ヤフオクの検索結果ページのみで実行される。

- **検索結果ページ**（`content-search.js` + `yahoo_auctions` アダプタ）: 出品カード（`li.Product`）の `data-auction-id` 属性からオークションIDを取得し、出品者を特定して非表示にするために必要。カード内に出品者リンクが存在しないため、オークション詳細ページを fetch して出品者 ID を解決する（**アクセス先は auctions.yahoo.co.jp のみ。拡張の開発者サーバーへは何も送信しない**）。解決結果はローカルキャッシュ（`chrome.storage.local`）に保存し、同じオークション ID への重複リクエストを回避する。

### ホストアクセス `*://www.amazon.co.jp/*`（content script）

Amazon.co.jp の検索結果ページのみで実行される。

- **検索結果ページ**（`content-search.js` + `amazon` アダプタ）: 商品カード（`div[data-component-type="s-search-result"]`）の `data-asin` 属性から ASIN を取得し、出品者を特定して非表示にするために必要。カード内に出品者リンクが存在しないため、商品詳細ページを fetch して出品者 ID を解決する（**アクセス先は amazon.co.jp のみ。拡張の開発者サーバーへは何も送信しない**）。解決結果はローカルキャッシュ（`chrome.storage.local`）に保存し、同じ ASIN への重複リクエストを回避する。

---

## Privacy declaration（プライバシー申告、要約）

詳細は `docs/store/privacy.md`（公開URL: https://github.com/kitepon/Nope/blob/main/docs/store/privacy.md）。ダッシュボードの **Privacy practices** タブでの申告方針:

- **Data handling**: 本拡張は、機能提供のために認証情報（AliExpressの`_m_h5_tk`トークン）、ウェブ履歴（現在の対応ページとカードURL）、ウェブサイト内容（タイトル・リンク・発信元情報）をブラウザ内で処理する。一部の公開識別子とAliExpress署名は閲覧対象サイト自身へ送信する。開発者・提供者はデータを収集・受信せず、無関係な第三者への送信もない。
- **Data usage 該当あり**: Authentication information / Web history / Website content。
- **Data usage 該当なし**: Personally identifiable info / Health info / Financial and payment info / Personal communications / Location / User activity。
- **Certify compliance**: Developer Program Policies への準拠を宣言する（該当時にチェック）。

### Remote code declaration

- **申告**: 「はい、リモートコードを使用しています」。
- **理由**: AliExpressのストアID解決APIがJSONPのみを返すため、その応答をAliExpressページの`MAIN` worldで実行する。このコンテキストはChrome拡張APIへアクセスできず、拡張側へはシリアライズしたAPI応答データだけを`CustomEvent`で返す。Chrome Web StoreのManifest V3追加要件が認める「拡張APIから隔離されたコンテキスト」の範囲に限定し、開発者サーバー由来のコードは一切読み込まない。

---

## Description（説明文）

### 短い説明（Short description、132文字以内）

> 指定した発信元やキーワードのコンテンツを閲覧中のWebページから非表示にします。AliExpress・楽天・Amazon・YouTube・Yahoo!など7サイトに対応。

### 詳細説明（Detailed description、実入力）

> 閲覧中のWebページから、指定した発信元やキーワードのコンテンツを非表示にするChrome拡張機能です。
>
> 【できること】
> - 対応サイトの検索結果や一覧ページで、指定したショップ・チャンネル・出版社のコンテンツを自動的にブロック
> - ページ上の「ブロック」ボタンから発信元を登録
> - Yahoo!ニュース／Yahoo! JAPANでは、指定キーワードを含む記事もブロック
> - 拡張アイコンのポップアップから、ブロック中の発信元やキーワードを確認・削除
> - ブロック済みコンテンツは、プレースホルダー表示または完全に非表示にして詰める表示から選択
>
> 【データの扱い】
> - ブロック判定のため、対応ページのURL・タイトル・発信元をブラウザ内で処理します
> - AliExpressでは、同サイト発行トークンを商品識別用の署名生成にのみ利用します
> - 開発者や無関係な第三者が運営するサーバーへユーザーデータを送信しません
> - ブロックリストと設定はchrome.storageを利用して保存します
> - 発信元の解決に必要な通信は、閲覧対象サイト自身のドメインに対してのみ行います
>
> 【対応サイト】
> AliExpress、楽天市場、Yahoo!ショッピング、ヤフオク、Amazon.co.jp、YouTube、Yahoo!ニュース、Yahoo! JAPAN

**誇大表現・煽り文言の排除について**: 拡張内部の UI（トースト通知等、`src/content-item.js`）には煽情的な文言はない（「〇〇をブロックしました」「〇〇のブロックを解除しました」という淡々とした通知のみ）。

---

## Category / Language（カテゴリ・言語）

- **Category**: Tools（ショッピング・動画・ニュースを横断する汎用コンテンツフィルターであり、特定の買い物体験だけを主機能としないため。Chrome Web Store の現行カテゴリ定義では「他カテゴリに収まらないツール」に該当）
- **Language**: 日本語（ja）のみ。`popup/popup.html` は `lang="ja"`、拡張内メッセージもすべて日本語。多言語対応は未実装のため、英語等での申請はしない
- **Pricing**: 料金なし（アプリ内購入なし）
- **Visibility**: 公開
- **Regions**: すべての地域

---

## Screenshots（実際の掲載順）

ブランド適用後の画像は b4-verify が 2026-08-12 に実ブラウザで撮り直した（`docs/evidence/b4-verify.md` 参照）。既定表示モードは `placeholder`（プレースホルダー表示）であり、商品が「消える」のは `collapse` モードへ切り替えた場合だけである。誤って「既定で商品が消える」と説明しないよう、1番をプレースホルダー表示、4番を collapse モードとして分ける。

| # | シーン | 画像ファイル |
|---|--------|--------------|
| 1 | ブロック済みストアの商品をマスコットプレースホルダーへ置換 | `docs/evidence/ac3-placeholder.png` |
| 2 | ブロック中の発信元と表示モードを管理するポップアップ | `docs/evidence/ac2-popup.png` |
| 3 | 完全非表示（collapse）モード | `docs/evidence/ac5-collapse.png` |
| 4 | ブロック解除後の通常表示 | `docs/evidence/ac3-unblock.png` |

4枚ともb4-verifyで2026-08-12に実ブラウザ撮影した1280×800・24ビットPNG（アルファなし）。
