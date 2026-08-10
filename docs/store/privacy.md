# Nope — 見たくないもの見せません プライバシーポリシー

最終更新日: 2026-08-11

公開 URL（Chrome Web Store 申告用）: https://github.com/kitepon-rgb/Nope/blob/main/docs/store/privacy.md

Chrome Web Store デベロッパーダッシュボードの「Privacy practices」タブでの申告は、このページの内容と食い違わせないこと。

## 収集するデータ

Nope — 見たくないもの見せません（以下「本拡張」）は、開発者を含むいかなる相手に対しても、ユーザーのデータを収集・送信しません。

- 個人を特定する情報の収集: なし
- 閲覧履歴・利用状況の収集: なし
- 外部サーバー（本拡張の開発者が管理するサーバーを含む）への送信: なし
- 第三者への販売・提供: なし（そもそも収集していないため提供しようがない）

## 保存するデータとその保存先

本拡張が保存するデータは、すべてブラウザ標準の `chrome.storage` API を使い、ユーザーの端末（および Google アカウント同期先）にのみ保存されます。開発者のサーバーは存在せず、本拡張は一切のバックエンドを持ちません。

| データ | 保存先 | 内容 | 同期範囲 |
|--------|--------|------|----------|
| ブロック対象ストア一覧 | `chrome.storage.sync`（キー `blockedStores`） | ユーザーが登録した AliExpress ストアの ID・名前・登録日時 | ユーザーの Google アカウントでログインした端末間 |
| 表示モード設定 | `chrome.storage.sync`（キー `displayMode`、r1-placeholder で追加） | ブロック済み商品を「プレースホルダー表示」「完全非表示」のどちらにするかの選択 | 同上 |
| 商品→ストア対応キャッシュ | `chrome.storage.local`（キー `productStoreCache`） | AliExpress の商品ID と、その商品が属するストアIDの対応（最大5000件、超過分は古いものから自動削除） | この端末のみ（同期されない） |

`chrome.storage.sync` は Chrome 標準の同期ストレージであり、Google アカウントを介した同期はブラウザ自身が行います。本拡張がこのデータを別途どこかへ送信することはありません。

## AliExpress へのネットワーク通信について

本拡張は、商品ページのリンクだけでは対応するストアIDが取得できない場合に、AliExpress 自身の内部API（`mtop.aliexpress.pdp.pc.query`、エンドポイント `https://acs.aliexpress.com/`）へ商品IDを問い合わせます（実装: `src/mtop.js` / `src/mtop-main-relay.js`）。

この通信について、誤解を避けるため明確にしておきます。

- **送信先は AliExpress 自身のドメイン（`acs.aliexpress.com`）のみ**です。本拡張の開発者のサーバーや、AliExpress・開発者以外の第三者への送信は一切行いません。
- **送信する内容は商品IDのみ**です。ユーザーの氏名・メールアドレス・住所・支払い情報などを送信することはありません。
- この通信は、ユーザーが AliExpress 自身のサイトを閲覧している最中に、そのページのコンテキスト内（`content_scripts[].world:"MAIN"`）で行われます。技術的にはページ自身が発行する通信と同じ扱いであり、本拡張が新たな宛先へデータを持ち出すものではありません。
- レスポンス（ストアID）は上記の `productStoreCache` にのみ保存され、他のどこにも転送されません。

## Chrome Web Store「Privacy practices」タブでの申告方針

ダッシュボードの申告項目と、この文書の内容が一致するようにする。

- **Single purpose**: `docs/store/listing.md` の宣言文をそのまま使用
- **Permission justification**: `storage` と `*://*.aliexpress.com/*`（content script によるホストアクセス）について、`docs/store/listing.md` の該当節をそのまま使用
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
- **"This item handles user data" 系の宣言**: 上記の通り外部への送信・収集が存在しないため、"Does not collect user data" の立場で申告する。mtop API 通信については審査員向けの補足として、上記「AliExpress へのネットワーク通信について」の説明を Permission justification 側に含めてある（`listing.md` 参照）

## 変更履歴

- 2026-08-10: r6-store-listing にて新規作成
