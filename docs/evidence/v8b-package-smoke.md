# v8b-package v2.0.0 配布物 smoke

- 日時: 2026-08-11
- 実測者: codex
- agent-browser: session `v8b-smoke`
- 対象: `dist/chromeblocker-v2.0.0.zip`
- 最終 ZIP: 151,232 bytes
- 最終 ZIP SHA-256: `9949d9bde6665a5c1895ed7be9f7f80d89a881a6a79927590adc0f5c5c4418a8`

## 配布物の隔離ロード

ZIP をソースツリーとは別の一時ディレクトリへ展開し、その展開先だけを
`agent-browser --extension` 相当の `AGENT_BROWSER_EXTENSIONS` で読み込んだ。
Yahoo!ショッピング修正後は browser を閉じ、再生成した ZIP をさらに別のディレクトリ
`/tmp/chromeblocker-v8b-smoke-fixed.17EjA1` へ展開して新規ロードした。

最終ロード結果:

- extension id: `dbbaklnmjienlncakecjlbmanoobaoca`
- name: `Nope — 見たくないもの見せません`
- version: `2.0.0`
- enabled: `true`
- `chrome://extensions` のアイコン実画像: 48×48
- popup: タイトル `Nope`、表示モード・キーワード・キャッシュ操作UIを描画、page errorなし

初回起動は PTY に `DISPLAY` が無く `Missing X server or $DISPLAY` で失敗した。
WSLg の既設 socket（`/tmp/.X11-unix/X0`、`/mnt/wslg/runtime-dir/wayland-0`）を確認し、
`DISPLAY=:0`、`WAYLAND_DISPLAY=wayland-0`、`XDG_RUNTIME_DIR=/mnt/wslg/runtime-dir` を設定して解消した。

## 対象サイトの実測

すべて配布 ZIP の展開物から注入された content script で測定した。表示モードは
`placeholder`。Pattern B はカード上の実ボタンをクリックし、Pattern A/C は popup world の
`chrome.storage` へ現行DOM／実解決結果の sourceId を登録した。

| 面 | 実測結果 | 判定 |
| --- | --- | --- |
| Yahoo News | 50カード、42ボタン。`中日スポーツ` をクリックし placeholder 1、toast、mascot `naturalWidth=240` | PASS |
| Yahoo! JAPAN | 51カード、51ボタン。`産経新聞` をクリックし placeholder 1、toast、mascot 240 | PASS |
| YouTube watch | 20カード、20ボタン。`Liquid Radio` をクリックし placeholder 1、toast、mascot 240 | PASS |
| 楽天市場 | 50カード中45 source解決。`logicool` 登録後、再描画45カード中 placeholder 17、mascot全件240 | PASS |
| YouTube検索 | 10カード10 source解決。`@konekone22` 登録後、再描画19カード中 placeholder 2、mascot全件240 | PASS |
| Yahoo!ショッピング | 修正後392カード中90 source解決。`styleonbag` 登録で placeholder 6、mascot全件240 | PASS |
| ヤフオク | 53カードを実fetchし cache 53件。seller `C7Uj1nCffkSgD1DFsWte2e23RCpTy` 登録で placeholder 3、mascot全件240 | PASS |
| Amazon | 初回56カード中 seller解決cache 8件、個別warn 0、全件不在warn 0。seller `A6A1PMOAKBPGH` 登録後60カード中 placeholder 1、mascot 240 | PASS |
| AliExpress | 30カードを認識し実 mtop を発行したが、全件 `FAIL_SYS_USER_VALIDATE / RGV587_ERROR`。cache 0、placeholder 0 | 外部bot遮断により未成立 |

AliExpress は動作した扱いにしていない。配布物はカード認識・mtop発行・失敗warnまで動作したが、
発信元解決が外部サービスに拒否されたため、指示どおり遮断事実を記録して終了した。

## smoke で検出・修正した不具合

Yahoo!ショッピングの実DOMは
`https://store.shopping.yahoo.co.jp/<storeId>/<item>.html?...` だったが、adapter は
`[href$="/"]` を要求していた。修正前は390カード、ストアリンク180本に対して adapter 一致0本だった。

`src/adapters/yahoo_shopping.js` の selector をストアドメイン前方一致だけに直し、実DOM形式を
fixtureへ固定した。focused test、再pack、新しい隔離展開先からの再ロード、実サイト再smokeまで行った。

## 配布内容とテスト

- `assets/mascot-blocked.png` は ZIP 内に存在し、内外 SHA-256 が一致:
  `026ed70614909e0f88045946b4aba7b5e5e4ddcf890a51ba1b8a28188518cf06`
- `src/adapters/yahoo_shopping.js` の ZIP 内外 SHA-256 が一致:
  `71e3584d020e0f90d4093c13dedc27c534f1543fbffdb7a680367a20e83e2b41`
- ZIP integrity: `unzip -t` — errorなし
- focused: `node --test test/adapters/yahoo_shopping.test.mjs` — 8/8 pass
- 全体: `node --test test/*.test.mjs test/adapters/*.test.mjs` — 178/178 pass
- `git diff --check` — pass
