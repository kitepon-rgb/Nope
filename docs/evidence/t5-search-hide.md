# t5-search-hide 完了証拠（2026-08-10）

## 実施

- `src/content-search.js`（新規）: 検索結果カード（`a.search-card-item`）の href から productId を抽出し、
  `.card-out-wrapper`（外側グリッドセル）ごと `display:none` で完全非表示にする。
  - キャッシュ（`CB_STORAGE.getCachedStore`）命中なら即判定。
  - 未解決なら `createResolveQueue`（同時2並列・間隔300ms）経由で `CB_MTOP.resolveStoreId` に投げ、解決後に判定・cache保存（`resolveStoreId` 内部で保存）。
  - 解決失敗は表示のまま `console.warn`（静かなフォールバック禁止）。
  - `MutationObserver` で `document.body` を監視し、無限スクロールで増えるカードにも追従。
  - `CB_STORAGE.onBlockedStoresChanged` を購読し、ブロックリスト変更時に既知の全カードへ即時再適用（ページ再読込不要）。
- `manifest.json`: content_scripts の js 配列へ `src/content-search.js` を復元（t4完了までの一時除外を解除、受入条件どおり）。

## unit test

`node --test test/*.test.mjs` — 43/43 green。`test/content-search.test.mjs` 10件:
- `extractProductId`（正常/クエリ付き/非対象URL/空文字）
- `findWrapper`（closest命中/フォールバック/null安全）
- `applyVisibility`（block時none/unblock時復元/wrapper null安全）
- `createResolveQueue`（同時実行数の上限、失敗の伝播）
- `scan`〜可視反映のオーケストレーション（cache命中即判定、未ブロック維持、cache未ヒット→mtop解決、blockedStores変更時の即時再適用）

`createResolveQueue`・`init/scan` は DOM/非同期スケジューラのロジックを fake document・fake storage・fake mtop で検証（実ブラウザでの MutationObserver 統合・実 mtop 通信は下記の実測で担保）。

## 実ブラウザ検証（sumire実測、2026-08-10）

agent-browser 隔離ブラウザに拡張ロード（`--headed --extension "C:/Users/kite_/Documents/Program/ChromeBlocker"`）、実際の検索結果ページ `https://ja.aliexpress.com/w/wholesale-makeup.html` で確認:

1. **カード検出**: `a.search-card-item` 30件、`.card-out-wrapper` 30件を検出。
2. **キャッシュ自動解決**: ページロード後、content-search.js が自動的に mtop へ productId→storeId 解決リクエストを発行（`agent-browser network requests` で `mtop.aliexpress.pdp.pc.query` への実リクエストを確認）。解決結果が `chrome.storage.local.productStoreCache` へ保存されることを拡張の popup ページ（`chrome-extension://.../popup/popup.html`）から `chrome.storage.local.get` で確認（例: productId `1005008557853183` → storeId `1103573332`）。
3. **ブロック適用（リロード無し・即時反映）**: 検索結果タブとは別タブでブラックリストに `1103573332` を追加（`chrome.storage.sync.set`）。**ページを再読み込みせずに**検索結果タブへ戻り、該当カード（productId `1005008557853183`）の外側 wrapper が `display:none` になっていることを確認（`onBlockedStoresChanged` 経由の即時再適用が実動作することの直接証拠）。スクリーンショット: `t5-hidden.png`。
4. **解除で復元**: 同じ手順でブラックリストを空に戻すと、リロード無しで該当カードの wrapper が `display:block`（表示）に戻ることを確認。
5. ブロック対象外のストアのカードは終始 `display:block` のまま変化しないことを確認（誤爆なし）。

## 結論

設計メモの受入条件（productId抽出・外側wrapper単位の完全非表示・cache優先/mtop解決・同時2並列間隔300ms・MutationObserverでの追従・blockedStores変更の即時反映・解決失敗時は表示のままwarn）を全て満たし、unit test・実ブラウザ検証（ブロック/解除の両方向、リロード無しの即時反映を含む）ともに合格。done とする。
