# yt-contract-tests 完了証跡

## 何を作ったか

- `docs/design-youtube-surfaces.md` — `docs/survey/youtube-home-search.md`（kotone実測）と
  `docs/evidence/youtube-flow-audit.md`（mashiro監査）を統合し、ホーム・検索・視聴ページの
  介入境界、カード契約、識別子の扱い（正規化しない・残存リスクは検知で緩和）、登録UIの契約
  （CB_SEARCHへのオプトイン式トグルボタン、`#dismissible`アンカー）、高さ保持、共有リスト・
  即時反映、視聴ページ撤去後に真になるべき契約を確定した。
- `test/youtube-surfaces.test.mjs` — 上記契約に対する失敗する受入テスト5件:
  1. CB_SEARCHが未ブロックカードへhover/focus登録ボタンを注入する（成功条件1）
  2. CB_SEARCHのplaceholderが元カードの実測高さを保持する（成功条件5）
  3. CB_SEARCHが初回0件スキャンでセレクタ壊れをwarnする（ホーム対応の安全弁）
  4. manifest.jsonにwatch*向けcontent_scriptsエントリが無い（成功条件6、撤去後に真になる）
  5. `src/adapters/youtube_watch.js`が存在しない（成功条件6、撤去後に真になる）

## どう確認したか

- `node --test test/youtube-surfaces.test.mjs` を実行し、**5件全てが現行実装に対してredで
  落ちる**ことを確認した（実装が無い/撤去されていないことを直接示すアサーション失敗であり、
  クラッシュや構文エラーによる失敗ではない）。
- `node --test`（全テストスイート）を実行し、既存179件は全てpassのまま、fail は上記5件のみで
  既存機能への回帰が無いことを確認した（pass 179 / fail 5）。
- 実装コード（`src/`配下）は変更していない（監査タスクの境界どおり、設計と失敗テストの追加のみ）。

## 変更ファイル

- 追加: `docs/design-youtube-surfaces.md`
- 追加: `test/youtube-surfaces.test.mjs`
- 追加: `evidence/nope-youtube-home/yt-contract-tests.md`（本ファイル）

## 次工程への申し送り

- `yt-home-search`・`yt-watch-retire` はこの5テストをgreenにすることが受入条件の一部になる
  （ただしテストが実装の全てを規定するわけではなく、`docs/design-youtube-surfaces.md`の契約
  本文も合わせて実装すること）。
- ホームの実DOM（`ytd-video-renderer`が実在するか）は依然未確認。yt-home-search側で最初に
  実ブラウザ確認してから実装に入ること（本設計は「同一と仮定」した上でのH条件と明記済み）。
