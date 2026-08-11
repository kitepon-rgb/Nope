# B4 検証: Yahoo News のプレースホルダー（実ブラウザ実測）

- 日時: 2026-08-11
- 実測者: bell
- 経緯: codex 席は sandbox（`-s workspace-write`）で `/run/user/1000` が read-only のため
  agent-browser を起動できず「原因未特定」で停止した。実ブラウザ検証を bell が引き取った。
- 環境: agent-browser 0.25.3、`--extension` で unpacked 読み込み、セッション `b4`

## 結論

**B4「Yahoo News でプレースホルダーが出ない」は再現しない。** storage に発信元が登録されていれば
プレースホルダーは正しく表示され、マスコット画像も読み込まれ、解除ボタンも動作する。

ただし別の欠落を見つけた（後述）。

## 実測手順と結果

### 1. 拡張の読み込み確認

`chrome://extensions` の shadow DOM を辿って確認。

- id: `efcgoleknjceombadjnbhopdmeeenaed`
- name: `Nope — 見たくないもの見せません`

### 2. adapter が前提とする DOM の充足

`https://news.yahoo.co.jp/` トップページで実測。

| セレクタ | 件数 |
| --- | --- |
| `ul.newsFeed_list` | 1 |
| `ul.newsFeed_list > li` | 50 |
| `time` | 58 |

1枚目のカードの構造は「タイトル / 文春オンライン / 8/11(火) 11:00」で、
`time.previousElementSibling` は `SPAN` で textContent が `文春オンライン`。
**adapter（`cardSelector: 'ul.newsFeed_list > li'`、`time.previousElementSibling`）の前提は
DOM 側も満たしている。**

### 3. console にエラー無し

content script 由来のエラーは出ていない（ページ側の Google 広告の deprecation 警告のみ）。

### 4. ブロック登録 → プレースホルダー表示

`chrome.storage.sync` へ `blockedSources.yahoo_news['文春オンライン'] = {name, addedAt}` を登録。
entry の形は `storage.js:28` の `addBlockedSource` が作るものと一致させた。

再読み込み後の実測:

- カード 50 枚のうち「文春オンライン」のカードが 2 枚
- `.cb-blocked-placeholder` が **2 件**挿入された
- プレースホルダーの textContent: `BLOCKED文春オンラインブロック解除`
- マスコット画像: `chrome-extension://<id>/assets/mascot-blocked.png`、**`naturalWidth > 0`**
  （web_accessible_resources が効いている）
- 解除ボタンが存在する

### 5. 解除ボタン

`.cb-blocked-placeholder button` をクリック後、`.cb-blocked-placeholder` の件数が **0** になった。

## 見つけた欠落: Pattern B サイトに発信元ブロックの登録経路が無い

`addBlockedSource` の呼び出し元は `src/content-item.js:67` の
`CB_STORAGE.addBlockedSource('aliexpress', storeId, name)` **だけ**である。

`popup/popup.js` が持つのは以下で、**追加の口が無い**。

- `getAllBlockedSources()`（一覧表示）
- `removeBlockedSource(siteKey, sourceId)`（解除）
- `getBlockedKeywords` / `addBlockedKeyword` / `removeBlockedKeyword`（キーワード）
- `clearCache()`

したがって **Yahoo News・YouTube watch のような Pattern B サイトでは、ユーザーが発信元を
ブロック登録する手段が存在しない**。エンジン側は登録済みの発信元を正しく処理するが、
入れる経路が無い。キーワードブロックは popup から登録できるので、現状の実ユーザー経路は
キーワードだけになる。

B4 の「プレースホルダーが出ない」という報告の実態は、この登録経路の欠落である可能性が高い。
ただし元の報告の詳細（どのページ・どの操作で確認したか）は docs にも room ログにも
残っていないため、断定はしない。

## 未検証

- 即時反映（`onBlockedSourcesChanged` による、ページを開いたままの storage 変更への追随）は
  タブ1枚では検証できないため未実施。
- キーワードブロックで同じカードが隠れるかは未実施（B4 の範囲外）。
