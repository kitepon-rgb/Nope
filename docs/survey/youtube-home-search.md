# YouTube ホーム・検索 実DOM調査（yt-dom-survey）

調査日: 2026-08-11
調査者: kotone
調査ツール: headless Google Chrome（`--headless=new --remote-debugging-port=9222`、自席で起動） + `mcp__playwright__*`（CDP直結、`claude-in-chrome` は不使用）
対象: `https://www.youtube.com/`（ホーム）、`https://www.youtube.com/results?search_query=nasa`（検索結果）
既存資料: `docs/survey/media-sites.md`（2026-08-11, shiho）に検索結果・視聴ページ関連動画の実測が既にある。本ファイルは重複を避け、そちらに無い項目（操作UI配置・無限スクロールの発火条件・SPA遷移の内部挙動・handle/UC比率の定量値）を中心に書く。両ファイルの数値は独立実測として突合可能。

---

## ホーム（`/`）

**未ログイン状態で実測**。結果は空。

```
main 直下:
  heading "まずは検索してみましょう"
  text "おすすめ動画を表示するには、まず動画を視聴しましょう。"
```

`ytd-rich-item-renderer` 等の動画カード要素は0件。**成功扱いにしない**——`media-sites.md` の既存所見（ログイン必須）と一致する。ホームのカード構造・チャンネルリンク有無は**未到達**。オーナーの通常Chrome（ログイン済みセッション）での実測が必要。

---

## 検索結果（`/results?search_query=nasa`）

### カード境界とレイアウトwrapper

```
div#contents (YTD-SECTION-LIST-RENDERER の子)
  └ ytd-video-renderer          ← カード本体（消す/隠す対象の単位）
      ├ div#dismissible          position: relative  ← 操作UIを絶対配置で乗せるアンカーに使える
      │   └ ...サムネイル・タイトル・チャンネル情報...
      ├ div#dismissed
      └ yt-interaction#interaction
```

`ytd-video-renderer` に `id` は無い（`class` のみ）。`media-sites.md` の記載と一致。

### チャンネルリンクの実href・表示名

セレクタ: `ytd-video-renderer ytd-channel-name a`

初期表示18件時点のサンプル（`?search_query=nasa`）:
- `/@NASA`（表示名 "NASA"）× 複数
- `/@koyakky-st`（表示名 "コヤッキースタジオ"）
- `/channel/UCiZqWVAeChfqlom5ZPR3ZJA`（表示名 "NCT WISH"）
- `/channel/UCw0aKHSGFGyrnMeVnHeYMyw`（表示名 "Camilo"）
- `/channel/UC8yA5ym-0X4GJsAFDytuPfw`（表示名 "ベン・ゼイン"）

無限スクロール後55件での内訳（実測集計）:

| 形式 | 件数 |
|---|---|
| `/@handle` | 37 |
| `/channel/UC...` | 14 |
| リンクなし（`ytd-channel-name a` が無い） | 4 |

**同一チャンネルがhandle/UC両形式で現れるケースは55件中0件**（表示名でグルーピングして href の重複を確認したが、同一表示名に対し href は常に単一の値だった）。`ytd-channel-name` 要素自身の属性は `id="channel-name"` と `class` のみで、handle⇔UCチャンネルIDを紐付ける `data-*` 属性は**存在しない**。**DOMだけでの正規化手段は無い**——`media-sites.md` の判断（両形式を持つかUC形式を正としてhandle解決機構が必要）と一致する結論。

「リンクなし」4件は無限スクロール直後の非同期読み込み中に一時的に構造未完了だったカードと推定される（再クエリで0件に減少する揺らぎを確認）。広告枠かどうかは未確定。

### hover / keyboard focus で操作UIを置ける位置

`#menu`（3点メニューボタンの親、`ytd-menu-renderer` を内包）を実測:

```
menuOpacityBefore: "1"
menuDisplayBefore: "block"
menuPosition: "static"
```

**hoverなしでも常時DOM上に存在し、可視**（opacity/displayによる出し分けをしていない）。したがって非表示ボタンの追加は「hoverで生成」ではなく、**カード生成時に`#dismissible`（position: relative）を親として絶対配置で常時挿入**する設計で足りる。keyboard focus専用の出し分けも観測されなかった（同じく常時可視のため）。

### SPA遷移・DOM差し替え

検索結果 → 動画クリック → 視聴ページ → `history.back()` で検索結果に戻る、を実測:

- クリック後、`document.querySelector('ytd-app')` の参照が**遷移前後で同一ノード**（`===` true）。フルリロードなしの `history.pushState` 型SPA。
- URLは `https://www.youtube.com/watch?v=...` に変化、`ytd-watch-flexy` が出現。
- `history.back()` 後、URLは検索結果に戻り、`ytd-video-renderer` は**55件のまま復元**（スクロールで読み込んだ分もキャッシュから復元される。DOM再構築ではなくbfcache的な保持と推定）。

`media-sites.md` の「MutationObserver必須」という結論と整合する実測。

### 無限スクロールで追加されるカードの形

- 初期表示: `ytd-video-renderer` **18件**、`ytd-continuation-item-renderer` は存在するがpassiveなscrollイベント発火だけでは**増えない**（`window.scrollTo` のみでは0件増加）。
- `window.scrollBy` + `window.dispatchEvent(new Event('scroll'))` を明示的に複数回発火させたところ、**55件まで増加**した。
- 追加されたカードも既存カードと同一タグ（`ytd-video-renderer`）・同一構造。新旧で別要素にはならない。
- **実装上の注意**: ヘッドレス環境ではIntersection Observer駆動のcontinuation読み込みが、単純な`scrollTo`だけでは起動しないケースがある。実ユーザーのマウスホイール操作では素直に発火すると推定されるが、自動テストでの無限スクロール検証にはscrollイベントの明示発火が要る点を申し送る。

### Shadow DOM

未再確認（`media-sites.md` で「なし」と実測済みのため今回は割愛）。

---

## 未到達条件

- **ホームのカード構造・チャンネルリンク形式はログイン必須のため未測定**。オーナーの通常Chrome（cookie保持済みセッション）での実測待ち。
- 検索結果の「リンクなしカード」4件が広告か読み込み中の揺らぎかは未確定。
- keyboard focus単独でのフォーカスリング・tabindex順序は未測定（操作UI常時可視のため優先度低と判断し割愛）。

## 判断（設計への示唆）

1. 検索結果の非表示ボタンは `#dismissible`（position: relative）を親に絶対配置で常時挿入すればよく、hover/focus検知の実装は不要。
2. handle⇔UC正規化はDOM単独では不可能——`media-sites.md` と合わせて二重に確認された結論。ブロックリストは両形式を許容するか、UC形式を正としhandleは別途解決する設計が要る。
3. 無限スクロール監視は `ytd-continuation-item-renderer` の出現 + MutationObserver で対応し、scrollイベント起動の有無に依存しない設計にする（ヘッドレス実測でのscrollTo単独不発火はテスト環境依存の可能性があり、本番相当の実ブラウザ挙動を過信しない）。
4. ホームの対応可否は次工程（要ログイン実測）まで判断を保留する。
