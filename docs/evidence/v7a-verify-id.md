# v7a-verify-id 検証エビデンス

- 検証者: shiho
- 日時: 2026-08-11
- 対象: nagi 実装 v3 パターンA アダプタ（楽天・Yahoo!Shopping・YouTube検索）
- 手法: agent-browser --session shiho --extension /mnt/c/.../ChromeBlocker --headed

---

## 検証結果サマリ

**AC6（セレクタマッチ）**: 楽天・Yahoo!Shopping・YouTube いずれも正常マッチ確認。  
**AC1-AC5（ブロック動作）**: 全サイトで機能せず。根本原因は下記バグ2件。

---

## バグ報告

### バグ1（最重要）: content-search.js と dom_id 型 adapter の型不一致

**ファイル**: `src/content-search.js:257`

content-search.js の `handleCard` は `resolver.getItemId(card)` を呼ぶ:
```js
const itemId = resolver.getItemId(card);
```

しかし nagi の rakuten.js / yahoo_shopping.js / youtube.js の resolver は `dom_id` 型で、
`getItemId` を持たず `getSource(card) → { sourceId, sourceName }` を持つ。

結果: `resolver.getItemId` が `undefined` → TypeError → `handleCard` が早期 return →
楽天・Yahoo!Shopping・YouTube 全サイトでブロックが一切動かない。

**実測**: 楽天 `stylife` を chrome.storage.sync に直接書込み確認後、
ページリロードしても 51枚の `.dui-card` が全て `visible: true`、placeholder なし。

---

### バグ2: yahoo_shopping.js のストアリンクセレクタが実 DOM と不一致

**ファイル**: `src/adapters/yahoo_shopping.js:24`

nagi の resolver.getSource:
```js
card.querySelector('a[href^="https://store.shopping.yahoo.co.jp/"][href$="/"]')
```

実測（2026-08-11、バッグ検索、392件マッチ中）:
- `a[href^="https://store.shopping.yahoo.co.jp/"][href$="/"]` → **0件**
- 実際のリンク形式: `https://store.shopping.yahoo.co.jp/<storeId>/?sc_i=...`（クエリパラメータ付き）

`href$="/"` が `/?sc_i=...` にマッチしないため、resolver.getSource が全カードで null を返す。

---

## 正常確認事項

### 楽天
- `.dui-card`: 51件マッチ ✅
- `a[href^="https://www.rakuten.co.jp/"][href$="/"]`: idx 6以降で正常マッチ ✅
  - 実測例: `stylife` → "Rakuten Fashion"、`style-on-bag` → "スタイルオンバッグ"
- セレクタ・resolver.getSource ロジック自体は正常（バグ1修正後に動く構造）

### Yahoo!Shopping
- `div[class*="SearchResult_SearchResultItem"]`: 392件マッチ ✅
  - 実クラス名: `SearchResult_SearchResultItem__mJ7vY`（CSS Modules 部分一致が有効）
- ストアリンクは存在するが形式が異なる（バグ2として報告）

### YouTube 検索
- `ytd-video-renderer`: 5件（初期）→ SPA 遷移後 20件に増加 ✅
- `a[href*="/@"]` からの抽出:
  - `/@setuyakugohan` → sourceId: `@setuyakugohan`、sourceName: `夫手取り17万円の節約ごはん` ✅
  - `/@daily_chinese` → sourceId: `@daily_chinese`、sourceName: `毎日中華` ✅
- handle 形式での resolver.getSource ロジック正常（バグ1修正後に動く構造）
- SPA 遷移後 renderer 数増加 → MutationObserver 追従構造は問題なし ✅

---

## 両バグ nagi への報告

peertable room 経由で nagi に報告済み（msg_id: d3ce9b35, 11c36245）。
修正は nagi が担当する。
