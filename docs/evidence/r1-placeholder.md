# r1-placeholder 完了証拠（2026-08-10）

## 実施

- **src/storage.js**: 先行workerが追加済みだった `DEFAULT_DISPLAY_MODE`（既定 `'placeholder'`）/ `ALLOWED_DISPLAY_MODES`（`['placeholder', 'collapse']`）/ `normalizeDisplayMode`（不明値は `console.warn` を出して既定値へフォールバック）を拾い、`getDisplayMode()` / `setDisplayMode(mode)` / `onDisplayModeChanged(cb)` を追加。保存先は `chrome.storage.sync` の `displayMode` キーで、既存 `onBlockedStoresChanged` と同じ購読パターン。
- **src/content-search.js**:
  - `findWrapper` の優先順を ①`link.closest('[class*="search-item-card-wrapper"]')` ②`.card-out-wrapper` ③`parentElement` へ変更。
  - `applyVisibility(wrapper, blocked, options)` を2モード対応に拡張。`options = { mode, storeName, onUnblock }`。
    - `collapse`: 従来どおり wrapper ごと `display:none`（プレースホルダーが残っていれば復元してから畳む）。
    - `placeholder`（既定・mode省略時のフォールバックも同じ）: wrapper 自体は表示のまま、元の子要素を `WeakMap` へ退避して `display:none` にし、猫あっかんべーSVG＋「ブロック済み」＋ストア名（`textContent`。XSS防止のため innerHTML には混ぜない）＋「ブロック解除」ボタンから成るプレースホルダー（class `cb-blocked-placeholder`）を挿入。二重挿入防止あり。解除ボタンの click は `preventDefault`/`stopPropagation`（カード全体が a タグのため）。`onUnblock` は `storage.removeBlockedStore(storeId)` を呼ぶ。
    - 猫SVGはオーナー承認済みラフをそのまま定数化（`CAT_SVG_MARKUP`、定数のみを innerHTML に渡す）。
  - `init()` の `start()` で起動時に `storage.getDisplayMode()` を読み、`storage.onDisplayModeChanged` を購読して displayMode 変更時に既知カード全件へ即時再適用。`buildVisibilityOptions(storeId)` で `blockedStores[storeId].name` からストア名を options へ渡す。
- **popup/**: `popup.html` にラジオボタン（`あっかんべー表示` / `完全に消す`、`name="display-mode"`）の fieldset を追加。`popup.js` に `bindDisplayModeControl(radios, storage)` を追加し `init()` から呼ぶ（現在の displayMode に応じて checked を設定、change で `setDisplayMode` を呼ぶ）。`popup.css` に軽くスタイルを追加。

## unit test

`node --test test/*.test.mjs` — 61/61 green（storage.js 8件、content-search.js 21件、popup.js 11件、他既存21件）。

- storage.js: `getDisplayMode`/`setDisplayMode`/不明値フォールバック/`onDisplayModeChanged` の4件を追加。chromeMock の `set` を `blockedStores` 専用から任意キーの変更通知へ拡張（`displayMode` の変更も `onChanged` を発火するよう修正）。
- content-search.js: `findWrapper` の新優先順（4件）、`applyVisibility` のモード分岐（collapse/placeholder往復・二重挿入防止・XSS防止・解除ボタンのpreventDefault/stopPropagation・collapseへの切替時のプレースホルダー復元、計8件）、displayMode変更時の即時再適用（1件）を新規追加。既存4件の scan 統合テストは `mode: 'collapse'` 固定にして従来のアサーションをそのまま維持（storageモックへ `getDisplayMode`/`onDisplayModeChanged` を追加）。
  - fake DOM のバグを1件発見・修正: テスト側 `makeFakeElement` の `remove()` が no-op で親の `children` から実際に取り除かれず、`style.display` の初期値も `undefined`（実DOMは `''`）だったため、往復動作の検証で誤って失敗していた。プロダクションコード側の不具合ではなくテストヘルパーの不備。
- popup.js: `bindDisplayModeControl` のテスト3件を追加。`loadPopup`/`makeFakeStorage` に `getDisplayMode`/`setDisplayMode` を追加（`init()` 自動実行時に `bindDisplayModeControl` が呼ばれるため）。

## 実ブラウザ検証

未実施。design_memo の「test」欄が `node --test test/*.test.mjs` の green のみを明記しており、実ブラウザでの見た目確認（猫SVGの描画・レイアウト崩れの有無等）は受入条件に含まれていない。ロジックの正しさ（モード分岐・XSS防止・退避/復元の往復・二重挿入防止）は unit test で担保しているが、実際のAliExpress DOM上でのビジュアル確認はしていない。必要であれば追って agent-browser（headless限定）で確認する。

## 仕様からの逸脱・補足判断

- `applyVisibility` の options 引数の中身（`mode`/`storeName`/`onUnblock`）は design_memo に具体形の指定が無く、自分で設計した。
- placeholder のプレースホルダー要素の高さ確保は `min-height: 220px` のインラインstyle（design_memoは「min-height か padding」とのみ指定、具体値の指定なし）。
- 「元の子要素を退避して隠し」は、実装上は DOM から外さず `WeakMap` で表示状態を退避したうえで `display:none` にする方式にした（DOM構造そのものは変更しない）。
- manifest.json（ルート直下の拡張マニフェスト）は触っていない（担当外・変更不要）。

## 結論

design_memo の実装項目（storage.js の displayMode API、content-search.js の findWrapper新優先順・2モード applyVisibility・init での購読、popup/ の切替UI）を全て満たし、unit test 61/61 green。実ブラウザでのビジュアル確認は受入条件外のため未実施（上記に明記）。done とする。
