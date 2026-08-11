# YouTube推薦面 再梱包・実Chrome受入smoke（yt-package-smoke）

検証日: 2026-08-11 / 担当: kotone

**この証跡は4回のsmoke・修正を記録する。**
1回目(commit 7f05ee4時点): Chrome for Testing実ロード中に登録ボタンのtextContent欠落を発見しmashiroへ報告([69])。
2回目(commit 7e70a24時点): bell裁定[70]によるmashiroの修正を再梱包・再smokeで確定。**この時点でオーナー実Chrome受入(H)へ提出し、bell[82]によりホームでボタン0件として差し戻された**（自動検証は未ログインのため気付けなかった。ホームの実カードが`ytd-video-renderer`ではなく`ytd-rich-item-renderer`だったのが原因）。
3回目(commit 3d29ac4時点): mashiroのホームDOM対応修正を再梱包・再smokeで確定。**この時点でH条件へ再提出したところ、bell[95]により配布欠陥（後述）で再度差し戻された。**
4回目(commit cfcdc5c時点): pack.mjs自体の欠陥（stable unpacked面が更新されない）をkotoneが修正。以下「自動検証」節はpack.mjs修正前後で変化しない部分（ZIP中身・content script動作）は3回目時点の記録を維持しつつ、pack.mjs修正の内容を追記する。

## 自動検証（最終・commit 3d29ac4時点）

### 全テスト実行

```
node --test 'test/**/*.test.mjs'
```

結果: **201件 pass / 0 fail**（既存回帰なし。ホーム形式カード・広告カードスキップ・検索/ホーム混在スキャンの回帰防止テスト含む）。

### 再梱包

```
node scripts/pack.mjs
```

- 出力: `dist/chromeblocker-v2.0.0.zip`
- SHA-256: `5907e377445f5b497a2c8a13401aa9ea2781ec78cc8122c9a0922c354003e57d`（commit 3d29ac4時点。過去2回のSHA-256 `1afd7e90...`／`21f0398e...` はいずれも修正前のビルドであり無効）

### 隔離展開smoke（静的検証）

ZIPを隔離ディレクトリへ展開し、Pythonスクリプトでmanifest.jsonの整合性を検証:

- `manifest.json`: valid JSON、`version: 2.0.0`
- `action.default_popup` / `icons.{16,48,128}` / 全`content_scripts[].js` / 全`web_accessible_resources[].resources`: 参照ファイル欠落なし
- `*://www.youtube.com/watch*` へのcontent_scriptsエントリ: **存在しない**（yt-watch-retireの撤去を配布物でも確認）
- `youtube_watch.js`への参照: **無し**

### Chrome for Testing実ロードsmoke

**環境上の注意**: 通常のGoogle Chrome（stable channel）は`--load-extension`コマンドラインフラグを無視する仕様（Chrome 137以降）のため、拡張の実ロード確認ができなかった。`npx @puppeteer/browsers install chrome@stable`でChrome for Testingを導入し、`--headless=new --load-extension=<隔離展開ディレクトリ>`で起動して確認した（Chrome/151.0.7922.77、`mcp__playwright__*`でCDP接続）。

- `chrome://extensions`: 「Nope — 見たくないもの見せません」が正しくロードされ、エラーボタン非表示（読み込みエラー0件）、有効化トグルON
- `popup/popup.html`を直接開いて確認: コンソールエラー・警告0件
- `https://www.youtube.com/results?search_query=nasa`: content script注入を確認（`ytd-video-renderer` 17件、1件目の`#dismissible`配下に`.cb-search-register-button`が挿入済み、**`textContent`は`'🚫 このチャンネルをブロック'`と正しく表示されることを確認（修正反映済み）**）。コンソールのエラー・警告はYouTube自身のもの（`manifest.webmanifest`のmigrate_from警告、未ログインによる`accounts.google.com`の401、動画プレビュー自動再生の`googlevideo.com`403×6件）のみで、Nope由来のエラーは0件
- `https://www.youtube.com/watch?v=Q5_BtWc-G7Y`（視聴ページ）: `.cb-source-block-button` / `.cb-search-register-button` / `.cb-blocked-placeholder` いずれも**0件**——Nope UI・フィルタが一切注入されないことを確認（plan成功条件6・yt-watch-retireの受入と一致）
- `https://www.youtube.com/`（ホーム・未ログイン）: カード0件（想定どおり）。**セレクタ壊れ検知の安全弁が実際に発火**し、`content-search: 初回スキャンでカードが0件。セレクタが壊れている可能性があります siteKey=youtube cardSelector=ytd-video-renderer, ytd-rich-item-renderer` というwarnをコンソールで確認（エラー・クラッシュではなくwarnとして黙らず可視化される設計どおりの挙動）。未ログインのため、修正後のホーム実カード(`ytd-rich-item-renderer`)へ登録ボタンが出ることの実ロード確認はできない——**この検証はH条件（オーナー実Chrome）に委ねる**

### 1〜3回目smokeで発見・解消済みの欠陥

