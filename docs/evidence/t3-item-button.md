# t3-item-button 完了証拠（2026-08-10）

## 実施

- src/content-item.js を実装。`a[href*="/store/"]` を MutationObserver で待ち、pathname から storeId、リンクテキストから店名（「販売者」接頭辞は除去、空なら `store:<id>` にフォールバック）を取得。
- 販売者表記の隣に「🚫 このストアをブロック」ボタンを注入。クリックで `CB_STORAGE.addBlockedStore` → トースト表示、ブロック済みなら「ブロック解除」ボタンに切替わり、クリックで `removeBlockedStore` → トースト表示。

## unit test

`node --test test/content-item.test.mjs` — 9/9 green（extractStoreName、findStoreLink 2件、createButton 4件ほか）。

## 実ブラウザ検証（bell実測 + sumire追認、2026-08-10）

agent-browser 隔離ブラウザに拡張ロード（`--headed --extension "C:/Users/kite_/Documents/Program/ChromeBlocker"`）、実在商品ページ `https://ja.aliexpress.com/item/1005009468037554.html` で以下を確認（全項目合格）:

1. **ボタン注入**（bell実測）: `.cb-block-button` 1個、文言「🚫 このストアをブロック」。クリックでトースト「Bestselling Makeup Store をブロックしました」（販売者接頭辞の除去も動作）、ボタンが「ブロック解除」へトグル、storage.sync 反映を popup 一覧で確認（Bestselling Makeup Store（1104977015））。スクリーンショット: `t3-button-injected.png`。
2. **ブロック解除クリック**（sumire追認、同商品ページ）: 初期状態「🚫 このストアをブロック」→ クリック → 「ブロック解除」（スクリーンショット: `t3-blocked.png`）→ 再クリック → 「🚫 このストアをブロック」へ復帰（スクリーンショット: `t3-unblocked.png`）。ボタン表示は `refresh()` が `CB_STORAGE.getBlockedStores()` の実storageを読んで決めるため、この往復トグルは追加→削除が実際に storage.sync へ反映されたことの挙動的証拠。

## 結論

設計メモの受入条件（注入・ブロック・ブロック解除・トースト・storage連携）を全て満たし、unit test・実ブラウザ検証（ブロック・解除の両方向）ともに合格。done とする。
