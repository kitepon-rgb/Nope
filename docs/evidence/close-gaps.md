# 未解決・未検証3件のクローズ証跡

- 日時: 2026-08-11
- 実測者: codex
- agent-browser: session `close-gaps`
- 対象: `dist/chromeblocker-v2.0.0.zip`
- 最終 ZIP: 151,281 bytes
- 最終 ZIP SHA-256: `035599a72b39943146cc60ff3b139f6f25e17f299a2d417cec479ab723770e31`

## 1. 表示名マッチのリスク警告

`nameOnly: true` のブロック項目だけに、次の警告を常時表示するようにした。

> ⚠ 表示名で判定：改名・同名の別発信元に注意

tooltip では、発信元が改名するとブロックが解除されることと、同名の別発信元を誤ってブロックする可能性を明記した。ID で判定する項目には警告を表示しない。

最終 ZIP を隔離展開して popup を実ブラウザで開き、Yahoo!ニュースの `nameOnly: true` 項目では警告本文と tooltip が見え、楽天市場の ID 項目では警告が存在しないことを確認した。

## 2. 2タブ間の即時反映

popup と対象サイトを別タブで開き、対象タブに marker と `performance.timeOrigin` を記録した。popup 側でブロック対象を追加・削除し、対象タブを再読み込みせずに反映されることを Pattern A/B/C で確認した。

| Pattern | 対象 | 追加時 | 削除時 | 再読み込みなしの根拠 |
| --- | --- | ---: | ---: | --- |
| A | 楽天市場 `logicool` | placeholder 17件 | placeholder 0件、カード50件 | marker と `performance.timeOrigin` が不変 |
| B | Yahoo!ニュース `日刊スポーツ` | placeholder 2件 | placeholder 0件、カード50件 | marker と `performance.timeOrigin` が不変 |
| C | Yahoo!オークション seller id `8jTzmpdPKryr94Y7jAdtsk37Hso3A` | placeholder 6件 | placeholder 0件、カード53件 | marker と `performance.timeOrigin` が不変 |

いずれも `onBlockedSourcesChanged` により、追加と削除の両方向が即時反映された。

## 3. placeholder の「ブロック解除」

Pattern A と Pattern C で placeholder 内の実ボタンを `agent-browser click` し、ページ再読み込みなしで元カードが復元され、対応する storage 項目が削除されることを確認した。

- Pattern A / 楽天市場: placeholder 17件から0件、カード50件へ復元。storage は `{rakuten: {}}`。
- Pattern C / Yahoo!オークション: placeholder 6件から0件、カード53件へ復元。storage は `{yahoo_auctions: {}}`。

両方ともクリック前後で marker と `performance.timeOrigin` は不変だった。Yahoo!ニュースは既存検収済みのため、今回の指定どおり Pattern A/C を実測した。

## 対象外

AliExpress の bot wall 判定は自動ブラウザでは閉じず、オーナーの通常 Chrome で確認する別担当事項のため対象外とした。

## 検証

- focused: `node --test test/popup.test.mjs` — 13/13 pass
- 関連全体: `node --test test/*.test.mjs test/adapters/*.test.mjs` — 178/178 pass
- `git diff --check -- popup/popup.js popup/popup.css test/popup.test.mjs` — pass
- ZIP integrity: `unzip -t dist/chromeblocker-v2.0.0.zip` — errorなし
- `popup/popup.js` の ZIP 内外 SHA-256 一致: `e0095999d4e4b8463b7026e4fe2c5b4d9cd46bfc3de7bd066cec163a8cf28e7b`
- `popup/popup.css` の ZIP 内外 SHA-256 一致: `e4f0493d8ec7c4a1ca8585a42baa92d6db1151f51e756bf92d82da4514404c3d`
