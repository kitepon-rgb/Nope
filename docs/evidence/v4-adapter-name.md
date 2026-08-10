# v4-adapter-name 完了 evidence

実施日: 2026-08-11  
担当者: shiho

## 成果物

| ファイル | 内容 |
|---|---|
| `src/adapters/youtube_watch.js` | YouTube 視聴ページ関連動画アダプタ（パターンB） |
| `src/adapters/yahoo_news.js` | Yahoo ニュースアダプタ（パターンB）+ getTitle |
| `src/adapters/yahoo_japan.js` | Yahoo! JAPAN アダプタ（パターンB）+ getTitle |
| `src/keyword-filter.js` | NFKC+toLowerCase+部分一致+OR 正規化マッチング |
| `src/content-name.js` | パターンBエンジン（同期解決・初回0件warn） |

## キーワードブロック設計決定（v4 確定）

- **一致方式**: 部分一致（タイトルに含まれていればヒット）
- **大文字小文字**: 区別しない（toLowerCase）
- **全角半角**: 区別しない（NFKC 正規化）
- **複数キーワード**: OR（いずれか1つでブロック）
- **保存形式**: 生文字列のまま（正規化はマッチング時にエンジン側で行う）
- **storage スキーマ**: `blockedKeywords[siteKey]: string[]`（kotoha 宣言と一致確認済み）

## テスト結果

```
node --test test/*.test.mjs test/adapters/*.test.mjs
# tests 142
# pass 142
# fail 0
```

## セレクタ0件 warn の実装

初回スキャン時（`firstScanDone` フラグ）に `querySelectorAll(cardSelector)` が 0 件だった場合：

```
content-name: 初回スキャンでカードが0件。セレクタが壊れている可能性があります siteKey=xxx cardSelector=yyy
```

## manifest 登録（未完・v8a-manifest 席への依頼）

以下の content_scripts エントリを追加する必要がある（hiyori へ依頼済み）：

```json
{ "matches": ["*://www.youtube.com/watch*"],
  "js": ["src/storage.js", "src/keyword-filter.js", "src/content-name.js", "src/adapters/youtube_watch.js"] },
{ "matches": ["*://news.yahoo.co.jp/*"],
  "js": ["src/storage.js", "src/keyword-filter.js", "src/content-name.js", "src/adapters/yahoo_news.js"] },
{ "matches": ["*://www.yahoo.co.jp/*"],
  "js": ["src/storage.js", "src/keyword-filter.js", "src/content-name.js", "src/adapters/yahoo_japan.js"] }
```

## commit

b62bcb6（push なし）
