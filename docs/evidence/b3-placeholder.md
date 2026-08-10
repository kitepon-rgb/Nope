# b3-placeholder 完了証拠（2026-08-10）

実装は sumire、evidence の整備と commit は統括 bell が代行した（sumire のセッションは commit を禁止する契約で動いていたため、成果が working tree に残っていた）。

## 実装

`src/content-search.js` の `buildPlaceholderElement` を、猫の SVG からオーナー確定のマスコット画像へ差し替えた（commit `4923c81`）。

- 画像は `chrome.runtime.getURL('assets/mascot-blocked.png')` で拡張同梱リソースとして参照する（外部 URL は使わない）
- `assets/mascot-blocked.png`（240×240、表示 120px の @2x）を `assets/mascot-source.png`（2048×2048）から PowerShell の System.Drawing（HighQualityBicubic）で生成。追加依存ゼロ
- カードは White `#fffef9` 地に Discovery Orange `#ef8d32` の 1px 枠、label は `BLOCKED`（10px・letter-spacing 0.14em・Deep Orange `#a84400`）、ストア名は Ink `#111b35`、解除ボタンは Orange 枠・Deep Orange 文字

## 壊していないことの確認

- 解除ボタンの `preventDefault` / `stopPropagation` / `CB_STORAGE.removeBlockedStore` 呼び出しは無改造（[content-search.js:123-124, 231](../../src/content-search.js)）
- collapse モードのロジックも無改造
- ストア名は引き続き `textContent` で挿入（XSS 対策）
- `node --test test/*.test.mjs` → **61/61 green**（bell が再実行して確認）

## 実機で確定した事実

MV3 では、content script から `chrome.runtime.getURL()` で参照する拡張同梱リソースを `web_accessible_resources` に登録しないと読めない。**未登録の状態では `GET chrome-extension://invalid/ (Image)` としてブロックされ `onerror` が発火する**ことを、sumire が agent-browser の network requests で実証した（推測ではなく実測）。

これを受けて `manifest.json` へ登録を追加した（b1 の commit `45b77e7` に含まれる）。`matches` は `*://*.aliexpress.com/*` に限定している——`<all_urls>` にすると任意のサイトから拡張リソースを読めてしまい、fingerprinting の的になる上、ストア審査でも権限過剰として刺さるため。

## 残っている検証

拡張として実際にロードした状態でのマスコット表示確認は b4-verify で行う。本 task の範囲は実装と、画像が読める条件の確定まで。

## 事故の記録

sumire が `agent-browser close --all` を実行した際、kotoha の `kotoha-preview` セッションを巻き込んで閉じた（room で謝罪済み）。同様の事故は hiyori も起こしており（bell のセッションを巻き込んだ）、**agent-browser は単一デーモンで `close --all` が全セッションを殺す**という性質が円卓で二度踏まれている。以後は `--session <自分の名前>` で分離し、`close --all` を使わないこと。
