# b2-popup 完了証拠（2026-08-10）

## 実施

`popup/popup.css` `popup/popup.html` を kitepon.dev master palette へ載せ替えた。`popup/popup.js` はロジック・CB_STORAGE API呼び出しとも無変更。

着手前に `../kitepon.dev/docs/color-system.md` と `identity-system.md` を通読し、design_memo記載の要約と正本本文を突き合わせた（要約との齟齬なし）。

- 背景 Paper `#f8f5ef`、文字 Ink `#111b35`、card White `#fffef9` を適用
- 「追加」ボタンを Action Orange `#c65300` 背景+白文字に変更（`#ef8d32` への白文字は正典禁止のため使わず）
- 英語 section label（ADD STORE / BLOCKED）を新設。10px・letter-spacing 0.15em・Deep Orange `#a84400`
- ブロック中リスト各行の左端に Discovery Orange `#ef8d32` の 3px アクセント
- 表示モードの文言を「あっかんべー表示」→「ブロック表示に置き換え」、「完全に消す」→「非表示にして詰める」へ変更（オーナー裁定、あっかんべーは煽り表現のため不可）
- フッターに `kitepon.dev` への導線を追加。`target="_blank" rel="noopener"`、Cobalt `#2149aa` の下線1px・underline-offset 3px、矢印glyphなし
- font-family: 日本語 `Hiragino Sans`→`Yu Gothic`→`Meiryo`、英語label・数字は `Manrope`（Webフォント読み込みなし、system fallback）

## 正典禁止事項の遵守確認

- `#EF8D32`（`--orange`）へ白文字を載せていない。白文字は `#C65300`（`--orange-strong`）のみに使用
- 11px以下のOrange系labelは `#A84400`（`--orange-deep`）を使用（`.cb-label` 10px、`legend` 10px）
- footerリンクの文末に矢印glyph（→ ↗ ↓）を付けていない
- OrangeとCobaltを50:50で競わせていない。Cobaltはfooterリンクのみに限定使用、Orangeは複数箇所（アクセント・ボタン・label）に使用
- 見た目を埋めるだけの図形は追加していない。`border-left` 3pxアクセントはリスト行の区切りとして機能的に配置

## unit test

`node --test test/popup.test.mjs` — 11/11 green。popup.js を変更していないため、既存の parseStoreInput / sortEntries / formatDate / renderList / bindDisplayModeControl の挙動は維持される。テスト自体は表示モードの文言（あっかんべー等）に依存しておらず value/checked ベースだったため、期待値の追随は不要だった（design_memoは「文言を変えるならテストの期待値も追随」と指示していたが、実際のテストコードを読んで文言非依存であることを確認した）。

## 視覚検証（agent-browserによるプレビュー実描画）

拡張全体のロードは他タスク（b1: icons/manifest.json）と並行進行中のため、`chrome.storage` をモックしたスタンドアロン版プレビューHTMLをスクラッチパスに作成し、agent-browser（`--session kotoha-preview`）で実描画・スクリーンショット確認した。

1. 初回描画で「削除」ボタンの文字が縦に折り返る崩れを発見（`.cb-store-row button` に `flex`/`white-space` 未指定が原因）
2. `flex: 0 0 auto; white-space: nowrap;` を追加、`.cb-store-label` に `flex: 1 1 auto; min-width: 0;` を追加して修正
3. 再描画で崩れ解消を確認。背景Paper・追加ボタンのOrange+白文字・リストのOrangeアクセント・ADD STORE/BLOCKEDラベル・footerのkitepon.devリンク（Cobalt下線）が意図通り表示されることを確認

popup.js は CB_STORAGE 経由で `chrome.storage.sync`/`local` を呼ぶため、実拡張ロードでの chrome.storage 実挙動そのものは今回変更していない（t6-popupで既に検証済み）。

## 結論

design_memo記載の全項目（master palette適用・文言変更・footer導線・正典禁止事項）を実装し、unit test green・視覚検証も合格。done とする。
