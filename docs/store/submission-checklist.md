# Chrome Web Store 提出チェックリスト（r7-submit 用）

r6-store-listing の成果物その3。r7-submit がこのチェックリストに沿って提出作業を行う想定。判断が必要な箇所は「要判断」と明記した。

## 前提（r7 着手前に揃っているべきもの）

- [ ] r2-placeholder-verify 完了（`docs/store/listing.md` のスクリーンショット表 4・5 が撮影済みになっている）
- [ ] r3-icons 完了（`manifest.json` に `icons`（16/48/128px）があり、`version` が `2.0.1` になっている）
- [ ] r4-github 完了（public repo 作成・push 済み。README にプライバシーポリシーへのリンクがある）
- [ ] v8-package 完了（配布用 ZIP が生成済み。同梱物は `manifest.json` / `src/` / `popup/` / `icons/` / `assets/mascot-blocked.png` のみで `.lattice/` `.team/` `docs/` `test/` は含まれないこと。Load unpacked での配布物 smoke 済み）
- [ ] オーナーによる Chrome Web Store デベロッパー登録・$5 登録料の支払いが完了している（design memo・plan 上、オーナー実施と明記）

## 提出前の最終整合確認

- [ ] `manifest.json` の `version` と、アップロードする ZIP 内の `manifest.json` の `version` が一致している
- [ ] `permissions` が `["storage"]` のみであること（増えていたら `docs/store/listing.md` の Permission justification を更新してから提出する）
- [ ] `content_scripts[].matches` が `docs/store/listing.md` の v2.0.1 manifest 抜粋と一致すること（対象ドメインが増減していたら listing.md / privacy.md を更新してから提出する）
- [ ] `docs/store/listing.md` の Single purpose・説明文・スクリーンショット表が最新の実装と食い違っていないか目視確認

## Store listing タブ入力

`docs/store/listing.md` の内容をそのまま転記する。

- [ ] Single purpose description
- [ ] Category: Tools
- [ ] Language: 日本語（ja）
- [ ] Short description（132文字制限内。`manifest.json` の `description` と同一文面）
- [ ] Detailed description
- [ ] Screenshots（1280x800、`docs/store/listing.md` の表の順序でアップロード。最低1枚必須、複数枚推奨）
- [ ] Icon（128px、r3-icons の成果物）
- [ ] Homepage URL: r4-github で作成した public repo の URL（要判断: repo の README URL でよいか、GitHub Pages 等の専用ページを別途用意するか。現時点では repo URL で足りると判断。専用ページが要る場合はここへ追記する）

## Privacy practices タブ入力

`docs/store/privacy.md` の「Chrome Web Store『Privacy practices』タブでの申告方針」節の通りに入力する。

- [ ] Single purpose（listing.md と同一文面）
- [ ] Permission justification（`storage` / `content_scripts[].matches` に宣言した全ホストそれぞれ）
- [ ] Data usage 各項目: すべて「該当なし」で申告
- [ ] "Does not collect user data" の立場で申告
- [ ] Certify compliance にチェック
- [ ] プライバシーポリシー URL: push 済み repo 内 `docs/store/privacy.md` の GitHub 上の表示URL（raw ではなく blob 表示のURLを推奨。要判断: README からのリンクと同一URLにするか確認）

## Distribution（公開範囲）設定

- [ ] Visibility: **Unlisted**（オーナー裁定 2026-08-10、`docs/plan_chromeblocker-release.md` 参照。検索に載らずリンク限定になることを提出時に再確認する）
- [ ] ZIP アップロード: `node scripts/pack.mjs`が生成した`dist/nope-v2.0.1.zip`（Load unpacked smoke 済みのもの）

## 提出後

- [ ] 審査ステータスの確認（Chrome Web Store は審査に数日〜数週間かかることがある。P0 ではなく通常の外部完了待ちとして扱う）
- [ ] 審査通過後、Mac へストア経由でインストールし、以下の smoke を実施:
  - [ ] 7サービス群・8対応面の対象ページで、ブロック対象の発信元がプレースホルダーへ置換される
  - [ ] AliExpress 商品ページの「このストアをブロック」ボタンが動作する
  - [ ] Yahoo ニュース / Yahoo! JAPAN でキーワードブロックが動作する
  - [ ] ポップアップでサイト別ブロックリストとキーワードの一覧・追加・削除ができる
  - [ ] 表示モード切替（プレースホルダー / 完全非表示）が動作する
- [ ] smoke 結果を evidence として記録し、`lattice todo done --plan chromeblocker-release --task r7-submit` で完了報告する

## 審査で刺さりやすい点（r6 時点での自己評価、要注意）

- **同一サイトへの発信元解決通信**: AliExpress の内部APIに加え、ヤフオクの商品詳細ページ、Amazon.co.jp の商品詳細ページを取得する。送信先・識別子・キャッシュ先を `privacy.md` / `listing.md` の Permission justification と食い違わせないこと。
- **`content_scripts[].world:"MAIN"` の使用**: 比較的新しい機能（Chrome 111+）で、審査員によっては「main world で何をしているか」を個別に見られる可能性がある。`mtop-main-relay.js` は JSONP 実行の中継のみで、DOM 改変や外部送信は行っていないことを説明できるようにしておく。
- **`host_permissions` フィールドが無いこと**: design memo は「host permission」と表現していたが、実装は `content_scripts.matches` のみで `host_permissions` は宣言していない（`listing.md` に食い違いとして明記済み）。ダッシュボードの権限一覧でどちらの扱いで表示されるかは r7 提出時に実物のダッシュボード画面で確認すること（要判断: 表示のされ方次第で説明文の言い回しを微調整する必要が出るかもしれない）。
