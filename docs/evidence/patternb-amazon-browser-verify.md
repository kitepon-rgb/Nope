# Pattern B 登録 UI と Amazon seller 不在の実ブラウザ検証

- 日時: 2026-08-11
- 実装: codex（commit 3afdd94）
- 検証: bell（実ブラウザ）
- 環境: agent-browser 0.25.3、`--extension` で unpacked 再読み込み（拡張コード変更のためセッション作り直し）

## 件1: Pattern B の発信元ブロックボタン — PASS

対象: `https://news.yahoo.co.jp/`

| 項目 | 実測 |
| --- | --- |
| カード数 | 50 |
| 注入されたボタン（`.cb-source-block-button`） | 42（発信元名が取れないカードには出ない） |
| ボタンのテキスト | `🚫 発信元をブロック` |
| 既定の可視性 | `opacity: 0`（hover/focus 待ち。`visibility: visible` / `display: block`） |

ボタンをクリックした結果（対象は「中日スポーツ」）:

- `.cb-blocked-placeholder`: **1 件**（当該カードがプレースホルダーに置き換わった）
- トースト: **1 件**

「カード上のボタンを押す → その発信元がブロックされる → プレースホルダーに置き換わる → トーストで通知」
が実ブラウザで通った。

## 件2: Amazon の seller 不在正常化 — PASS

対象: `https://www.amazon.co.jp/s?k=マウス`

| 項目 | 修正前（v7c 検証時） | 修正後 |
| --- | --- | --- |
| 個別 warn（`sourceId解決に失敗しました siteKey=amazon`） | **47 件** | **0 件** |
| 集約警告 | — | 0 件 |
| `itemSourceCache` の amazon エントリ | （未計測） | **12 件** |

解決成功の実例: `amazon:B01HO0W4SE=A6A1PMOAKBPGH`、`amazon:B07DVC25R2=A21C814LYDWHEM`、
`amazon:B08CKZ9TSY=A3VDYTZUCJP870`

**「動いていないから warn も出ない」ではない**ことを `itemSourceCache` の 12 件で確認した。
解決は走っており、seller 不在（Amazon 直販）のカードが `null` で素通しされている。

集約警告が出ないのは正しい挙動である。codex の実装は「5件以上かつ**全件**不在なら集約警告」で、
解決成功が 12 件あるため全件不在に当たらない。構造が生きている証拠があるので警告は不要。

## 未検証

- 解除ボタン経由での復元（Yahoo News では B4 検証時に確認済み、Pattern B ボタン経由は未実施）
- 即時反映（`onBlockedSourcesChanged`）はタブ1枚では検証できないため未実施
- hover による可視化の見た目（`opacity: 0` から 1 になる CSS 遷移）は数値で確認していない。
  DOM 上の存在と click の機能のみ確認した
- popup での `nameOnly: true` エントリへの警告表示は今回のスコープ外（設計文書 `:373`）
