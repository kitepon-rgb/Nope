# t6-popup 完了証拠（2026-08-10）

## 実施

- popup/popup.html + popup.css + popup.js を実装。フレームワーク不使用。
- ブロック済みストア一覧（名前・ID・追加日、addedAt 降順）+ 行ごと削除ボタン。
- 手動追加欄はストアURL（`/store/\d+` を含む文字列）または数値IDのみの入力を受け付け、`parseStoreInput` でパース。名前未入力時は `store:<id>`。
- キャッシュクリアボタン（productStoreCache の消去）。

## unit test

`node --test test/popup.test.mjs` — 8/8 green（parseStoreInput 3件、sortEntries、formatDate、renderList 3件）。

## 実ブラウザ検証（bell実測、2026-08-10 17時台、記録転記）

agent-browser 隔離ブラウザに拡張ロード（`--headed --extension "C:/Users/kite_/Documents/Program/ChromeBlocker"`）した状態で popup を開き、以下を確認（全項目合格）:

1. popup 描画（初期状態）— スクリーンショット: `t6-popup-initial.png`
2. ストア追加（URL入力 → ID抽出 1102351234）— 一覧に名前+日付で表示。スクリーンショット: `t6-popup-added.png`
3. popup 再読込後も一覧が永続（chrome.storage.sync 実体で確認）
4. キャッシュクリア（local の productStoreCache 消去、完了表示）
5. 削除（行削除 → 空状態表示「ブロック中のストアはありません」、storage.sync も空化）

## 結論

設計メモの受入条件（一覧+削除、手動追加、キャッシュクリア、素のHTML/CSS/JS）を全て満たし、unit test・実ブラウザ検証ともに合格。done とする。
