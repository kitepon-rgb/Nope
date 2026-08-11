# Pattern B 登録UI・Amazon seller不在対応エビデンス

- 日時: 2026-08-11
- 実装席: codex
- 対象: オーナー裁定済みの2件（Pattern B 発信元ブロック登録、Amazon seller不在の正常系化）

## Pattern B: カード注入型の発信元ブロック

`content-name.js` が扱う Yahoo News・Yahoo! JAPAN・YouTube watch の各カードへ、
発信元ブロックボタンを注入した。カードが多数並ぶ面なので、ボタンは hover または
keyboard focus 時だけ表示する。

- 登録は `addBlockedSource(siteKey, sourceName, sourceName, true)` とし、`nameOnly: true` を保持
- 操作結果はトーストで通知
- ブロック後はカードを既存のプレースホルダーへ切り替え、注入ボタンを非表示
- 初めからブロック済みのカードには注入せず、プレースホルダーの解除ボタンだけを表示
- AliExpress の単一商品ボタンとは注入数とライフサイクルが異なるため、汎用化せず
  `content-name.js` 内へ限定実装

根拠となる実ブラウザ実測は `docs/evidence/v7-b4-yahoo-news-verify.md`。

## Amazon: seller不在と解決失敗の分離

`amazon.js` は seller ID が存在しない商品を正常値 `null` として返す。共通エンジンは
明示的な `null` だけを正常な発信元不在として扱い、`undefined`、sourceId欠落、fetch失敗、
HTTPエラーは従来どおり個別警告へ送る。

HTML構造変更を静かに見逃さないため、Amazon adapter に集約警告policyを設定した。
5件以上を解決して成功が0件の場合だけ、キューが空になった時点で警告を1回出す。
1件でも seller 解決に成功すれば構造は生きていると判断する。

この判断は `docs/evidence/v7c-verify-resolve.md` の実測（60件中、成功13件・seller不在47件）に基づく。
新規の実ブラウザ実測は行っていない。

## 検証

- Pattern B focused: `node --test test/content-name.test.mjs` — 3/3 pass
- Amazon focused: `node --test test/content-search.test.mjs test/adapters/amazon.test.mjs` — 43/43 pass
- 関連全体: `node --test test/*.test.mjs test/adapters/*.test.mjs` — 178/178 pass
- 差分衛生: `git diff --check` — pass

## 変更ファイル

- `src/content-name.js`
- `src/content-search.js`
- `src/adapters/amazon.js`
- `test/content-name.test.mjs`
- `test/content-search.test.mjs`
- `test/adapters/amazon.test.mjs`
