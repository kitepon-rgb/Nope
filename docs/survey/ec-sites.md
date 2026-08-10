# EC サイト DOM 実地調査

調査者: nagi / 調査日: 2026-08-11  
調査方法: `agent-browser --session nagi` で各サイトを開き `eval` で DOM を実測。推測と実測を明示して区別する。

---

## 凡例

- **実測**: `document.querySelectorAll(...)` の件数や `getAttribute` の値を実際に取って確認した事実
- **推測**: 確認していない事項（「未確認」と併記）
- **未確認**: 調査しようとしたが取得できなかった、または今回の調査スコープ外

---

## 1. 楽天市場

### 検索結果ページ URL 形式
```
https://search.rakuten.co.jp/search/mall/{keyword}/
```
例: `https://search.rakuten.co.jp/search/mall/%E3%83%AF%E3%82%A4%E3%83%A4%E3%83%AC%E3%82%B9%E3%82%A4%E3%83%A4%E3%83%9B%E3%83%B3/`

**実測**: 上記 URL で 91,564件 / 1ページ45件の結果が表示された。ログイン不要で検索結果が見える。

### 商品カードのセレクタ
```
.dui-card
```
**実測**: `document.querySelectorAll('.dui-card').length` → 45件（1ページ分と一致）

クラス構成（実測）:
```
<div class="dui-card searchresultitem overlay-control-wrapper--3KBO0 title-control-wrapper--1rzvX">
```
- `.dui-card` はハッシュなし（Rakuten DUI コンポーネント）
- 追加クラスにハッシュが付くが、`.dui-card` 単独で安定して使える

### 非表示にすべき外側要素
```
.dui-card  ← これを display: none にする
```
**実測**:
- `.dui-card` の `display`: `flex`
- 親 `.grid-container--1jsZ0` の `display`: `grid`

グリッドコンテナ（親）の直接の子が `.dui-card`。`display: none` にすればグリッドが自動的にスペースを詰める。

AliExpress での `.card-out-wrapper` 問題に相当する罠（外側のラッパーを消して空白が残る）はない——`.dui-card` がグリッドアイテム本体。

### 出品者名・店舗名が検索結果の DOM に出ているか
**あり（実測）**

各 `.dui-card` 内に以下のリンクが存在する:
```html
<a href="https://www.rakuten.co.jp/{shopSlug}/">店舗名テキスト</a>
```

実測例:
| カード | 店舗リンク URL | 店舗名 |
|---|---|---|
| 1 | `https://www.rakuten.co.jp/aidort/` | 愛度楽天市場店 |
| 2 | `https://www.rakuten.co.jp/gracevally/` | GraceVally 楽天市場店 |
| 3 | `https://www.rakuten.co.jp/case-by-case/` | ケースbyケース |

セレクタ:
```javascript
card.querySelector('a[href^="https://www.rakuten.co.jp/"][href$="/"]')
// → textContent が店舗名、href から shopSlug を抽出
```

### 出品者識別子（ID）
**取れる（実測）**

URL 形式: `https://www.rakuten.co.jp/{shopSlug}/`

shopSlug（実測例）: `aidort`, `gracevally`, `case-by-case`

正規表現: `/rakuten\.co\.jp\/([^\/]+)\/$/.exec(href)[1]`

### 商品 ID の取り方
**実測**: `data-id` 属性に商品ID（数値）が入っている
```javascript
card.getAttribute('data-id')  // 例: "10003438"
```
また、商品 URL `https://item.rakuten.co.jp/{shopSlug}/{itemSlug}/` の `itemSlug` からも取れる。

### ページネーション / 無限スクロール
**ページネーション（実測）**

`.dui-pagination` 要素が存在し、「1 2 3 4 5 6 7 8 9 ... 次のページ」が表示されている。次のページ URL は `?p=2` パラメータ。

### ログインが必要か
**不要（実測）**: 未ログイン状態で検索結果が表示された。

---

## 2. ヤフオク

