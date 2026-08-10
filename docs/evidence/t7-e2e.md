# t7-e2e 完了証拠（2026-08-10）

## 検証手段について（design memo からの変更点）

design memo は当初「Claude in Chrome」経由でユーザーの実 Chrome に `chrome://extensions` から手動ロードしてもらう想定（"ユーザー操作が必要な可能性→依頼する"）だった。しかし t3/t4/t5/t6 で使用した `agent-browser --extension <path>` は拡張機能を自動ロードでき、ユーザー操作なしに実ブラウザ・実DOM・実ネットワークでの検証が完結する。よって本タスクでは agent-browser による自動化実測を E2E 検証手段として採用した。design memo が指定した具体的な検証対象（商品 `1005012897132115`、検索語 `wholesale-CMP-170HX`）はそのまま使用し、1つの継続したブラウザセッション内で通しで検証した。

## 検証項目と結果（design memo の受入条件）

### ① 商品ページでボタン表示→クリックでブロック

- 商品 `https://ja.aliexpress.com/item/1005012897132115.html` を開き、`.cb-block-button` が1個注入されていることを確認。
- ページ上の販売者リンクが `//ja.aliexpress.com/store/1100223114`・テキスト「販売者NailNest Store」であることを確認（design memo記載の対象と一致）。
- ボタンをクリック→「ブロック解除」へトグル。スクリーンショット: `t7-item-blocked.png`。

### ② 検索 `wholesale-CMP-170HX` で該当カードが消える

- 検索ページ `https://ja.aliexpress.com/w/wholesale-CMP-170HX.html` を開き、`a.search-card-item` 30件を検出。商品 `1005012897132115` がこの検索結果に含まれることを確認。
- 別タブから NailNest Store（`1100223114`）をブラックリストに追加（`chrome.storage.sync.set`）。
- **検索結果ページをリロードせずに**該当カードの外側 wrapper（`.card-out-wrapper`）が `display:none` になっていることを確認。スクリーンショット: `t7-search-hidden.png`。
- この間、`agent-browser network requests` で `acs.aliexpress.com/h5/mtop.aliexpress.pdp.pc.query` への実リクエストが33件発生していることを確認（cache未ヒットカードの実mtop解決）。

### ③ ポップアップで一覧・削除・URL追加が機能

- popup（`chrome-extension://.../popup/popup.html`）を開き、NailNest Store が一覧表示されていることを確認。スクリーンショット: `t7-popup-list.png`。
- 「ストアURL または ID」欄に `https://ja.aliexpress.com/store/1102351234`・名前欄に「手動テストストア」を入力して追加ボタンをクリック → `chrome.storage.sync` に2件目が正しいID（`1102351234`）で追加されたことを確認（`parseStoreInput` のURLパースが実ブラウザでも機能）。スクリーンショット: `t7-popup-two-entries.png`。
- 削除ボタンを2回クリックして両エントリを削除 → `chrome.storage.sync.blockedStores` が `{}` になり、空状態表示に戻ることを確認。スクリーンショット: `t7-popup-empty.png`。

### mtop 解決の実レスポンスでの裏取り（t4フィールド名の再確認）

- ②の検索ページ検証中に自動発生した33件の mtop 実リクエストにより、`SHOP_CARD_PC.sellerInfo.storeNum` からの storeId 解決が本番の検索結果ページ・複数商品でも一貫して機能することを確認（t4 で確定したフィールド名がここでも再現）。

## 後始末

検証後、ブラックリストを空に戻した（`chrome.storage.sync.set({blockedStores:{}})`）。

## 結論

design memo の3項目（①商品ページでのブロック、②検索結果での非表示、③popupでの一覧/追加/削除）すべてを、design memo指定の商品・検索語で1セッション通しで実機相当検証し、全項目合格。mtop実レスポンスでのstoreIdフィールド確定もt4に加えてここで再確認された。done とする。