1. **登録ボタンのtextContent欠落**（1回目→2回目で解消）: `content-search.js`の`ensureRegisterButton`に`button.textContent`を設定するコードが無く、登録ボタンが実ページで常に空欄表示だった。[69]で報告、bell裁定[70]を経てcommit 7e70a24で修正・確認済み。
2. **ホームの実カード誤認**（2回目→3回目で解消）: `cardSelector: 'ytd-video-renderer'`のみだったため、ホームの実カード`ytd-rich-item-renderer`に登録ボタンが1件も出ない状態だった。2回目smoke後のH条件でbellがオーナー実Chromeで発見・差し戻し([82][86])、commit 3d29ac4で`cardSelector`複合化・アンカー関数化により修正・確認済み（本smokeのセレクタ壊れwarn文言もカード0件時点で新セレクタが反映されていることを裏付ける）。
3. **配布物のstable unpacked面が更新されない**（3回目H提出後に発覚、4回目で解消）: README記載どおりユーザーは`dist/chromeblocker-v2.0.0-unpacked`をLoad unpackedで読み込んで使っているが、`scripts/pack.mjs`はZIPのみを一時ディレクトリ経由で再生成しており、このunpacked面を更新していなかった。結果、ユーザーのChromeはホームの検索button=0どころか**検索でもbutton=0**（8/11 16:51時点の旧コードのまま。撤去済みの`youtube_watch.js`も残存）という、実装修正3回分がまったく反映されない状態で受入を受けていた。bell実測[95]で発覚。

## pack.mjs修正（4回目・commit cfcdc5c）

**原因**: `pack.mjs`は毎回`mkdtempSync`で使い捨ての一時ディレクトリへコピーしてZIP化するだけで、`dist/chromeblocker-v2.0.0-unpacked`という別の固定ディレクトリには一切触れていなかった。このunpacked面は過去のcampaign（v8-package等）で一度手動生成されたきり、以後のpackで更新されないまま放置されていた。

**修正内容**:
- ZIP生成前に`dist/chromeblocker-v<version>-unpacked`を**丸ごと削除してから**再生成するようにした（増分コピーだと撤去済みファイルが残るため）。
- ZIPはこのunpacked面から生成する構成に変更し、ZIPとunpackedが常に同一内容になることを構造的に保証した。
- 回帰防止テスト`test/pack.test.mjs`を新規作成（3件）:
  1. ZIPとunpacked面のファイル一覧が一致する
  2. unpacked面に事前に残骸ファイルを置いた状態でpackを実行すると削除される（削除差分込み再生成の検証）
  3. 撤去済みの`youtube_watch.js`が同梱物に含まれない

**検証**:
```
node --test 'test/**/*.test.mjs'
```
結果: **204件 pass / 0 fail**（201件 + pack.mjs新規3件、既存回帰なし）。

実際に`node scripts/pack.mjs`をリポジトリ直下で実行し、`dist/chromeblocker-v2.0.0-unpacked/src/adapters/`から`youtube_watch.js`が消えたことを確認:
- 実行前: `amazon.js rakuten.js yahoo_auction.js yahoo_japan.js yahoo_news.js yahoo_shopping.js youtube.js youtube_watch.js`（8ファイル、`youtube_watch.js`残存）
- 実行後: `amazon.js rakuten.js yahoo_auction.js yahoo_japan.js yahoo_news.js yahoo_shopping.js youtube.js`（7ファイル、正しい状態）
- 新ZIP SHA-256: `0a77251996498eb99dac02426837982be73b140d519a5ad9f638dc36acb32ad0`（ソース自体は3回目時点のcommit 3d29ac4のsrc/から変わっていないため、ZIPの中身は3回目smokeで確認済みの内容と同一——変わったのはunpacked面が正しく追従するようになった生成プロセスの方）

## オーナー実Chrome受入（H）— 再提出（3回目）

過去2回の提出はいずれも不合格。1回目(2回目smoke時点)はホームのボタン0件([82])、2回目(3回目smoke時点)は配布物のunpacked面が更新されておらず検索・ホーム両方でbutton=0のまま受入されていた([95])。今回はunpacked面の生成プロセス自体を修正したため、**オーナーには一度既存のunpacked拡張をChromeから削除し、`dist/chromeblocker-v2.0.0-unpacked`を改めてLoad unpackedし直すことをお願いする**（同じディレクトリパスでも中身が総入れ替えされているため、単純な再読み込みでは反映されない場合がある——Chromeの拡張再読み込みボタンで反映されるはずだが、反映されなければ一度削除して読み込み直す）。

確認いただきたい5項目:

1. ホームの登録、ブロック、高さ維持、解除
2. 検索の登録、ブロック、解除
3. ホームと検索をまたぐ共有リスト
4. SPA遷移と追加カードへの追従
5. 視聴ページ関連動画にNopeのUIもフィルタも無い

自動化ブラウザ（未ログイン・Chrome for Testing）では上記5項目を確認できない。**成功扱いにせず、オーナー確認待ちとする**。

## オーナー実Chrome受入（H）— フローティングUI修正後の部分受入

オーナーのログイン済み通常Chromeで、YouTubeホームのカードに対するフローティングUIを再確認した。

- 対象実装: commit `6b1ff50`（YouTubeプレビュー上での表示維持）、commit `8d036c0`（茶色いhoverハイライト右下への整列）
- 最終自動検証: `node --test 'test/**/*.test.mjs'` — **211件 pass / 0 fail**
- 再梱包後ZIP SHA-256: `12964c08720072d855747821b7f39cb41568ac72df956150680e41278a8f16b9`
- オーナー受入結果（2026-08-11）:
  - ブロックボタンの配置: **合格**
  - チャンネルのブロック: **成功**
  - ブロック解除: **成功**
  - YouTube検索結果カードでのブロックボタン表示: **成功**

この結果でフローティングUI修正そのものは受入済み。工程全体は、検索面、ホームと検索の共有リスト、SPA遷移・追加カード、視聴ページ関連動画の非介入を順に確認してから完了とする。
