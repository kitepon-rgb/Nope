# v6-popup 実装記録

実装者: kotoha / 実装日: 2026-08-11  
plan: nope-v2 / task: v6-popup

---

## 変更内容

### popup/popup.html

- 旧: ADD STORE フォーム（AliExpress URL/ID 入力）+ 平坦な BLOCKED リスト
- 新: サイト別グループ BLOCKED セクション + KEYWORD BLOCK セクション

### popup/popup.js

- `parseStoreInput` 削除（AliExpress 専用 URL パーサー）
- `renderList` 削除 → `renderBlockedList`（全サイト）+ `renderSiteGroup`（1サイト）に分割
- `renderSourceRow` 追加: `nameOnly: true` エントリに `⚠ 名前マッチ` バッジを付ける
- `renderKeywordList` 追加: キーワードの一覧描画
- `SITE_LABELS` マップ: siteKey → 表示名

### popup/popup.css

- `.cb-site-group`, `.cb-site-header`, `.cb-site-count` 追加（サイトグルーピング）
- `.cb-name-badge` 追加（⚠ 名前マッチ バッジ）
- `.cb-keyword-header`, `.cb-keyword-form`, `.cb-keyword-list`, `.cb-keyword-row` 追加

### src/storage.js

- `getAllBlockedSources()` 追加: 全サイトの `blockedSources` を一括取得
- `getBlockedKeywords(siteKey)` 追加
- `addBlockedKeyword(siteKey, keyword)` 追加: 重複無視・トリム・空文字無視
- `removeBlockedKeyword(siteKey, keyword)` 追加
- `onBlockedKeywordsChanged(siteKey, listener)` 追加

### test/

- `popup.test.mjs`: `parseStoreInput` テスト削除、新 API（`renderBlockedList` 等）のテスト追加
- `storage.test.mjs`: キーワード CRUD・購読のテスト追加（13テスト増）

---

## 手動追加フォーム除去について

旧 popup には AliExpress の `/store/<storeId>` URL または数値 ID を直接入力するフォームがあった。
v2 で除去した理由と、将来戻す場合の設計をここに記録する。

### 除去理由

1. v2 では発信元の登録は content script 側で行う（商品カードにブロックボタンが出る）
2. サイトが 8 種類に増えると、手動フォームには「どのサイトの ID か」を選ぶ選択が必要になる。AliExpress 専用の URL パーサーはそのままでは使えなくなる
3. 手動フォームの実際の利用はテスト時のみで、本番ユースケースではない
4. bell の裁定（2026-08-11）: 「除去は妥当な判断」として承認

### 戻す場合の設計（参考）

手動フォームを復活させる場合、以下の UI が必要:

```
サイト: [AliExpress ▼]
識別子: [ストアID または URL       ]
名前:   [任意                      ]
                               [追加]
```

- サイトを選ぶ `<select>` で `SITE_LABELS` の全サイトを列挙
- 入力値のバリデーションはサイトごとに異なる（AliExpress は数値のみ、楽天は `a-z_` の slug 等）
- `addBlockedSource(siteKey, sourceId, name)` を呼ぶだけで storage への保存は済む

### 誤削除について

popup から発信元を削除すると、popup だけでは再追加できない（v2 実装時点）。
対象サイトのページを開き直し、content script のブロックボタンで再登録する必要がある。
この不便が深刻なユースケースが出た場合は、削除確認ダイアログまたは undo の追加を検討する。

---

## キーワードブロック仕様

- 対象サイト: yahoo_news・yahoo_japan（roadmap の要件どおり。他サイトは YAGNI）
- storage schema: `blockedKeywords.{siteKey}: string[]`（chrome.storage.sync）
- 入力はトリム後に保存。重複・空文字は無視
- マッチング規則（部分一致 / 正規化方針）は v4-adapter-name の shiho が決定する。popup の storage 契約とは独立

---

## nameOnly バッジ仕様

設計文書 `docs/design-site-adapter.md` §4-2 に従う:

- `nameOnly: true` のエントリに `⚠ 名前マッチ` バッジを表示
- バッジに `title="この発信元は名前でブロックされています。発信元が名前を変えると自動的に解除されます"` を設定
- バッジスタイル: Soft Orange 背景 + Orange 枠 + Deep Orange テキスト（10px）

---

## テスト結果

```
popup.test.mjs:   13/13 pass
storage.test.mjs: 23/23 pass
その他テスト:      42/42 pass（既存テストへの影響なし）
合計: 78/78 pass
```
