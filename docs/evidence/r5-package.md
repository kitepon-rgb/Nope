# r5-package 完了証拠（2026-08-10）

## 実施

- `scripts/pack.mjs`（新規）: 配布用 ZIP を生成する。追加依存ゼロ（Node標準ライブラリ + Windows PowerShell 標準搭載の `Compress-Archive`）。
  - 同梱: `manifest.json` `src/` `popup/` `icons/` のみ。一時ステージングディレクトリへ `cpSync` でコピーしてから `Compress-Archive -Path <staging>/*` で固めることで、ZIPのルート直下に `manifest.json` が来る構造にした（ステージングディレクトリ自体はZIP内に現れない）。
  - 出力先: 引数省略時は `dist/chromeblocker-v<manifest.jsonのversion>.zip`（現在は `dist/chromeblocker-v1.0.0.zip`）。引数でパス指定も可能（動作確認済み）。
  - `dist/` は `.gitignore` に登録済み（bellが代行で追加、commit `d1a3567`）。

## ZIP構造確認

`python3 -c "import zipfile; ..."` で生成したZIPの内部エントリを列挙し、以下のみが含まれることを確認（`.lattice/` `.team/` `.claude/` `docs/` `test/` `.codex-sidecar.yml` `.gitignore` `README.md` `LICENSE` は含まれない）:

```
icons/icon128.png
icons/icon16.png
icons/icon48.png
manifest.json
popup/popup.css
popup/popup.html
popup/popup.js
src/content-item.js
src/content-search.js
src/md5.js
src/mtop-main-relay.js
src/mtop.js
src/storage.js
```

## 配布物 smoke（agent-browserセッション分離で実測）

design_memoどおり「ソースツリーで動くことは配布物が動く証拠にならない」を踏まえ、ZIPを別ディレクトリ（scratchpad配下）へ展開し、その展開先を拡張として実ロードして検証した。

### セッション分離（円卓の資産として記録）

kotoha が r2-placeholder-verify で agent-browser の default セッションを使用中だったため、bellの提案で `agent-browser --session <name> ...` によるセッション分離を試した。

- **訂正**: bellの提案文面は `--session-name <name>` だったが、`agent-browser --help` を実読すると `--session-name` は「Cookie/localStorageの永続化名（Auto-save/restore state persistence name）」であり、ブラウザインスタンス自体を分離する「Isolated session」は別オプションの `--session <name>`（Global Options内）だった。実際のツール仕様に従い `--session r5smoke` を使った。
- `agent-browser --session r5smoke --extension "<ZIP展開先>" open "chrome://extensions"` で新規セッションを起動した直後、`agent-browser session list` から `default` が消えて `r5smoke` のみになり懸念したが、room ログ確認の結果、これは私の操作より**前**に kotoha 自身が r2 実測完了後に `close --all` を実行していたためと判明（seq66-67）。私のセッション分離操作がkotohaの作業を壊した事実はない。
- 結論: **`agent-browser --session <name>` によるセッション分離は有効**。同一マシン上で複数のagent-browserセッションを並行して独立に保持できることを確認した（今回は前後関係のため同時実行そのものは実証できていないが、`session list`が名前ごとに独立管理されている挙動と、closeが `--session` 指定なしの `--all` でない限り他セッションに影響しない挙動は確認できた）。以後の円卓でagent-browserの取り合いが発生したら `--session <名前>` で分離できる可能性が高い。
- `close --all` は一度も実行していない。片付けは `agent-browser --session r5smoke close`（`--all`なし）のみ。

### 実測内容

拡張ID: `ghckdpfljalbbbjenhkbphpceinjcokd`（ZIP展開先を `--extension` でロードして取得）。

1. **①popupが開く**: `chrome-extension://ghckdpfljalbbbjenhkbphpceinjcokd/popup/popup.html` を直接開き、タイトル「ChromeBlocker」・表示モード切替ラジオ・URL/名前入力欄・追加ボタン・一覧・キャッシュクリアボタンが全て正しくレンダリングされることをスナップショットで確認。フォーム入力→追加ボタンクリックでブラックリストへの追加もpopup.js経由で正常動作することを確認（後述の②とあわせて実測）。
2. **②検索ページでブロックが効く**: `https://ja.aliexpress.com/w/wholesale-makeup.html` を開いたところ、mtop解決が `FAIL_SYS_USER_VALIDATE`（AliExpress側のbot対策/recaptcha punish、AGENTS.mdに既知の事象として記載済み）で失敗していることを実際のレスポンス本体（`{"ret":["FAIL_SYS_USER_VALIDATE","RGV587_ERROR::SM::..."],...}`）で確認した。これは `mtop.js`/`content-search.js` の「解決失敗時は静かにフォールバックせずcache未保存のまま表示継続、console.warn」という設計どおりの正しい挙動であり、プロダクションコードの不具合ではない（mtop解決自体の実測はt4/t5で別途完了済み）。r5の本質（配布ZIPのファイル構成・パス解決に欠落がないか）を検証するため、cache経由の確定パスで確認した:
   - popupのUIでブラックリストへ storeId `9999999901`（テスト用）を追加。
   - popupのJSコンソール（`chrome.storage.local.set`）で対象productId(`1005008430046420`、検索ページに実在するカード)のキャッシュへ手動で `productStoreCache['1005008430046420'] = '9999999901'` をセット。
   - 検索ページをリロード → 起動時 `scan()` がcache命中し、対象カードの外側wrapperへプレースホルダー（禁止マーク+あっかんべー猫SVG、ストア名「r5smokeテスト用ストア」、ブロック解除ボタン）が正しく挿入されることを確認（`hasPlaceholder: true`）。他カードは通常表示のまま誤爆なし。スクリーンショット: `r5-smoke-blocked.png`。
   - popupの「削除」ボタンでブラックリストから除去 → **検索ページをリロードせずに** `onBlockedStoresChanged` 経由で即座にプレースホルダーが除去され元のカード表示へ復元されることを確認（`hasPlaceholder: false`）。スクリーンショット: `r5-smoke-restored.png`。
   - これにより配布ZIP内の `manifest.json`（content_scripts定義）/`src/storage.js`/`src/content-search.js`/`popup/popup.js` が相対パスも含めて正しく連携動作することを実測した。
3. **③アイコンが出る**: `chrome://extensions` でZIP展開先の拡張カードにアイコン（禁止マーク+猫）が正しく表示され、拡張が有効であることを確認。スクリーンショット: `r5-smoke-extensions.png`。

## 仕様からの逸脱・補足判断

- bellの提案文面にあった `--session-name` は実際にはcookie/localStorage永続化用オプションであり、ブラウザインスタンス分離には `--session` を使うのが正しいと判明したため、そちらを使用した（実装前にヘルプを実読して確認）。
- mtop解決自体の実測（bot対策の影響を受けない範囲）はt4/t5で完了済みのため、r5では「配布ZIPのファイル構成・相対パス解決に欠落がないか」を検証する目的でcache経由の確定パスを使った。mtop通信そのものが配布物特有の問題ではないことは、ソースツリー実行でも同じ `FAIL_SYS_USER_VALIDATE` が発生する外部要因（AliExpress側のbot対策）であることから明らか。
- `manifest.json` は r3 が追加した内容をそのまま使用し、変更していない。

## 結論

design_memoの受入条件（`scripts/pack.mjs` によるZIP生成、対象4種類のみ同梱・ルート直下にmanifest.json、配布物smoke=別ディレクトリへ展開してagent-browserでpopup/ブロック/アイコンを実測）を全て満たした。done とする。
