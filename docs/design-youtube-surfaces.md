# YouTube 推薦面（ホーム・検索）の UI 契約設計

設計者: mashiro / 設計日: 2026-08-11
根拠: `docs/survey/youtube-home-search.md`（kotone）・`docs/evidence/youtube-flow-audit.md`（mashiro）
plan: nope-youtube-home / task: yt-contract-tests

前提として `docs/design-site-adapter.md`（v1, tsumugi）のアダプタ契約・storage スキーマは変更しない。
本書はその上に、YouTube 推薦面に限定した追加契約を積む。

---

## 1. 対象面の確定

| 面 | URL | 対応 | 根拠 |
|---|---|---|---|
| ホーム | `www.youtube.com/`（`watch*`を除く） | 新規追加（yt-home-search） | 実DOM未確認。**H条件**——本設計はセレクタが検索結果と同一 (`ytd-video-renderer`) と仮定するが、実装時に0件警告（§4）で検知しながら進める。異なると判明したらこの設計を差し戻す |
| 検索結果 | `www.youtube.com/results*` | 既存を再利用（変更ほぼ無し） | `docs/survey/youtube-home-search.md` で実測済み |
| 視聴ページ関連動画 | `www.youtube.com/watch*` | 完全撤去（yt-watch-retire） | plan成功条件6。介入自体が対象外になる |

ホームのカード構造が検索結果と異なると判明した場合、ホーム対応は本タスクの契約をそのまま使えない可能性がある。
これは既知の罠として yt-home-search 側で明示的に再確認すること（本設計では先回りして別契約を発明しない）。

---

## 2. カード契約（ホーム・検索 共通）

既存 `src/adapters/youtube.js` の `YOUTUBE_ADAPTER` をそのまま両面で使う。変更点は無い。

```javascript
{
  siteKey: 'youtube',
  matches: ['*://www.youtube.com/*'],   // 既存のまま。ホームもこのマッチに含まれる
  cardSelector: 'ytd-video-renderer',
  getWrapper: (card) => card,
  resolver: {
    type: 'dom_id',
    getSource(card) { /* 既存のまま：handle優先、UCフォールバック */ },
  },
}
```

### 識別子の正規化（plan成功条件2への回答）

`docs/survey/youtube-home-search.md` の実測（55件中 handle 37 / UC 14 / リンクなし4、**同一チャンネルの
両形式併存は0件**）と、`ytd-channel-name` に handle⇔UC を紐付ける `data-*` 属性が存在しないことから、
**DOM だけでの正規化手段は無い**。`docs/design-site-adapter.md` §3-3 の v1 決定（取れた形式をそのまま
保存・照合する、正規化しない）を維持する。

**残存リスク**（既知のまま残す。片方だけ再出現する状態そのものは無くならない）:
同一チャンネルが将来 handle 形式と UC 形式の両方でカードに現れた場合、片方だけの登録ではもう片方の
カードにブロックが効かない。これは実装で解決できる問題ではなく（DOM 側に紐付け手段が無い）、
「片方だけ再出現する状態を許さない」という成功条件は、**正規化ではなく検知**で満たす: §4 の
「0件警告」と同様に、resolver が同一表示名で異なる sourceId を返すケースが一定数を超えたら
`console.warn` する仕組みを yt-home-search で追加する（実装は yt-home-search の責務。本書は契約のみ確定）。

---

## 3. 登録 UI（新規契約: CB_SEARCH への hover/focus トグルボタン）

現状 CB_SEARCH（`content-search.js`）には登録ボタンが無い（`docs/evidence/youtube-flow-audit.md` §2）。
CB_NAME（`content-name.js`）の `ensureSourceButton` と同じ UX（hover/focus で opacity 0→1、
position:absolute top-right、クリックでブロック/解除トグル）を **CB_SEARCH エンジンへ追加**する。

### 3-1. 挿入先アンカー

`docs/survey/youtube-home-search.md` の実測: `#dismissible` が `position: relative` を持つ実カード内
要素。ボタンはここへ `position: absolute` で常時挿入する（DOM 生成は毎回、可視は hover/focus で
opacity 制御——CB_NAME と同じパターン）。

### 3-2. adapter 契約への追加フィールド（オプトイン）

既存の `dom_id` / `async_resolve` リゾルバの挙動を変えないため、**新フィールドはオプトインにする**。
指定が無いサイト（rakuten・yahoo_shopping・yahoo_auctions・amazon）は現状のまま変更されない。

```javascript
resolver: {
  type: 'dom_id',
  getSource(card) { /* 既存 */ },
  register: {
    // 登録ボタンを追加したいアダプタだけが指定する。省略時は現状どおりボタンなし。
    anchorSelector: '#dismissible',  // ボタンの挿入先（position:relative前提、無ければcard自体にフォールバック）
  },
}
```

