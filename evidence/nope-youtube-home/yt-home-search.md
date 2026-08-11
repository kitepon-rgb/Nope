# yt-home-search 完了証跡

## 何を作ったか

`docs/design-youtube-surfaces.md` の契約に沿って、YouTube ホーム＋検索の共通ブロック導線を実装した。

1. **登録UI**（成功条件1）: `src/content-search.js`（CB_SEARCH）へ hover/focus で現れる登録トグルボタンを
   追加した。`resolver.register.anchorSelector` を指定したアダプタだけがオプトインする
   （rakuten・yahoo_shopping・yahoo_auctions・amazon は無指定のため無変更）。挿入先は `#dismissible`
   （kotoneのyt-dom-survey実測）。
2. **識別子の正規化**（成功条件2）: `src/adapters/youtube.js` へ `resolver.canonicalize` を追加し、
   handle形式（`@xxx`）を実チャンネル応答（`https://www.youtube.com/@xxx` の
   `<link rel="canonical">`）から正本のチャンネルID（UC形式）へ解決してから保存・照合する。
   `blockedSources` の正本はUC ID 1件のみ。handle→UC対応は既存の `itemSourceCache`
   （`storage.getCachedSource`/`setCachedSource`）を再利用してキャッシュする。解決に失敗した場合は
   ブロック操作自体を提供せず（部分登録禁止）、`#dismissible` へ常時可視のエラーバッジ
   （`.cb-search-register-error`）を出す。
   - この設計は3回のroom裁定往復を経て確定した（詳細は `docs/design-youtube-surfaces.md` §2の
     検討経緯を参照）: ①検知のみは不十分（bell差し戻し[35]）→②表示名での自動伝播は同名別チャンネル
     誤爆のリスクで却下（bell裁定[42]）→③実チャンネル応答からの解決なら許可（bell追補[43]）
     →④curl実測で実現可能と確認→⑤UC正本化・alias map分離・失敗時は可視エラーで最終裁定
     （bell[45][47][48]）。
3. **プレースホルダーの高さ維持**（成功条件5）: CB_SEARCHの `hideOriginalChildren`/`restoreOriginalChildren`
   に、CB_NAMEと同じ実測高さ保持ロジックを移植した。実測高さが取れない場合は既存の固定220pxへ
   フォールバックするため、他サイトの見た目は変わらない。
4. **セレクタ壊れ検知**: CB_SEARCHの `scan` に、初回スキャン0件時の `console.warn` を追加した
   （CB_NAMEの既存パターンと同型）。ホームで `ytd-video-renderer` が実在しない場合の安全弁。
5. **共有ブロックリスト・即時反映**（成功条件3・4）: 追加実装なし。既存の `siteKey: 'youtube'` 共有と
   `onBlockedSourcesChanged` 購読で満たされることを確認した。
6. **公開文書の更新**: `docs/store/privacy.md`・`docs/store/listing.md` へ、YouTubeチャンネルページへの
   新規ネットワーク通信（ブロック/解除操作時のみ発生）を開示した。

## どう確認したか

- `node --test 'test/**/*.test.mjs'` を実行し、**184件全てpass**（既存回帰なし）。
  - yt-contract-tests由来の5テストのうち3件（登録ボタン・高さ保持・0件警告）がgreen化。
  - 残り2件（manifest.jsonのwatch*エントリ不在・youtube_watch.js不在）はyt-watch-retire側で
    既にgreen化済み（kotone担当、commit 02f3b86）。
  - 新規追加7テスト: `src/adapters/youtube.js`のcanonicalize単体テスト5件（UC即時返却・handle解決・
    fetch失敗時throw・HTTPエラー時throw・canonical link不在時throw）、CB_SEARCH統合テスト3件
    （handle→UC解決後の照合・登録ボタンでの正本ID保存・解決失敗時の可視エラー表示と部分登録禁止の確認）。
- `curl` で実際のYouTubeチャンネルページを直接取得し、`canonical link`/`canonicalBaseUrl`の実在を
  確認した（`docs/design-youtube-surfaces.md` §2の実測記録・bellが独立に再現）。
- 製品コードの変更は `src/adapters/youtube.js`・`src/content-search.js` のみ。`manifest.json` は
  変更していない（ホームは既存の `*://www.youtube.com/*` ワイルドカードで技術的にカバー済みのため）。

## 未確認・残る限界（意図的に持ち越したもの）

- **ホームの実DOM構造は未確認**（H条件）。`docs/survey/youtube-home-search.md` はログアウト状態で
  空だったことしか確認できていない。ログイン済みでの `ytd-video-renderer` 実在は
  `yt-package-smoke` の実Chrome受入で確認する。異なる構造だった場合、0件警告は出るが機能しない。
- **YouTubeチャンネルページへのfetchが実際のcontent script環境（bot対策等）で動くかは未検証**。
  curlでは正常に取得できたが、AliExpressの前例（AGENTS.md）どおり自動化ブラウザ・実ブラウザで
  壁に当たる可能性がある。壁に当たった場合は全件が`resolutionFailed`になり、エラーバッジのみが出る
  （誤ブロック・部分登録は発生しない設計だが、機能そのものが使えなくなる）。`yt-package-smoke`での
  実Chrome確認が必要。
- **`itemSourceCache`のhandle→UC対応は、チャンネル側のhandle再割当が起きると古くなりうる**。
  popupの既存「キャッシュクリア」で手動対応可能（新規実装なし）。

## 変更ファイル

- 変更: `src/adapters/youtube.js`（canonicalize追加、register追加）
- 変更: `src/content-search.js`（登録ボタン・高さ保持・0件警告・canonicalize統合・エラーバッジ追加）
- 変更: `docs/design-youtube-surfaces.md`（設計確定）
- 変更: `docs/store/privacy.md`・`docs/store/listing.md`（新規ネットワーク通信の開示）
- 変更: `test/adapters/youtube.test.mjs`・`test/youtube-surfaces.test.mjs`（テスト追加）
- 追加: `evidence/nope-youtube-home/yt-home-search.md`（本ファイル）
