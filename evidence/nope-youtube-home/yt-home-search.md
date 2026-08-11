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
   `blockedSources` の正本はUC ID 1件のみ。handle→UC対応は `src/storage.js` に新設した
   `getSourceAliases`/`setSourceAlias`/`onSourceAliasesChanged`（`chrome.storage.sync` の
   `sourceAliases`キー、`blockedSources`と同じく端末間同期）で保持する。
   **通信（fetch）はユーザーが登録ボタンをクリックした時だけ発生する**——スキャン時（カード表示時）は
   既知のaliasを参照するだけで、未知のhandleカードは「未確認」（`sourceId: null`）のまま安全側で
   未ブロック表示にし、通常の登録ボタンを出す。クリック時の解決に失敗した場合はブロック状態を
   一切変更せず（部分登録禁止）、`#dismissible` へ常時可視のエラーバッジ
   （`.cb-search-register-error`）を出す。
   - この設計は4回のroom裁定往復を経て確定した（詳細は `docs/design-youtube-surfaces.md` §2の
     検討経緯を参照）: ①検知のみは不十分（bell差し戻し[35]）→②表示名での自動伝播は同名別チャンネル
     誤爆のリスクで却下（bell裁定[42]）→③実チャンネル応答からの解決なら許可（bell追補[43]）
     →④curl実測で実現可能と確認→⑤UC正本化・alias map分離・失敗時は可視エラーで裁定
     （bell[45][47][48]）→⑥**初回実装がスキャン時に全handleカードへ無条件fetchしていた欠陥を
     bell異議[51]・kotone監査[52]で指摘され、クリック時限定＋alias sync保存へ作り直した**。
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

- `node --test 'test/**/*.test.mjs'` を実行し、**190件全てpass**（既存回帰なし）。
  - yt-contract-tests由来の5テストのうち3件（登録ボタン・高さ保持・0件警告）がgreen化。
  - 残り2件（manifest.jsonのwatch*エントリ不在・youtube_watch.js不在）はyt-watch-retire側で
    既にgreen化済み（kotone担当、commit 02f3b86）。
  - `src/adapters/youtube.js`のcanonicalize単体テスト5件（UC即時返却・handle解決・
    fetch失敗時throw・HTTPエラー時throw・canonical link不在時throw）。
  - `src/storage.js`のsourceAlias関連テスト5件（未設定時空・保存/取得・siteKey分離・変更購読・
    対象外siteKeyで発火しないこと）。
  - CB_SEARCH統合テスト4件——**うち1件はbell異議[51]への直接の回帰防止テスト**
    「カードを表示するだけでは通信（canonicalize）を一切発生させない（未知handleカード複数でも0回）」。
    残り3件は既知aliasでのfetchなし照合、クリック時だけのcanonicalize呼び出しとalias同期保存、
    クリック時解決失敗時の可視エラー切替と部分登録禁止。
- `curl` で実際のYouTubeチャンネルページを直接取得し、`canonical link`/`canonicalBaseUrl`の実在を
  確認した（`docs/design-youtube-surfaces.md` §2の実測記録・bellが独立に再現）。
- 製品コードの変更は `src/storage.js`・`src/adapters/youtube.js`・`src/content-search.js`。
  `manifest.json` は変更していない（ホームは既存の `*://www.youtube.com/*` ワイルドカードで
  技術的にカバー済みのため）。

## 監査で見つかった欠陥と修正（初回commit 2f42573 → 修正）

**欠陥（bell異議[51]・kotone監査[52]で確定、CONFIRMED）**: 初回実装は`handleDirectCard`
（スキャン＝カード表示時点）で、未キャッシュのhandle形式カード全件へ無条件に`resolver.canonicalize`
（fetch）を実行していた。kotoneのyt-dom-survey実測（検索結果55件中handle37件）の規模で言うと、
検索結果を開いただけで最大37通信が飛ぶ。これは①mashiro自身が[46]で示した実装方針
「登録ボタンでのブロック/解除操作時（スキャン時は行わない）」、②同じcommitで書いたprivacy.md自身の
申告文言「表示だけでは発生しない」の両方と矛盾していた。加えてbellは、alias保存に使った
`itemSourceCache`（chrome.storage.local、端末間非同期）がblockedSources（sync）と非対称である
ことも指摘した。

**修正**: `src/storage.js`に`getSourceAliases`/`setSourceAlias`/`onSourceAliasesChanged`を新設し、
alias（handle→UC対応）を`chrome.storage.sync`の`sourceAliases`キーへ保存するよう変更。
`content-search.js`のスキャン経路（`handleDirectCard`）は同期済みaliasの参照だけに限定し、
`resolver.canonicalize`の呼び出し（fetch）は登録ボタンのクリック時だけに限定した。
未確認のhandleカードは「未ブロック」表示＋通常の登録ボタン（エラー扱いにしない）とし、
クリック時に初めて解決を試みる。修正後、bell異議への直接の回帰防止テストを含む
CB_SEARCH統合テスト4件で新しい契約を検証済み。privacy.md/listing.mdの記述はスキャン時fetchを
前提にしていなかったため文言修正は不要だったが、`itemSourceCache`→`sourceAliases`（sync）への
言及は修正した（commit 197526c）。