### 検索結果ページ URL 形式
```
https://auctions.yahoo.co.jp/search/search?p={keyword}&tab_ex=commerce
```
例: `https://auctions.yahoo.co.jp/search/search?p=%E3%83%AF%E3%82%A4%E3%83%A4%E3%83%AC%E3%82%B9%E3%82%A4%E3%83%A4%E3%83%9B%E3%83%B3&tab_ex=commerce`

**実測**: ログイン不要で検索結果が表示された。

### 商品カードのセレクタ
```
li.Product
```
**実測**: `document.querySelectorAll('li.Product').length` → 53件

クラス構成（実測）:
```
<li class="Product">
```
- `.Product` はハッシュなし、安定

親要素（実測）:
```
<ul class="Products__items">
```

### 非表示にすべき外側要素
```
li.Product  ← これを display: none にする
```
**実測**:
- `li.Product` の `display`: `flex`
- 親 `ul.Products__items` の `display`: `flex`（flex-wrap: wrap と推測——確認していない）

`li.Product` がフレックスコンテナのアイテムなので、`display: none` でスペースが詰まる。

### 出品者名が検索結果の DOM に出ているか
**無い（実測）**

全 `li.Product` の子孫要素について seller/user/shop 関連のクラスをスキャンした結果、0件:
```javascript
sellerClasses: []  // 実測
```

`li.Product` のテキスト内容は「商品名・価格・残り時間・状態」のみで、出品者名は含まれない。

### 出品者識別子（ID）の取り方
**非同期解決が必要（実測）**

1. 検索結果カードの `a[data-auction-id]` 属性からオークションID を取得
   ```javascript
   card.querySelector('a[data-auction-id]').getAttribute('data-auction-id')
   // 例: "q1240291994"
   ```
2. オークション詳細ページを開く: `https://auctions.yahoo.co.jp/jp/auction/{auctionId}`
3. 詳細ページ内の `a[href*="auctions.yahoo.co.jp/seller/"]` から出品者情報を取得

**実測**（オークション `q1240291994` の詳細ページ）:
```javascript
a[href="https://auctions.yahoo.co.jp/seller/DFvUrXQ8JX9MobKNnv8hnSWJXVbzj"]
// テキスト: "goanshinkudasai"
// sellerId: "DFvUrXQ8JX9MobKNnv8hnSWJXVbzj"
```

正規表現: `/\/seller\/([^?\/]+)/.exec(href)[1]`

### 商品 ID の取り方
**実測**: `a[data-auction-id]` 属性（例: `q1240291994`）、または URL `https://auctions.yahoo.co.jp/jp/auction/{auctionId}` から

### ページネーション / 無限スクロール
**ページネーション（実測）**

ページ末尾に「前へ 1 2 3 4 5」のナビゲーションが存在する（role="navigation" の要素に内包されているが、querySelectorAll('.Pagination') は0件だった）。

### ログインが必要か
**不要（実測）**: 未ログイン状態で検索結果が表示された。

---

## 3. Yahoo!ショッピング

### 検索結果ページ URL 形式
```
https://shopping.yahoo.co.jp/search/{keyword}/0/
```
または
```
https://shopping.yahoo.co.jp/search?p={keyword}
```
→ 後者は前者にリダイレクトされる（実測）。ページ番号は末尾の `/0/` を変える。

**実測**: ログイン不要で 34,917件の検索結果が表示された。

### 商品カードのセレクタ
```css
div[class*="SearchResult_SearchResultItem"]
```
**実測**: CSS Modules 形式のクラス名（ハッシュ付き）
```
<div class="SearchResult_SearchResultItem__mJ7vY">
```

`__mJ7vY` の部分はデプロイごとに変わる可能性があるため、部分一致セレクタを使う。

トップレベルカード件数（実測）: 61件（広告含む）
有機検索結果（`store.shopping.yahoo.co.jp` 直リンクを持つもの）: 47件

