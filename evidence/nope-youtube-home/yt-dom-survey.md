# yt-dom-survey 完了証跡

## 何を作ったか

`docs/survey/youtube-home-search.md` — YouTube ホーム・検索結果の実DOMを、headless Chrome
（`--headless=new`、自席で起動、CDP経由で `mcp__playwright__*` から操作。`claude-in-chrome` は
不使用）で実測した記録。既存の `docs/survey/media-sites.md`（shiho, 2026-08-11）と重複する
基本構造は参照に留め、そちらに無い以下を新たに実測した:

1. ホーム（`/`）は未ログインで空（`ytd-video-renderer` 0件、"まずは検索してみましょう"のみ）。
   成功扱いにせず、オーナー通常Chromeでのログイン済み実測が未到達条件として必要と明記。
2. 検索結果カードの操作UIアンカー: `#dismissible`（`position: relative`）配下に
   `#menu`（3点メニュー、常時 `opacity:1`/`display:block`）。hover/focus由来の出し分けは無く、
   非表示ボタンはカード生成時に常時挿入すればよいという設計判断を導いた。
3. SPA遷移の内部挙動: 検索結果→動画クリック→`history.back()` を実測し、`ytd-app` ノードが
   遷移前後で同一参照であること（フルリロードなしの `pushState` 型）、戻り後もスクロール済み
   カード（55件）がキャッシュから復元されることを確認。
4. 無限スクロール: 初期18件→スクロール操作後55件まで増加を実測。ヘッドレス環境では
   `window.scrollTo` 単独では continuation が発火せず、`scrollBy` + `scroll` イベント明示発火が
   必要だった点を実装・テスト設計への申し送りとして明記。
5. handle/UC比率を定量化（55件中 handle:37, channelUC:14, リンクなし:4）。同一チャンネル名で
   href形式が重複するケースは0件、`ytd-channel-name` に正規化用の `data-*`属性が無いことを
   確認し、「DOMだけでは正規化できない」という `media-sites.md` の判断を独立に再確認した。

## どう確認したか

- headless Google Chrome を `/private/tmp/.../scratchpad/chrome-profile` の一時プロファイルで
  port 9222 に起動（room へ事前告知 [13]）。
- `mcp__playwright__browser_navigate` / `browser_evaluate` で実ページのDOMを直接クエリ
  （スナップショットはトークン超過で使えなかったため、`document.querySelectorAll` ベースの
  集計JSに切り替えて実測）。
- ホーム（`/`）・検索結果（`/results?search_query=nasa`）で以下を実施:
  - `ytd-video-renderer` / `ytd-channel-name a` の件数・href集計
  - `#dismissible` / `#menu` の `getComputedStyle` 実測
  - `history.back()` 前後でのノード同一性・URL・件数の実測
  - `scrollBy` + `scroll` イベント発火によるcontinuation読み込みの実測（前後件数比較）
- 製品コード・テストは変更していない（設計メモの境界どおり）。

## 変更ファイル

- `docs/survey/youtube-home-search.md`（新規）
- `evidence/nope-youtube-home/yt-dom-survey.md`（本ファイル）