## 監査で見つかった欠陥と修正 その2（commit 197526c → 修正）

**欠陥（bell異議[55]・kotone監査[57]で確定、CONFIRMED）**: 197526cの修正はhandle→UC方向
（handle形式カードのクリックで正本UCを解決）だけを実装しており、**逆方向（UC形式カードのクリックで
対応するhandleを解決）が抜けていた**。`resolver.canonicalize`は元々handle→UCの一方向のみで、
UC形式カード（kotone実測で55件中14件）をクリックしてブロックしても`sourceAliases`には何も
保存されない。結果、同じチャンネルが後でhandle形式カードとして現れると、alias未確認のまま
「未ブロック」表示になる——plan成功条件2「片方だけ再出現する状態を許さない」に文字どおり反する
再現可能な欠陥だった。

**修正**: `src/adapters/youtube.js`に逆方向の`resolver.findHandleAlias(canonicalUCId)`を追加
（`https://www.youtube.com/channel/{UC}`をfetchし応答の`"canonicalBaseUrl":"/@handle"`から
handleを取り出す）。`content-search.js`の`resolveAliasOnDemand`をhandle/UC両方向に対応させ、
UC形式カードのブロック時にも`findHandleAlias`を呼んでaliasを学習・保存するようにした。
bellの裁定（[58]）どおり、**ベストエフォートにはしていない**——fetch失敗・非200・
`canonicalBaseUrl`パターン不一致は全て「同一性未確定」としてUC側もブロックせず可視エラーを出す
（パターン不在を「handleなし」と推測するfallbackは実装していない）。解除操作は既存の登録ボタンが
既にブロック済みIDを検知した場合、alias解決なしで即座に完結する（不要な通信をしない）ようクリック
ハンドラを分岐した。`findHandleAlias`単体テスト4件、CB_SEARCH統合テスト3件
（UC起点ブロック時のalias学習・解決失敗時の可視エラーとブロック不成立・解除時の通信0件）を追加。
`node --test 'test/**/*.test.mjs'`で**197件全てpass**（既存回帰なし）を確認済み。

## 未確認・残る限界（意図的に持ち越したもの）

- **ホームの実DOM構造は未確認**（H条件）。`docs/survey/youtube-home-search.md` はログアウト状態で
  空だったことしか確認できていない。ログイン済みでの `ytd-video-renderer` 実在は
  `yt-package-smoke` の実Chrome受入で確認する。異なる構造だった場合、0件警告は出るが機能しない。
- **YouTubeチャンネルページへのfetchが実際のcontent script環境（bot対策等）で動くかは未検証**。
  curlでは正常に取得できたが、AliExpressの前例（AGENTS.md）どおり自動化ブラウザ・実ブラウザで
  壁に当たる可能性がある。壁に当たった場合は全件が`resolutionFailed`になり、エラーバッジのみが出る
  （誤ブロック・部分登録は発生しない設計だが、機能そのものが使えなくなる）。`yt-package-smoke`での
  実Chrome確認が必要。
- **`sourceAliases`のhandle→UC対応は、チャンネル側のhandle再割当が起きると古くなりうる**。
  クリア手段は現時点で無い（popupの「キャッシュクリア」は`itemSourceCache`のみ対象）——
  再割当は稀だが、影響を受けたユーザーはブロック解除→再ブロックで新しいaliasに上書きできる
  （`setSourceAlias`は上書き保存）。
- **未確認のhandleカードは、登録ボタンを一度もクリックしなければ「片方だけ再出現する」可能性が
  残る**（意図的な残余リスク。`docs/design-youtube-surfaces.md` §2「残る限界」参照）。
- **vanity handleを持たない（またはcanonicalBaseUrlパターンで確定できない）チャンネルは、
  UC形式カードからも登録ボタンでブロックできない**（bell裁定[58]の帰結。「パターン不在＝handle
  なし」と推測しない設計上、恒久的にresolutionFailedになる）。実運用での影響規模は
  `yt-package-smoke`の実Chrome受入で確認する。

## 変更ファイル

- 変更: `src/storage.js`（sourceAlias関連API追加）
- 変更: `src/adapters/youtube.js`（canonicalize追加、register追加）
- 変更: `src/content-search.js`（登録ボタン・高さ保持・0件警告・canonicalize統合・エラーバッジ追加、
  クリック時限定の解決フロー）
- 変更: `docs/design-youtube-surfaces.md`（設計確定・欠陥修正の経緯を追記）
- 変更: `docs/store/privacy.md`・`docs/store/listing.md`（新規ネットワーク通信の開示、
  sourceAliasesへの言及修正）
- 変更: `test/adapters/youtube.test.mjs`・`test/youtube-surfaces.test.mjs`・`test/storage.test.mjs`
  （テスト追加・書き直し）
- 追加: `evidence/nope-youtube-home/yt-home-search.md`（本ファイル）
