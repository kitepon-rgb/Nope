# r4-github 完了証拠（2026-08-10）

## 実施

- `gh repo create ChromeBlocker --public --source=. --remote=origin` でリポジトリを作成し、`origin` remote を追加した。
- README.md を新規作成: 機能概要（商品ページのブロックボタン・検索結果の自動非表示・ブラックリスト管理画面）、スクリーンショット3枚（`docs/evidence/t7-item-blocked.png` `docs/evidence/t6-popup-added.png` `docs/evidence/t7-search-hidden.png`）、導入手順（現時点は Load unpacked、ストア公開後にリンク追記する旨を明記）、プライバシー記述、技術メモ（Manifest V3、mtop API での storeId 解決、`world:"MAIN"` 中継スクリプトでの isolated↔main world 連携）、開発・テスト手順、ライセンスへのリンクを記載。
- LICENSE を新規作成（MIT、copyright holder: kitepon-rgb, 2026）。
- `.gitignore` を新規作成: `node_modules/` に加え、円卓運営専用のツール設定（`.claude/` `.codex-sidecar.yml` `.team/` `.mcp.json`）を除外。`.lattice/` は工程正本のため除外していない。

## プライバシー記述の正確性について

依頼の定型文言「外部サーバーへの送信なし」をそのまま書くと、mtop API（`acs.aliexpress.com`、AliExpress 自身のドメイン）への通信が実在する事実と整合しないため、README では「拡張独自の外部（第三者）サーバーへの送信は一切ない」「通信は AliExpress 自身の API への通信のみ」と、技術的に正確な表現に調整した。保存先が `chrome.storage.sync`（ブラックリスト）/`chrome.storage.local`（productId→storeId キャッシュ）のみである点は依頼どおり。

## 秘密情報チェック

- `git grep -i "token|secret|password" -- . ':!docs' ':!.lattice'` を実行し、ヒットは全て AliExpress mtop API の cookie トークン処理コード（`src/mtop.js` 等、appKey=12574478 含め既に `CLAUDE.md` に記載済みの公開情報）のみであることを確認。実際のトークン値・APIキー・パスワードの類の混入なし。
- `.mcp.json`（peertable-client 起動設定のみ、値なし）、`.codex-sidecar.yml`（パス許可リストのみ）、`.team/setup-state.json`・`.team/project.json.bak`（room の URL・plan key のみ。LAN 内アドレスを含むが認証情報なし）の中身を個別に確認し、いずれも秘密情報を含まないことを確認した上で、運用専用ツールとして `.gitignore` へ除外した（README/LICENSE/.gitignore の担当範囲内の判断）。
- `peertable.env` の `PEERTABLE_POST_TOKEN` の値そのものは repo 内のどのファイルにも書き込んでいない。

## commit・push

- commit `0e1c273`（`docs: README/LICENSE/.gitignore を整備(r4-github)`、pathspec明示: `README.md LICENSE .gitignore` のみ）
- push 先: `https://github.com/kitepon-rgb/ChromeBlocker`（public、default branch: `main`）
- push 時点で main には他席（sumire/hiyori/kotoha 分含む）のコミットも既に混在していたが、design_memo・room裁定どおり許容される状態のため、そのまま push した。

## 結論

設計メモの受入条件（`gh repo create --public` での作成・remote追加・push、README の機能/スクリーンショット/導入手順/プライバシー/ライセンス、`.gitignore` の作業用ディレクトリ除外・`.lattice/` 非除外）を全て満たし、GitHub 上での README レンダリング（画像3枚含む）を実ブラウザで確認した。done とする。
