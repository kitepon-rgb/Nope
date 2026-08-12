# EC3サイト 登録UI・実Chrome受入smoke（crui-package-smoke）

検証日: 2026-08-12 / 担当: bell / 環境: オーナーの通常Chrome

## 結論

楽天市場・Yahoo!ショッピング・Amazonの検索面で、登録ボタン表示、対象発信元のブロック、同一発信元カードへの一括反映、解除と元表示の復元を確認した。実Chrome検証中に2件の実装欠陥を発見し、修正・再梱包・再読み込み後に同じ受入を通した。

## 楽天市場

検索語「メモリ」の実ページで確認した。

- `.dui-card`: 50件
- `.cb-search-register-button`: 50件
- ボタン文言: `このショップをブロック`
- CPC広告と通常商品に共通するショップID `299852`（スマホメモリ専門スターフォーカス）を1件からブロックすると、同店の2カードがともにplaceholderへ切り替わった。
- placeholderの表示名は `スマホメモリ専門スターフォーカス`。
- ChromeツールバーのNopeポップアップに `楽天市場 (1)` / `スマホメモリ専門スターフォーカス` と表示され、押したカードのショップ名と一致した。
- 解除後はplaceholder 0件、50カード・50ボタンへ復元した。

## Yahoo!ショッピング

検索語「メモリ」の実ページで、初回smoke時に次の欠陥を発見した。

1. `div[class*="SearchResult_SearchResultItem"]`が商品カードだけでなく画像・本文などの子要素にも一致し、44商品へ90個のボタンを挿入していた。
2. 最初のストアドメインリンクは商品画像リンクのため、表示名が空または商品名になりうる状態だった。

修正内容:

- 商品カードを`SearchResult_SearchResult__*`直下の`SearchResult_SearchResultItem__*`だけに限定した。
- 発信元IDは従来どおりストアURLの第1パス要素から取得し、表示名はpathnameが`/{storeId}/`のストアホームリンクから取得するようにした。

最終実測:

- 商品カード: 44件
- 解決可能なショップの登録ボタン: 30件
- 1カード内に複数ボタンがあるカード: 0件
- `thanksjp`をブロックすると、表示名`サンクスジェピ`で同店の5カードがplaceholderへ切り替わった。
- ChromeツールバーのNopeポップアップに `Yahoo!ショッピング (1)` / `サンクスジェピ` と表示され、押したカードのストア名と一致した。
- 解除後はplaceholder 0件、同店5カードが復元した。

## Amazon

検索語「usbメモリ」の実ページで、Amazon直販とマーケットプレイス出品者を混在させて確認した。

初回smokeでは、同じASINが複数カードとして同時表示される場合と、AmazonのSPA再描画でcard要素だけ交換される場合に、ASIN単位の単一card mapが片方のカードしか更新しない欠陥を発見した。

修正内容:

- 非同期解決結果はASIN単位で1回だけ取得・共有する。
- 接続中の全card instanceをASINごとに保持し、登録UI・ブロック表示を全カードへ適用する。
- 切断済みcardをscan時に除去し、再描画後の新cardへ既知結果を通信なしで再適用する。

最終実測:

- 検索カード: 60件
- 出品者を解決できたカードの登録ボタン: 41件
- 同一ASIN重複カード `B0H5PPMHSG`: 2カード / 2ボタン
- 同一ASIN重複カード `B0H97HD4XQ`: 2カード / 2ボタン
- `B0H5PPMHSG`から出品者`プレミアム品質のショップ`をブロックすると、同一出品者の3カードがplaceholderへ切り替わり、対象ASINの2カードも両方ブロックされた。
- ChromeツールバーのNopeポップアップに `Amazon (1)` / `プレミアム品質のショップ` と表示され、押したカードの出品者名と一致した。
- 解除後はplaceholder 0件、対象ASINの2カードへ登録ボタンが2件とも即時復元した。
- 出品者情報が存在しないカードには登録ボタンを生成しなかった。

なお、初回対象の出品者名`品質保証価格競争力あり`は誤抽出に見えたため、商品ページの`#sellerProfileTriggerId`と出品者プロフィールを追加確認した。seller ID `A30CLCU65MKWW1`、プロフィール見出しとも同じ名称で、Amazon上の正式なストア名だった。

## ログ

3サイトとも`content-search`を含むNope固有のconsole error/warnは0件。楽天の広告pixel、Yahoo!本体のlegacy警告、Amazon本体のMIX C004はサイト自身のログであり、Nope由来ではない。

## 自動検証・配布物

```
node --test
```

結果: **227件 pass / 0 fail**。

- `node --test test/content-search.test.mjs test/adapters/yahoo_shopping.test.mjs`: 46件 pass / 0 fail
- `node scripts/pack.mjs`: ZIPとstable unpackedを再生成
- `unzip -t dist/chromeblocker-v2.0.0.zip`: error 0
- 最終ZIP SHA-256: `ed15b35231113ad9662342467c371d2323a2b406e77ef6a4a577ae6d75a66e5c`

## ポップアップ登録名と後片付け

`chrome-extension://.../popup/popup.html`を直接開く方式は使わず、実利用と同じChromeツールバーの「拡張機能」→「Nope」からポップアップを開いて確認した。3サイトとも、押したカードの発信元名、placeholder名、ポップアップ登録名が一致した。確認後はポップアップの削除ボタンで試験登録を削除し、楽天市場・Yahoo!ショッピング・Amazonの試験値が残っていないことを確認した。既存のAliExpress登録2件には触れていない。
