# chromeblocker-brand terminal-audit 受入監査（2026-08-11 統括bell）

## 判断

**accept**。b1〜b5 すべて done で、ブランド適用は実ブラウザと配布物の双方で実測されている。

## 監査内容（bell が実物で確認した項目）

- **配布 ZIP の中身**: `dist/chromeblocker-v1.1.0.zip` を展開して列挙。`manifest.json` がルート直下、`assets/mascot-blocked.png`（72,403B）が同梱され、2MB 超の原本 `assets/mascot-source.png` は除外されている。`.lattice/` `.team/` `docs/` `test/` も入っていない。
- **version**: `manifest.json` は `1.1.0`。ZIP のファイル名と一致。
- **テスト**: `node --test test/*.test.mjs` を bell が再実行し **61/61 green**。
- **b4 の受入**: 5条件すべて PASS。特に「非表示にして詰める」で後続カードが最大 **768px** 前方シフト（1681 → 913）することを `getBoundingClientRect` の数値で記録。解除ボタンで `href` が変化しない（親リンクへ遷移しない）ことも確認済み。
- **配布物 smoke**: ZIP 展開先を `--extension` でロードし、マスコット画像が **配布物自身の拡張 ID** で解決されることを確認（`chrome-extension://oejfaemglbjgllkgnodooaeiocokgcdh/assets/mascot-blocked.png`）。ソースツリーではなく出荷物で動くことの証拠になっている。

## この工程で塞いだ穴

1. **`web_accessible_resources` の未登録**: MV3 では content script から `chrome.runtime.getURL()` で参照する画像を登録しないと読めない。sumire が「未登録だと `chrome-extension://invalid/` でブロックされる」ことを実機で実証し、b1 で `matches` を `*://*.aliexpress.com/*` に限定して登録した（`<all_urls>` は fingerprinting の的になり審査でも権限過剰として刺さる）。
2. **`pack.mjs` の同梱漏れ**: `assets/` が同梱対象に入っておらず、そのままなら「ソースツリーでは動くのに install すると画像だけ出ない」事故になっていた。hiyori が自分の担当外と知りつつ申し送り、本人が塞いだ。
3. **`pack.mjs` の WSL 非互換**: PowerShell の `Compress-Archive` に依存していたため、WSL 上の席では `tmpdir()` が `/tmp` を返して失敗した。mio が Python の `zipfile` へ切り替え、ZIP エントリ名をフォワードスラッシュに統一（展開時のディレクトリ構造が正しくなる）。
4. **リポジトリ汚染**: ルート直下に画面キャプチャ 36 枚（約 83MB、オーナーのデスクトップ全体が写ったもの）が未追跡で溜まっていた。hiyori が担当外として記録し、bell が `.gitignore` へ追加した上で削除。**git 管理下に入る前に処理したため公開はされていない**。

## 残っている外部依存

`chromeblocker-release` の r7-submit（ストア提出）。オーナーによる Chrome Web Store デベロッパー登録と $5 の支払いが前提で、エージェントは代行しない。
