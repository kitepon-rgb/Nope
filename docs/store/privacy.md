# Nope — 見たくないもの見せません プライバシーポリシー

最終更新日: 2026-08-11

公開 URL（Chrome Web Store 申告用）: https://github.com/kitepon-rgb/Nope/blob/main/docs/store/privacy.md

Chrome Web Store デベロッパーダッシュボードの「Privacy practices」タブでの申告は、このページの内容と食い違わせないこと。

## 収集するデータ

Nope — 見たくないもの見せません（以下「本拡張」）の開発者は、ユーザーのデータを収集・受信しません。本拡張にアクセス解析・広告・トラッキング用の通信はなく、開発者や第三者が運営するサーバーも使用しません。発信元の識別に必要な場合だけ、閲覧中のサービス自身へページ上の公開識別子を問い合わせます。詳細は「対応サイト自身へのネットワーク通信」を参照してください。

- 個人を特定する情報の収集: なし
- 閲覧履歴・利用状況の収集: なし
- 開発者または第三者が運営するサーバーへの送信: なし
- 第三者への販売・提供: なし（そもそも収集していないため提供しようがない）

## 保存するデータとその保存先

本拡張が保存するデータは、すべてブラウザ標準の `chrome.storage` API を使い、ユーザーの端末（および Google アカウント同期先）にのみ保存されます。開発者のサーバーは存在せず、本拡張は一切のバックエンドを持ちません。

| データ | 保存先 | 内容 | 同期範囲 |
|--------|--------|------|----------|
| ブロック対象の発信元一覧 | `chrome.storage.sync`（キー `blockedSources`） | サイト別に登録したストア・出品者・チャンネル・出版社の ID、表示名、登録日時 | ユーザーの Google アカウントでログインした端末間 |
| ブロック対象のキーワード | `chrome.storage.sync`（キー `blockedKeywords`） | Yahoo ニュース / Yahoo! JAPAN でユーザーが登録したキーワード | 同上 |
| 表示モード設定 | `chrome.storage.sync`（キー `displayMode`） | ブロック済みカードを「プレースホルダー表示」「完全非表示」のどちらにするかの選択 | 同上 |
| 発信元の解決キャッシュ | `chrome.storage.local`（キー `itemSourceCache`） | サイトと商品・オークションIDから解決した発信元IDの対応（最大5000件、超過分は古いものから自動削除） | この端末のみ（同期されない） |

`chrome.storage.sync` は Chrome 標準の同期ストレージであり、Google アカウントを介した同期はブラウザ自身が行います。本拡張がこのデータを別途どこかへ送信することはありません。

## 対応サイト自身へのネットワーク通信

検索結果カードだけでは発信元を識別できない次のサイトで、閲覧中のサービス自身へ公開識別子を問い合わせます。

| サイト | 送信先 | リクエストへ追加する識別子 | 目的 | タイミング |
|---|---|---|---|---|
| AliExpress | `https://acs.aliexpress.com/` の内部API `mtop.aliexpress.pdp.pc.query` | 商品ID | ストアIDの解決 | 検索結果表示時（カードごと自動） |
| ヤフオク | `https://auctions.yahoo.co.jp/jp/auction/{オークションID}` | URLに含まれるオークションID | 詳細ページから出品者IDを解決 | 検索結果表示時（カードごと自動） |
| Amazon.co.jp | `https://www.amazon.co.jp/dp/{ASIN}` | URLに含まれるASIN | 詳細ページから販売者IDを解決 | 検索結果表示時（カードごと自動） |
| YouTube | `https://www.youtube.com/@{handle}` または `https://www.youtube.com/channel/{チャンネルID}` | URLに含まれるチャンネルのhandleまたはチャンネルID | handle形式とチャンネルID形式の対応関係を、チャンネル自身のページ応答（`canonical link`）から解決するため | ユーザーがチャンネルをブロック/解除操作した時のみ（検索結果・ホームの表示だけでは発生しない） |

この通信について、誤解を避けるため明確にしておきます。

- **送信先は閲覧中のサービス自身のドメインだけ**です。本拡張の開発者や、閲覧中のサービスと無関係な第三者のサーバーへ送信しません。
- **本拡張がリクエストへ追加する識別子は、表示中のページに含まれる公開の商品ID・オークションID・チャンネル識別子だけ**です。本拡張が氏名・メールアドレス・住所・支払い情報を読み取って送信することはありません。通常のページアクセスと同様に、ブラウザが対象サービス自身の Cookie や標準ヘッダーを自動付与する場合があります。
- AliExpress の問い合わせはページのコンテキスト内（`content_scripts[].world:"MAIN"`）で署名付きJSONPとして行い、ヤフオク・Amazon.co.jp・YouTube は同一オリジンの公開ページ（商品詳細ページ／チャンネルページ）を取得します。
- 解決した発信元ID・チャンネルIDの対応関係は上記の `itemSourceCache` にのみ保存され、他の宛先へ転送されません。
- YouTubeのみ、通信はユーザーの明示的なブロック/解除操作をきっかけに発生します（他の4サイトは検索結果の表示だけで自動的に発生します）。
- 楽天市場・Yahoo!ショッピング・Yahoo ニュース・Yahoo! JAPAN は表示中の DOM だけで判定し、発信元解決のための追加通信を行いません。

## Chrome Web Store「Privacy practices」タブでの申告方針

ダッシュボードの申告項目と、この文書の内容が一致するようにする。

- **Single purpose**: `docs/store/listing.md` の宣言文をそのまま使用
- **Permission justification**: `storage` と `content_scripts[].matches` に宣言した全ホストについて、`docs/store/listing.md` の該当節をそのまま使用
- **Data usage の各チェック項目**: 以下はすべて「該当しない（収集しない）」として申告する
  - Personally identifiable information
  - Health information
  - Financial and payment information
  - Authentication information
  - Personal communications
  - Location
  - Web history
  - User activity（キー操作・クリック等の収集は行っていない。ボタンクリックはローカルの `chrome.storage` 更新のトリガーとしてのみ使われ、どこにも送信・記録されない）
- **"I do not sell or transfer user data..." 等の certification 項目**: すべて事実として該当するのでチェックする
- **"This item handles user data" 系の宣言**: 開発者がユーザーデータを収集・受信しないため、"Does not collect user data" の立場で申告する。対応サイト自身への発信元解決通信は、上記の送信先・識別子・目的を Permission justification 側にも記載する（`listing.md` 参照）

## 変更履歴

- 2026-08-10: r6-store-listing にて新規作成
- 2026-08-11: v2.0.0 の7サイト対応、現行ストレージキー、同一サイトへの発信元解決通信へ更新
- 2026-08-11: YouTube（yt-home-search）へhandle→チャンネルID解決の通信を追加（ブロック/解除操作時のみ）
