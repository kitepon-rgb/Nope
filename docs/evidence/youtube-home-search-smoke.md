# YouTube推薦面 再梱包・実Chrome受入smoke（yt-package-smoke）

検証日: 2026-08-11 / 担当: kotone

**この証跡は3回のsmokeを記録する。**
1回目(commit 7f05ee4時点): Chrome for Testing実ロード中に登録ボタンのtextContent欠落を発見しmashiroへ報告([69])。
2回目(commit 7e70a24時点): bell裁定[70]によるmashiroの修正を再梱包・再smokeで確定。**この時点でオーナー実Chrome受入(H)へ提出し、bell[82]によりホームでボタン0件として差し戻された**（自動検証は未ログインのため気付けなかった。ホームの実カードが`ytd-video-renderer`ではなく`ytd-rich-item-renderer`だったのが原因）。
3回目(commit 3d29ac4時点): mashiroのホームDOM対応修正を再梱包・再smokeで確定。以下は最終(3回目・確定)の結果。

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

### 1回目・2回目smokeで発見・解消済みの欠陥

1. **登録ボタンのtextContent欠落**（1回目→2回目で解消）: `content-search.js`の`ensureRegisterButton`に`button.textContent`を設定するコードが無く、登録ボタンが実ページで常に空欄表示だった。[69]で報告、bell裁定[70]を経てcommit 7e70a24で修正・確認済み。
2. **ホームの実カード誤認**（2回目→3回目で解消）: `cardSelector: 'ytd-video-renderer'`のみだったため、ホームの実カード`ytd-rich-item-renderer`に登録ボタンが1件も出ない状態だった。2回目smoke後のH条件でbellがオーナー実Chromeで発見・差し戻し([82][86])、commit 3d29ac4で`cardSelector`複合化・アンカー関数化により修正・確認済み（本smokeのセレクタ壊れwarn文言もカード0件時点で新セレクタが反映されていることを裏付ける）。

## オーナー実Chrome受入（H）— 再提出

前回(2回目)提出分はホームのボタン0件で不合格([82])。今回(3回目・commit 3d29ac4)の自動検証で修正を確認済みのため、以下5項目のオーナー確認を再度お願いする:

1. ホームの登録、ブロック、高さ維持、解除（**今回の修正対象。特に重点確認を推奨**）
2. 検索の登録、ブロック、解除
3. ホームと検索をまたぐ共有リスト
4. SPA遷移と追加カードへの追従
5. 視聴ページ関連動画にNopeのUIもフィルタも無い（自動検証で未ログイン状態は確認済み。ログイン状態での再確認はオーナー実施分）

自動化ブラウザ（未ログイン・Chrome for Testing）では上記5項目を確認できない。**成功扱いにせず、オーナー確認待ちとする**。
