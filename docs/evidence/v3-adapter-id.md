# v3-adapter-id 完了証跡

担当: nagi  
日付: 2026-08-11

## 成果物

| ファイル | 内容 |
|----------|------|
| `src/adapters/rakuten.js` | 楽天市場アダプタ（Pattern A） |
| `src/adapters/yahoo_shopping.js` | Yahoo!ショッピングアダプタ（Pattern A） |
| `src/adapters/youtube.js` | YouTube アダプタ（Pattern A） |
| `test/adapters/rakuten.test.mjs` | 楽天テスト（7件） |
| `test/adapters/yahoo_shopping.test.mjs` | Yahoo!ショッピングテスト（8件） |
| `test/adapters/youtube.test.mjs` | YouTube テスト（10件） |

## テスト結果

```
node --test test/adapters/rakuten.test.mjs test/adapters/yahoo_shopping.test.mjs test/adapters/youtube.test.mjs
# tests 25
# pass 25
# fail 0
```

既存テスト（content-search.test.mjs）も 21/21 pass を確認。

## 実測根拠

- 楽天市場: `docs/survey/ec-sites.md` — `.dui-card` 内 `a[href^="https://www.rakuten.co.jp/"][href$="/"]` から shopSlug 取得（実測例: aidort / 愛度楽天市場店）
- Yahoo!ショッピング: 同上 — CSS Modules ハッシュ付きセレクタ `div[class*="SearchResult_SearchResultItem"]`、広告カード（直リンクなし）は null
- YouTube: `docs/survey/media-sites.md` — handle 形式（`/@handle`）優先、UC 形式フォールバック

## YouTube 2形式調査結果

検索結果 23件を実測:
- handle 形式（`/@`）: 11件
- UC 形式（`/channel/UC...`）: 12件
- **同一チャンネルが両形式で出たケース: 0件**

→ 正規化不要。v1 は取得形式をそのまま保存・照合する方針で問題なし。
