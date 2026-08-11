# YouTube推薦面 再梱包・実Chrome受入smoke（yt-package-smoke）

検証日: 2026-08-11 / 担当: kotone

**この証跡は2回のsmokeを記録する。** 1回目(commit 7f05ee4時点)でChrome for Testing実ロード中に
登録ボタンのtextContent欠落を発見しmashiroへ報告([69])、bell裁定[70]によりmashiroの修正commit
7e70a24を経て2回目の再梱包・再smokeを実施し確定させた。以下は最終(2回目・確定)の結果。

## 自動検証（最終・commit 7e70a24時点）

### 全テスト実行

```
node --test 'test/**/*.test.mjs'
```

結果: **197件 pass / 0 fail**（既存回帰なし。登録ボタンtextContent修正の回帰防止アサーション含む）。

### 再梱包

```
node scripts/pack.mjs
```

- 出力: `dist/chromeblocker-v2.0.0.zip`
- SHA-256: `21f0398ef910eb0df205c919027a2c18c6c2779d56925bc3b64f1608694763bf`（commit 7e70a24時点。1回目smoke時のSHA-256 `1afd7e90...` は修正前のビルドであり無効）

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

### 1回目smokeで発見・解消済みの欠陥

`content-search.js`の`ensureRegisterButton`に`button.textContent`を設定するコードが無く、登録ボタンが実ページで**常に空欄表示**になっていた（`title`/`aria-label`は設定済み）。`docs/design-youtube-surfaces.md` §3-3の契約に反する欠陥として[69]で報告、bell裁定[70]「修正必須」を経てmashiroがcommit 7e70a24で修正。回帰防止テスト・自分の再監査(defect-free[74])・本smokeでの実表示確認の3点で解消を確認済み。

## オーナー実Chrome受入（H）— 未実施

ログイン済みYouTubeでの以下5項目は、自動化ブラウザ（未ログイン・Chrome for Testing）では実施できない。**成功扱いにせず、オーナー確認待ちとする**:

1. ホームの登録、ブロック、高さ維持、解除
2. 検索の登録、ブロック、解除
3. ホームと検索をまたぐ共有リスト
4. SPA遷移と追加カードへの追従
5. 視聴ページ関連動画にNopeのUIもフィルタも無い（自動検証で未ログイン状態は確認済み。ログイン状態での再確認はオーナー実施分）

登録ボタンの表示テキスト欠落は自動検証段階で解消済みのため、H条件1・2の確認はブロックされない。
