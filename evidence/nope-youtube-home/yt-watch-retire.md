# yt-watch-retire 完了証跡

## 何を作ったか

視聴ページ（`www.youtube.com/watch*`）の関連動画への介入を撤去した。

1. `manifest.json` から `*://www.youtube.com/watch*` 向け content_scripts エントリ
   （`storage.js`, `keyword-filter.js`, `content-name.js`, `adapters/youtube_watch.js`）を削除。
   `content-name.js` / `keyword-filter.js` は yahoo_news / yahoo_japan の既存エントリで
   引き続き読み込まれるためファイル自体は残した。
2. `src/adapters/youtube_watch.js` と専用テスト `test/adapters/youtube_watch.test.mjs`
   （8テストケース）を削除（`git rm`）。
3. 公開説明を現状仕様へ更新:
   - `README.md`: 対応サイト表「YouTube | 検索結果・動画視聴ページの関連動画 | チャンネル」から
     「動画視聴ページの関連動画」を削除。「ホーム」の追加はyt-home-search（別task）の成果が
     確定してから反映すべきと判断し、本taskでは含めていない。
   - `docs/store/listing.md`: Permission justificationのcontent_scripts JSON、
     `src/content-name.js`の説明（「ニュース一覧・関連動画」→「ニュース一覧」）、
     `*://www.youtube.com/watch*`ホストアクセス節（丸ごと削除）、対応サイト一覧の
     「動画視聴ページの関連動画」を削除。
   - `docs/store/privacy.md`: 面の名称を明記していないため変更不要と確認（要再確認だった
     `yt-flow-audit`の申し送りを検証・クローズ）。
   - `docs/store/submission-checklist.md`: YouTube言及なしを確認、変更不要。
   - `docs/evidence/*`・`docs/design-site-adapter.md`の過去の証跡・決定記録は改竄せず現状のまま
     残した（design_memoの境界どおり）。

## どう確認したか

- `node --test test/youtube-surfaces.test.mjs` で、本taskが担当する2テスト
  （manifest watchエントリ不在／youtube_watch.js不在）がgreenになったことを確認。
  残り3テスト（登録ボタン・高さ保持・0件警告）はyt-home-search（mashiro担当）の範囲でred継続
  （想定通り）。
- `node --test 'test/**/*.test.mjs'` で全体176件中pass173/fail3を確認
  （撤去前184件→176件は削除した8テストケース分の減少と一致。既存回帰なし）。
- `grep -rn "youtube_watch\|www.youtube.com/watch" src/ popup/ manifest.json` でコード側の
  残存参照がゼロであることを確認。
- `git status --short` でsrc/content-search.jsが自分の変更外（mashiroの並行作業）であることを
  認識し、commitのpathspecから除外した。

## 変更ファイル

- `manifest.json`（watch content_scriptsエントリ削除）
- `src/adapters/youtube_watch.js`（削除）
- `test/adapters/youtube_watch.test.mjs`（削除）
- `README.md`
- `docs/store/listing.md`
- `evidence/nope-youtube-home/yt-watch-retire.md`（本ファイル）