親要素（実測）:
```
<div class="SearchResult_SearchResult__eA71H searchResult_1_1 SearchResults_SearchResults__searchResult__EyO_0 ...">
  <li class="SearchResults_SearchResults__page__OJhQP">
```

### 非表示にすべき外側要素
```css
div[class*="SearchResult_SearchResultItem"]  ← これを display: none にする
```
**実測**:
- カード: `display: flex`
- 親: `display: flex`

カードを `display: none` にすることでスペースが詰まる。

### 出品者名・ストア名が検索結果の DOM に出ているか
**あり（実測）**

各商品カード内に以下のリンクが存在する（有機検索結果カードのみ、広告を除く）:
```html
<a href="https://store.shopping.yahoo.co.jp/{storeId}/">店舗名テキスト</a>
```

実測例:
| カード | 店舗リンク URL | 店舗名 |
|---|---|---|
| 1 | `https://store.shopping.yahoo.co.jp/smahoservic/` | L&Lスマホサービス |
| 2 | `https://store.shopping.yahoo.co.jp/onetoothshop/` | ONETOOTHショップ |

セレクタ:
```javascript
card.querySelector('a[href^="https://store.shopping.yahoo.co.jp/"][href$="/"]')
```

**注意**: 広告カード（`shopping-item-reach.yahoo.co.jp/v1/click` リダイレクト経由のリンクのみを持つカード）には直接 storeId が取れない場合がある。

### 出品者識別子（ID）
**取れる（実測）**

URL 形式: `https://store.shopping.yahoo.co.jp/{storeId}/`

storeId（実測例）: `smahoservic`, `onetoothshop`

正規表現: `/store\.shopping\.yahoo\.co\.jp\/([^\/]+)\//.exec(href)[1]`

### 商品 ID の取り方
**実測**: 商品URL `https://store.shopping.yahoo.co.jp/{storeId}/{itemId}.html` の `itemId` 部分

### ページネーション / 無限スクロール
**ページネーション（実測）**

「1 2 3 4 5 ...」のページリンクが存在する。URL 形式の末尾ページ番号パラメータで切り替わる。

### ログインが必要か
**不要（実測）**: 未ログイン状態で検索結果が表示された。

---

## 4. Amazon.co.jp

### 検索結果ページ URL 形式
```
https://www.amazon.co.jp/s?k={keyword}
```
例: `https://www.amazon.co.jp/s?k=%E3%83%AF%E3%82%A4%E3%83%A4%E3%83%AC%E3%82%B9%E3%82%A4%E3%83%A4%E3%83%9B%E3%83%B3`

**実測**: ログイン不要で検索結果が表示された。

### 商品カードのセレクタ
```
div[data-component-type="s-search-result"]
```
**実測**: `document.querySelectorAll('[data-component-type="s-search-result"]').length` → 48件

これはハッシュなしの安定した属性セレクタ。

クラス構成（実測）:
```
<div class="sg-col-4-of-4 sg-col-4-of-24 sg-col-4-of-12 s-result-item s-asin sg-col-4-of-16 sg-col ..."
     data-asin="B0CT857V89"
     data-component-type="s-search-result"
     data-index="2">
```

### 非表示にすべき外側要素
```
div[data-component-type="s-search-result"]  ← これを display: none にする
```
**実測**:
- カード: `display: block`
- 親 `div.s-main-slot.s-result-list.s-search-results.sg-row`: `display: grid`

グリッドコンテナ（親）のアイテムが上記カードなので、`display: none` にすればスペースが詰まる。

### 販売者情報が検索結果の DOM に出ているか
**無い（実測）**

全48件の `div[data-component-type="s-search-result"]` について、販売者関連のテキストをスキャンした結果:
```javascript
withSeller: 0  // 実測: "出品者", "販売者", "sold by", "shipped by", a[href*="/seller/"] いずれも0件
```

カード内に表示されるのは「商品名・価格・評価・配達日・Amazon's Choice バッジ」のみ。

### 販売者識別子（ID）の取り方
**非同期解決が必要（実測）**

