# v7b-verify-name 検証エビデンス

検証者: nagi（2026-08-11）  
対象: shiho 実装 Pattern B — yahoo_watch / yahoo_news / yahoo_japan + keyword-filter

---

## 合格（確認できた項目）

### 1. Yahoo! JAPAN `:has()` セレクタ動作確認

`article:has(cite):not(:has(article))` を Chrome で実行。

```
document.querySelectorAll('article:has(cite):not(:has(article))').length
→ 51
```

`:has()` が Chrome で正常動作することを実測確認。

### 2. 表示名ブロック（Yahoo! JAPAN）

`CB_STORAGE.addBlockedSource('yahoo_japan', 'TRILL ニュース', 'TRILL ニュース', true)` を設定後、
www.yahoo.co.jp をリロード。

```
{blockedCount: 7, blockedTexts: ["BLOCKEDTRILL ニュースブロック解除", ...（TRILL 5件 + スポニチ1件 + 他1件）]}
```

TRILL ニュース 5件がプレースホルダー表示。表示名マッチによるブロック動作確認。

### 3. キーワードブロック・NFKC 正規化（Yahoo! JAPAN）

キーワード「ミセス」（半角カタカナ）と「ＳＩＬＥＮＴ」（全角大文字）を登録。

- 「ミセス」→ 「ミセス」を含む記事タイトルをブロック確認
- 「ＳＩＬＥＮＴ」→ タイトルに「silent」（半角小文字）を含む記事をブロック確認

NFKC 全角→半角変換 + toLowerCase 大文字→小文字変換が両方動作。

### 4. ブロック解除ボタン（Yahoo! JAPAN）

TRILL ニュースのプレースホルダー上の「ブロック解除」ボタンをクリック。

```
blockedCount: 7 → 2（5件解除）
```

ボタンクリックで `removeBlockedSource` が呼ばれ、カードが復元されることを確認。
`event.preventDefault()` / `event.stopPropagation()` により親リンクへの遷移なし（DOM確認）。

### 5. collapse モード（Yahoo! JAPAN）

popup で display mode を `collapse` に切替、www.yahoo.co.jp をリロード。

```
{collapsed: 2, placeholder: 0}
```

キーワードにマッチした2件が `display: none`、プレースホルダーは0件。placeholder/collapse の切替動作確認。

---

## 未確認・不合格（問題あり）

### 6. YouTube watch ページ — `span.ytAttributedStringHost` セレクタ不一致

`youtube_watch.js` の `getSource` は `card.querySelector('span.ytAttributedStringHost')` を使う。

実測（yt-lockup-view-model 内の span.ytAttributedStringHost 一覧）:

```json
[
  {"i": 0, "text": "When Celebrities Couldn't Handle Clint Eastwood ZE"},
  {"i": 1, "text": "KindreD"},
  {"i": 2, "text": "1.2M"},
  {"i": 3, "text": "10d ago"}
]
```

`querySelector` は最初の span（index 0）＝**動画タイトル**を返す。チャンネル名は index 1（"KindreD"）。

**getSource がチャンネル名ではなく動画タイトルを返している。ブロックは意図した動作をしない。**

修正が必要: `querySelectorAll('span.ytAttributedStringHost')[1]` またはより意味論的なセレクタを使う。

### 7. Yahoo News — content script 動作未確認

`addBlockedSource('yahoo_news', '西スポWEB OTTO!', ...)` と `blockedKeywords.yahoo_news = ['西スポ']` を storage に設定後、news.yahoo.co.jp をリロード。

```
{phCount: 0, cardsCount: 50}  ← 3秒待機後
```

プレースホルダーが0件。chrome.storage.sync には正しく登録済み（popup 確認）。
manifest は `*://news.yahoo.co.jp/*` → yahoo_news.js の注入を定義。
Page context eval から isolated world の content script の動作状態が確認できず、原因特定不可。

別経路での確認または DevTools コンソール接続による実測が必要。

### 8. 0-match warn — 実測未達

`content-name.js:202` にコード実装を確認:

```javascript
if (cards.length === 0) {
  console.warn(`content-name: 初回スキャンでカードが0件。セレクタが壊れている可能性があります siteKey=${siteKey} cardSelector=${cardSelector}`);
}
```

実装は正しいが、content script の `console.warn` は isolated world から出力される。
agent-browser の page context eval からは確認不可。実測未達として記録。

---

## 検証結果まとめ

| 項目 | 結果 |
|------|------|
| Yahoo! JAPAN `:has()` セレクタ | ✓ 51件マッチ確認 |
| 表示名ブロック（TRILL ニュース） | ✓ 5件プレースホルダー確認 |
| キーワードブロック（NFKC 正規化） | ✓ 全角→半角、大文字→小文字 両方確認 |
| ブロック解除ボタン | ✓ 動作確認（遷移なし） |
| collapse モード | ✓ display:none 確認 |
| YouTube watch チャンネル名取得 | ✗ タイトルを取得（セレクタ不具合） |
| Yahoo News content script 動作 | ✗ 確認不可（原因不明） |
| 0-match warn 実測 | ✗ isolated world のため実測不可（コードのみ確認） |