### 3-3. ボタンの挙動

- 表示テキスト: 未ブロック時「🚫 このチャンネルをブロック」／ブロック済み時「ブロック解除」
  （CB_NAME と表現を揃えつつ「発信元」ではなく「チャンネル」と明示——plan成功条件1の文言に合わせる）
- クリック: `storage.getBlockedSources(siteKey)` を読み直し、無ければ
  `addBlockedSource(siteKey, sourceId, sourceName)`（**`nameOnly` を渡さない**——handle/UCはID
  ベースなので表示名フォールバックにしない。パターンAとBの混同を避ける）、あれば
  `removeBlockedSource(siteKey, sourceId)`。
- クリック後は `onBlockedSourcesChanged` の既存購読で即時反映（新規実装不要、既存の再適用ロジックに乗る）。
- placeholder 表示中（ブロック済み）はボタンを隠す（CB_NAME の `applySourceButton` と同じ規則）。

---

## 4. セレクタ壊れ検知（ホーム対応の安全弁）

`content-name.js` の「初回スキャン0件で `console.warn`」パターン（`docs/design-site-adapter.md` §4-2）を
CB_SEARCH にも追加する。**現状 CB_SEARCH にはこの検知が無い**（`scan` は素通りするだけ）。
ホームで `ytd-video-renderer` が実際には存在しない/別要素だった場合に「黙って効かなくなる」ことを防ぐ。

---

## 5. プレースホルダーの高さ維持（plan成功条件5）

**現状の CB_SEARCH の `buildPlaceholderElement` は `minHeight: '220px'` の固定値のみで、元カードの
実測高さを保持しない**（`content-search.js:84`）。CB_NAME 側は `hideOriginalChildren` で
`getBoundingClientRect().height` を測って `wrapper.style.height` に固定し、復元時に戻す仕組みを既に持つ
（`content-name.js:36-50`）。**この高さ保持ロジックを CB_SEARCH 側にも移植する**必要がある。

- 影響範囲を YouTube に限定するため、CB_NAME と同じ実装を CB_SEARCH の `hideOriginalChildren` 相当の
  関数に追加する（既存の固定 `minHeight` はそのまま残し、実測高さが取れた場合はそちらを優先する形にすれば
  他サイトの見た目を変えずに済む——実測高さが無い/0の場合は現状の固定220pxにフォールバック）。
- これは全 CB_SEARCH サイト共通のコード変更になるが、**既存サイトの挙動を変えない**（フォールバックが
  現状と同じ）ため、「変更範囲はYouTubeの推薦面とその共通処理に限定する」の範囲内とみなす。

---

## 6. 共有ブロックリスト・即時反映（plan成功条件3・4）

追加実装は不要。`youtube.js` は既に `siteKey: 'youtube'` を検索結果・ホームで共有し、
`content-search.js` の `storage.onBlockedSourcesChanged(siteKey, ...)` 購読が両面のカードへ即時反映する
（登録元がどちらの面でも、同じ `blockedSources.youtube` を見る）。SPA遷移・無限スクロールは既存の
`MutationObserver({childList:true, subtree:true})` で追従できることを `docs/survey/youtube-home-search.md`
で実測済み（新規カードも同一タグ・同一構造、SPA復元もキャッシュ由来で構造は壊れない）。

---

## 7. 視聴ページの扱い（plan成功条件6）

`yt-watch-retire` の担当。本書では**撤去後に真になるべき契約**だけを確定する:

- `manifest.json` の `content_scripts` に `*://www.youtube.com/watch*` へのエントリが存在しないこと
- `src/adapters/youtube_watch.js` が存在しないこと
- 関連動画カードに Nope の UI（ボタン・プレースホルダー）が一切注入されないこと

`content-name.js` と `src/keyword-filter.js` は yahoo_news / yahoo_japan で使う共有エンジンなので残す。
撤去対象は watch 用の content_scripts エントリと `youtube_watch.js` だけ（`docs/evidence/youtube-flow-audit.md` §5 と同一）。

---

## 8. この工程の外にあるもの（plan本文の再掲・変更なし）

- 視聴ページの関連動画に対する発信元ブロック、キーワードブロック、並び替え
- YouTube ホームに対するキーワードブロック
- チャンネル表示名だけを識別子にする互換処理（YouTube検索・ホームでは使わない。関連動画の`nameOnly`実装ごと撤去）
- handle⇔UC の API 正規化（`docs/design-site-adapter.md` §3-3 のとおり v1〜本工程でも先送り）