1. 検索結果カードの `data-asin` 属性から ASIN を取得
   ```javascript
   card.getAttribute('data-asin')  // 例: "B0CT857V89"
   ```
2. 商品詳細ページを開く: `https://www.amazon.co.jp/dp/{asin}`
3. 詳細ページ内の `a[href*="seller="]` から販売者情報を取得

**実測**（ASIN `B0CT857V89` の詳細ページ）:
```javascript
a[href="https://www.amazon.co.jp/...?seller=A3EMK34PT3V85P&asin=B0CT857V89..."]
// テキスト: "HK-JIMI"
// sellerId: "A3EMK34PT3V85P" (URLパラメータ ?seller= から取得)
```

正規表現: `/[?&]seller=([^&]+)/.exec(href)[1]`

### 商品 ID（ASIN）の取り方
**実測**: `data-asin` 属性（例: `B0CT857V89`）

### ページネーション / 無限スクロール
**ページネーション（実測）**

`a.s-pagination-next` が存在し、「Next」テキストの次ページリンクがある。

### ログインが必要か
**不要（実測）**: 未ログイン状態で検索結果が表示された。

---

## まとめ: 設計への含意

### 出品者名が検索結果 DOM にある / ない（設計の分岐点）

| サイト | DOM に出品者名あり | 識別子取得方法 |
|---|---|---|
| 楽天市場 | **あり** | `a[href*="www.rakuten.co.jp/{shopSlug}/"]` の URL から直接 |
| ヤフオク | **なし** | オークションページ（`a[href*="/seller/"]`）を非同期解決 |
| Yahoo!ショッピング | **あり** | `a[href*="store.shopping.yahoo.co.jp/{storeId}/"]` の URL から直接 |
| Amazon | **なし** | 商品詳細ページ（`a[href*="seller="]`）を非同期解決 |

### 非同期解決が要るサイト（AliExpress と同じ機構）
- **ヤフオク**: オークションID → 詳細ページ → `a[href*="/seller/"]` で sellerId
- **Amazon**: ASIN → 商品ページ → `a[href*="seller="]` で sellerId

現行の「商品ID → 発信元を非同期解決してキャッシュ」機構がそのまま流用できる。

### DOM 直読みでブロックできるサイト（簡単）
- **楽天市場**: カードに店舗リンクあり。`a[href^="https://www.rakuten.co.jp/"][href$="/"]` のテキストが店舗名、URL が識別子
- **Yahoo!ショッピング**: カードに店舗リンクあり。`a[href^="https://store.shopping.yahoo.co.jp/"][href$="/"]` のテキストが店舗名、URL が識別子

### セレクタ安定性

| サイト | セレクタ | 安定性 |
|---|---|---|
| 楽天市場 | `.dui-card` | 高（DUI コンポーネント名） |
| ヤフオク | `li.Product` | 高（BEM ライクな命名） |
| Yahoo!ショッピング | `[class*="SearchResult_SearchResultItem"]` | 中（CSS Modules、ハッシュ部分は変わる） |
| Amazon | `[data-component-type="s-search-result"]` | 高（data 属性ベース） |

### 各サイトで非表示にすべき要素（空間が詰まる要素）

| サイト | 消すべき要素 | 親の display | 詰まるか |
|---|---|---|---|
| 楽天市場 | `.dui-card` | `display: grid` | ○ |
| ヤフオク | `li.Product` | `display: flex` | ○ |
| Yahoo!ショッピング | `div[class*="SearchResult_SearchResultItem"]` | `display: flex` | ○ |
| Amazon | `div[data-component-type="s-search-result"]` | `display: grid` | ○ |

全サイトとも、カード要素自体が grid/flex コンテナのアイテムとして機能しているため、`display: none` で空間が自動的に詰まる。AliExpress での `.card-out-wrapper` 問題（外側の静的ラッパーを消さないと空白が残る）に相当する罠は今回4サイトでは確認されなかった。
