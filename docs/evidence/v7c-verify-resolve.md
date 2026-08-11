# v7c 検証: パターンC（ヤフオク・Amazon）の実ブラウザ検証

- 日時: 2026-08-11
- 実測者: bell
- 環境: agent-browser 0.25.3、`--extension` で unpacked 読み込み（id `efcgoleknjceombadjnbhopdmeeenaed`）、セッション `b4`
- 手法: 拡張を読み込んだ実ブラウザで対象ページを開き、popup ページの world から
  `chrome.storage` を直接操作し、対象ページの DOM を検証する

## 結論

| サイト | 結果 |
| --- | --- |
| ヤフオク | **PASS**。DOM 前提・非同期解決・プレースホルダー・表示名まで完全に動作 |
| Amazon | **FAIL**。検索結果 60 枚のうち **47 枚（78%）** で seller 解決が失敗する |

## ヤフオク: PASS

対象: `https://auctions.yahoo.co.jp/search/search?p=マウス`

### DOM 前提

| 項目 | 実測 |
| --- | --- |
| `li.Product` | 53 |
| `li.Product a[data-auction-id]` | 106（1カードに画像とタイトルの2リンク） |
| 最初の auctionId | `c1240335806` |
| `li.Product a[href*="/seller/"]` | **0**（カードに出品者情報が無い＝adapter のコメント通り） |

### resolveSource（実 HTML に対する検証）

`https://auctions.yahoo.co.jp/jp/auction/c1240335806` を fetch し、adapter と同じ正規表現を適用。

- `htmlLen`: 124,498（fetch 成功。CORS も bot 遮断も無し）
- `sourceId`: `4pWqPXgENmzTb2tcamn4BaE8KTsoc`（`/\/seller\/([^"'?\/\s]+)/` がマッチ）
- `sourceName`: `カリン`（`/href="[^"]*\/seller\/[^"]*"[^>]*>([^<]+)</` がマッチ）

### プレースホルダー

`blockedSources.yahoo_auctions['4pWqPXgENmzTb2tcamn4BaE8KTsoc']` を登録して再読み込み。

- `.cb-blocked-placeholder`: **3 件**（同一出品者のカード3枚がブロックされた）
- textContent: `BLOCKEDカリンブロック解除` — **解決した表示名がプレースホルダーに出ている**
- マスコット画像: `naturalWidth > 0`
- 解除ボタン: 存在する

非同期解決（詳細ページ fetch → sourceId 解決 → 表示反映）が実ブラウザで通った。

## Amazon: FAIL

対象: `https://www.amazon.co.jp/s?k=マウス`

### DOM 前提は満たされている

| 項目 | 実測 |
| --- | --- |
| `div[data-component-type="s-search-result"]` | 60 |
| 最初の ASIN | `B0FR8LPP2K` |
| カード内の `a[href*="/seller/"]` | 0（adapter のコメント通り） |

### 失敗の実測

**検索結果 60 枚のうち 47 枚で解決が失敗した**（console の warn 件数、78%）。

```
content-search: sourceId解決に失敗しました siteKey=amazon itemId=B0GLM7WKVH
content-search: sourceId解決に失敗しました siteKey=amazon itemId=B0FR8LPP2K
content-search: sourceId解決に失敗しました siteKey=amazon itemId=B0D9Y1J4NH
...（計 47 件。いずれも「amazon: seller ID が見つかりません」）
```

### 原因: 正規表現ではなく、静的 HTML に seller 情報が無い商品がある

正規表現は正しい。sumire が実測した ASIN では今も動く。

| ASIN | htmlLen | sourceId | sourceName | `sellerProfileTriggerId` | `seller=` 出現数 |
| --- | --- | --- | --- | --- | --- |
| `B0CT857V89`（sumire 実測） | 2,249,354 | `A3EMK34PT3V85P` | `HK-JIMI` | あり | 2 |
| `B0FR8LPP2K`（検索1件目） | 2,588,903 | **null** | **null** | **無し** | **0** |

`B0FR8LPP2K` の HTML には `merchant-info` の widget 枠だけが存在し、中身は空（CSR で埋まる）。

adapter のコメント自身が「fetch() の静的 HTML にも seller 情報が埋め込まれている（**SSR コンポーネント混在**）」
と書いている。混在するので一部の商品では取れない。**sumire の実測はサンプル1件だった。**

### 代替経路も失敗

`https://www.amazon.co.jp/gp/offer-listing/B0FR8LPP2K` を試したが、`seller=` も `aod-offer` も
含まれない（htmlLen 2,555,405 で `/dp/` と同程度＝リダイレクトされている）。
**fetch ベースでは解決できない。**

## 修正には設計判断が要る

現状の adapter は seller が見つからないと例外を投げ（`throw new Error('amazon: seller ID が見つかりません')`）、
共通エンジンが `console.warn` して当該カードを素通しする。静かなフォールバックではないが、
**8割のカードが解決不能なまま素通しされる**ため機能として成立していない。

選択肢は次のいずれかで、いずれも実測による裏付けが必要。

1. seller が静的 HTML に載る別エンドポイントを探す（未発見。`/dp/` と `/gp/offer-listing/` は不可）
2. CSR 後の DOM が必要と認めて、fetch ベースの解決を諦める（Pattern C の前提が崩れる）
3. 「発信元が解決できない商品」を正常な状態として表現する（例外をやめる）。
   ただしその場合ブロック機能は解決できた 2 割にしか効かない

## 未検証

- 解除ボタンの動作（ヤフオクでは未実施。Yahoo News では動作確認済み）
- 即時反映（`onBlockedSourcesChanged`）はタブ1枚では検証できないため未実施
- Amazon の失敗 47 件がすべて「Amazon 自身が販売者」なのかは未確認
  （`hasAmazonSeller` の判定は false だったので、単に CSR 待ちの可能性がある）
