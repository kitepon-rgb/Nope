# Store v2.0.1 raw browser captures

Chrome Web Store用visualの一次画面。完成素材と役割を分け、加工前の実ブラウザ観測を残す。

## Capture environment

- 日付: 2026-08-15
- Browser: Chrome for Testing 152.0.7977.42
- 読込方法: `dist/nope-v2.0.1-unpacked`を隔離profileへLoad unpacked
- extension ID: `mhbkafebejanoieofefcnlplbdimfkhj`
- manifest version: `2.0.1`
- 商品面: `https://ja.aliexpress.com/item/1005009468037554.html`
- 検索面: `https://ja.aliexpress.com/w/wholesale-HANDAIYAN.html`

## 観測と操作

1. 隔離profileの設定を空へ戻し、実在する商品面でNopeの「このストアをブロック」を操作した。
2. 操作後のbuttonが「ブロック解除」へ変わり、`Bestselling Makeup Store`が`chrome.storage.sync`へ保存されたことを確認した。
3. 実extension popupからYahooニュース群のキーワード`生成AI`を追加した。
4. 同じ実extension popupでplaceholder / collapseを切り替え、同じAliExpress検索面を再読込した。
5. placeholderでは現行Nope mascotの置換を3件、collapseではplaceholder 0件を観測した。件数は撮影時の動的検索結果であり、製品性能や対応保証の数値として公開しない。

## Raw files

| file | 一次事実 | SHA-256 |
|---|---|---|
| `01-placeholder-raw.png` | placeholder選択時の実検索面 | `a5a66a07ca17937bce1c88d479d6b73394ade8ae4f01f974d8d897e6891ede3e` |
| `02-block-control-raw.png` | ブロック前の商品面と注入済み操作 | `e5deda1e014d19b71d20c18b4f705a95e075e46a7ab5997a12ec7800cc66467e` |
| `02-blocked-result-raw.png` | 操作後に解除へ変わった同じ商品面 | `ee44074f4d299c3b5224927ba3330e6008794352def187b00eaedc30cfbbb2a4` |
| `03-popup-raw.png` | 発信元・キーワード・表示モードを描画した実popup | `60a3bbdde846e508524d701593a6d210466bcd29ca9dd1e9ab2b1b5d63f6a90b` |
| `04-collapse-raw.png` | collapse選択時の同じ検索面 | `10b18555fb12a71db8d58c7f4c64fea262f6642d75c6420a5b7357ce86131d77` |

撮影はRootSitePromotionの`scripts/capture-nope-store-raw.mjs`で行った。ブラウザ外でstorageへ完成状態を捏造せず、発信元ブロック、キーワード追加、表示モード変更は実extension UIから操作した。capture後のStore用編集は`assets/store/README.md`へ分離する。
