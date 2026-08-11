# v7c-verify-resolve 中間実測（Pattern C: ヤフオク・Amazon）

- 日時: 2026-08-10
- 実測者: sumire（v5-adapter-resolve 実装席）
- 出典: ローカルモードで動いた room インスタンスの `peertable-data/ChromeBlocker/log.jsonl` seq=4。
  本番 room（LAN インスタンス）には転記されておらず、この残骸ファイルが唯一の記録だったため、
  `peertable-data/` 掃除（v7 D）に先立って救出した。

## 実測値

| サイト | 入力 | 解決結果 |
| --- | --- | --- |
| ヤフオク | `auctionId=v1240261419` | `sellerId=8jZgJS8yJqMTPrEDF5hdB8VjFqDK3`（表示名はマスクされる） |
| Amazon | `asin=B0GCC2HDKD` | `sellerId=A28I9FGF6M8JQ8`, `sellerName=Go Japan 株式会社` |

## 確認できた性質

- 両サイトとも `fetch` で解決可能。**CORS 制約なし**。
- **bot 遮断に当たらなかった**（実ユーザーセッション経由での実測）。AliExpress の mtop 経路とは対照的。
- ヤフオクは sellerId は取れるが表示名がマスクされるため、名前によるブロックには使えない。

## 未検証

sumire の報告時点で確認できたのは検証条件1のみ。条件2〜5 は、ヤフオク・Amazon の
manifest entry 追加（v8a）の完了後に実施する。
