# YouTube推薦面再設計 終端監査（yt-terminal-audit）

監査日: 2026-08-12 / 監査席: Mashiro（read-only） / 統合: bell

## 結論

`nope-youtube-home`のコード、テスト、配布物、オーナー実Chrome証跡を反証した。円卓監査で見つかった古い内部コメント1件はcommit `26171e5`で修正し、Mashiroが再確認した。**終端監査を妨げる残りはなく、受理する。**

## 必須反証の結果

1. **UI登録を通らない偽受入ではない**: `test/youtube-surfaces.test.mjs`には登録・解除ボタンのclickを実際に発火させるテストが8件あり、storage直投入だけで登録成功を作っていない。
2. **識別子の退行なし**: YouTube経路は`nameOnly`を使わず、handle→UCの`canonicalize`とUC→handleの`findHandleAlias`を維持している。登録先は解決済みUC IDである。
3. **ホームと検索の分断なし**: manifestのYouTube content scriptは1エントリ、adapterも1つで、`ytd-video-renderer, ytd-rich-item-renderer`と共通`siteKey`を使用する。
4. **視聴ページ関連動画の機能残存なし**: watch用manifest entry・adapter・UI・filter・README/ストア説明の参照はない。監査で見つかった`src/content-name.js`の「3面で使用」という旧コメントは「Yahoo ニュース / Yahoo! JAPAN の2面で使用」へ修正した。
5. **配布物一致**: `src/`と`dist/chromeblocker-v2.0.0-unpacked/src/`は差分なし。ZIP内の各ファイルもunpacked面と一致し、manifest・assets・icons・popupを含む。
6. **H受入実施済み**: `docs/evidence/youtube-home-search-smoke.md`に、3回の差し戻しと最終合格、トップ→検索の共有ブロック、解除、登録ターゲット一致を記録済み。

## 検証

- 全テスト（監査席）: `node --test 'test/**/*.test.mjs'` — **214件 pass / 0 fail**
- コメント修正後focused test: `node --test test/content-name.test.mjs` — **4件 pass / 0 fail**
- `src/`とstable unpackedの比較: **差分なし**
- 最終ZIP SHA-256: `b43598b55a89b600d90d76f7b740175238beefb01d037641602f2b920e824fd5`
- 円卓記録: 初回終端監査 `seq 171`、指摘修正後の再確認 `seq 173`

## 裁定

Mashiroの最終回答は「終端監査を妨げる残りはありません。受理を推奨します」。これを受理し、`yt-terminal-audit`を完了とする。
