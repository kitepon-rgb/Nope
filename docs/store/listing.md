# Chrome Web Store 掲載情報（listing）

r6-store-listing の成果物。Chrome Web Store デベロッパーダッシュボードの「Store listing」タブ入力時にこのまま転記できる形でまとめる。r7-submit が実際の入力・提出を行う。

事実確認元: `manifest.json`（permissions・content_scripts）、`src/storage.js`、`src/mtop.js`、`src/mtop-main-relay.js`、`src/content-item.js`、`popup/popup.html`、`docs/evidence/*`、`docs/plan_chromeblocker-release.md`（2026-08-11 時点）。

---

## 製品名・URL

- **製品名**: Nope — 見たくないもの見せません
- **Homepage URL**: https://github.com/kitepon-rgb/Nope
- **Privacy policy URL**: https://github.com/kitepon-rgb/Nope/blob/main/docs/store/privacy.md

---

## Single purpose（単一目的の宣言）

> ユーザーが指定した発信元またはキーワードに基づいて、閲覧中の Web ページから不要なコンテンツを非表示にする。

**日本語（ダッシュボード入力用、そのまま）:**

ユーザーが指定した発信元またはキーワードに基づいて、閲覧中の Web ページから不要なコンテンツを非表示にします。

**この宣言の根拠と実装の現状:**

v1.1.0 時点では AliExpress の特定ストア（発信元）のみ対応。宣言文は意図的に広く定義している——v2 以降でサイト追加・キーワード対応を行う際に「目的が変わった」として審査でリジェクトされないよう、機能追加前から広い定義で出す方針（`docs/roadmap-block-targets.md` 参照）。宣言文は現在の実装を偽るものでなく、この拡張が目指す機能の正確な要約である。

拡張の実装は3つの画面にまたがるが、すべて上記1目的のための手段でしかない。

- `src/content-search.js`（検索結果ページ）: 非表示そのものを実行する中核機能
- `src/content-item.js`（商品ページ）: 「このストアをブロック」ボタン＝非表示対象（ブロックリスト）への追加・解除の入力手段
- `popup/`（拡張アイコンクリック時）: ブロックリストの一覧表示・追加・削除・キャッシュクリア＝非表示対象を管理する手段

---

## Permission justification（権限の正当化）

Chrome Web Store の権限一覧には `manifest.json` の `permissions` と `content_scripts.matches` の両方がホストアクセスとして表示される。実際の `manifest.json`（2026-08-11 時点）は次の通り:

```json
"permissions": ["storage"],
"content_scripts": [
  { "matches": ["*://*.aliexpress.com/*"], "js": ["src/mtop-main-relay.js"], "world": "MAIN", "run_at": "document_start" },
  { "matches": ["*://*.aliexpress.com/*"], "js": ["src/md5.js", "src/storage.js", "src/mtop.js", "src/content-item.js", "src/content-search.js"], "run_at": "document_idle" }
]
```

**注意（食い違いの明記）**: design memo は「host permission `*://*.aliexpress.com/*`」と表現していたが、実際の `manifest.json` に `host_permissions` フィールドは存在しない。`*://*.aliexpress.com/*` は `content_scripts[].matches` としてのみ宣言されている（`host_permissions` の明示追加は t4-mtop で「不要と判明」として見送られた——`docs/evidence/t4-mtop.md` 参照）。Chrome Web Store の権限表示・審査上は `content_scripts.matches` も実質的にホストアクセスとして扱われるため、以下ではこれを「ホストアクセス（content script 経由）」と呼ぶ。

### `storage`

ブロック対象ストアの一覧（`chrome.storage.sync` の `blockedStores`）と表示モード設定（`displayMode`。r1-placeholder で追加、既定値 `placeholder`）を端末間で同期して保持するために必要。加えて productId→storeId の解決結果キャッシュ（`chrome.storage.local` の `productStoreCache`、最大5000件）を保存するために必要。これらはすべて拡張の中核機能（非表示判定の高速化・ブロックリストの永続化）に直結し、他の権限では代替できない。

### ホストアクセス `*://*.aliexpress.com/*`（content script）

以下すべて AliExpress ドメイン上でのみ実行され、他ドメインでは一切動作しない。

- **検索結果ページ**（`content-search.js`）: 商品カード（`a.search-card-item`）の href から productId を読み取り、ブロック対象ストアかどうか判定して非表示にするために必要。
- **商品ページ**（`content-item.js`）: ページ内のストアリンク（`a[href*="/store/"]`）から storeId を取得し、「このストアをブロック」ボタンを注入するために必要。
- **mtop API 中継**（`mtop.js` / `mtop-main-relay.js`）: 検索結果カードの href には storeId が含まれないケースがあるため、productId→storeId の解決に AliExpress 自身の内部 API（`mtop.aliexpress.pdp.pc.query`、エンドポイント `acs.aliexpress.com`）を呼ぶ。**これは AliExpress 自身のエンドポイントであり、拡張の開発者を含むいかなる外部サーバーへも何も送信していない。** ブラウザの CORS 制約を避けるため、`content_scripts[].world:"MAIN"`（Chrome 111+ の正規機能）でページと同じコンテキストから JSONP リクエストを行う設計（`docs/evidence/t4-mtop.md` 参照）。

---

## Privacy declaration（プライバシー申告、要約）

詳細は `docs/store/privacy.md`（公開URL: https://github.com/kitepon-rgb/Nope/blob/main/docs/store/privacy.md）。ダッシュボードの **Privacy practices** タブでの申告方針:

- **Data collection**: 拡張の開発者・提供者は、いかなるユーザーデータも収集・受信しない（送信先はすべてブラウザローカルの `chrome.storage`、またはユーザー自身が閲覧中の AliExpress 自身のドメインのみ）。
- **Data usage 該当なし**: Personally identifiable info / Health info / Financial and payment info / Authentication info / Personal communications / Location / Web history / User activity のいずれについても「収集して外部（開発者・第三者）へ送信する」に該当する項目はない。
- **Certify compliance**: Developer Program Policies への準拠を宣言する（該当時にチェック）。

---

## Description（説明文）

### 短い説明（Short description、132文字以内。実測90文字）

> 閲覧中のWebページから、指定した発信元のコンテンツを非表示にするブロッカー。現在はAliExpressの特定ストアに対応。ポップアップでブロック対象の一覧・追加・解除ができます。

### 詳細説明（Detailed description）

> 閲覧中のWebページから、指定した発信元のコンテンツを非表示にするブロッカー拡張機能です。現在はAliExpress（aliexpress.com）の特定ストアに対応しています。
>
> **できること**
> - 商品ページの「このストアをブロック」ボタンから、そのストアをワンクリックでブロックリストに追加
> - 以後、検索結果に表示されるそのストアの商品を自動的に非表示（ブロックリストの変更はページの再読み込みなしで即座に反映）
> - 拡張アイコンのポップアップから、ブロック中のストア一覧の確認・ストアURL/IDでの直接追加・削除・解除がいつでも可能
> - ブロック済み商品の表示方法は、控えめなプレースホルダー表示／完全に非表示にして詰める、の2モードから選択可能
>
> **データの扱い**
> - 収集するデータはありません。外部サーバーへの送信も一切ありません
> - ブロックリストはお使いの Google アカウントで端末間同期されます（`chrome.storage.sync`）
> - 商品とストアの対応キャッシュはこの端末内にのみ保存されます（`chrome.storage.local`）
> - 詳しくはプライバシーポリシーをご覧ください
>
> **対応サイト**
> - AliExpress（`aliexpress.com`）の検索結果ページ・商品ページのみで動作します

**誇大表現・煽り文言の排除について**: 拡張内部の UI（トースト通知等、`src/content-item.js`）には煽情的な文言はない（「〇〇をブロックしました」「〇〇のブロックを解除しました」という淡々とした通知のみ）。

---

## Category / Language（カテゴリ・言語）

- **Category**: Shopping（買い物体験を調整する拡張のため。次点候補は Productivity だが、AliExpress という特定ショッピングサイト専用機能なので Shopping が適切）
- **Language**: 日本語（ja）のみ。`popup/popup.html` は `lang="ja"`、拡張内メッセージもすべて日本語。多言語対応は未実装のため、英語等での申請はしない

---

## Screenshots（掲載順とキャプション）

撮影は r2-placeholder-verify が実施済み（2026-08-10、kotoha実測、`docs/evidence/r2-placeholder-verify.md` 参照）。実測の結果、当初案の1番「ブロック済み商品が消えている」は r1 導入後の**既定挙動と食い違う**と判明したため、掲載順・キャプションをここで実態に合わせて修正した——r1 完了後の既定表示モードは `placeholder`（プレースホルダー表示）であり、商品が「消える」のは `collapse` モードに切替た場合のみ。誤って「既定で商品が消える」と説明すると審査・ユーザー双方に誤解を与えるため、1番をプレースホルダー表示に差し替え、collapseモードは別項目（4番）として独立させた。

| # | シーン | 画像ファイル | キャプション（日本語） |
|---|--------|--------------|------------------------|
| 1 | 検索結果ページ：ブロック済みストアの商品がマスコットプレースホルダーに置き換わっている（既定表示） | `docs/evidence/ac3-placeholder.png`（b4-verify、2026-08-10実測） | ブロックしたストアの商品は、控えめなマスコットプレースホルダーに自動的に置き換わります |
| 2 | 商品ページ：「このストアをブロック」ボタン | `docs/evidence/t3-button-injected.png` / `t3-blocked.png`（1280x800での撮り直しが望ましい。b4-verify 対象外のため未更新） | 商品ページの「このストアをブロック」ボタンでワンクリック登録 |
| 3 | ポップアップ：ブロック中ストア一覧・表示モード切替UI・kitepon.devブランド適用済み | `docs/evidence/ac2-popup.png`（b4-verify、2026-08-10実測） | ポップアップでブロック中のストアを確認・削除、表示モードもいつでも切替できます |
| 4 | 完全非表示（collapse）モードに切替後の検索結果（後続カードが前へ詰まる） | `docs/evidence/ac5-collapse.png`（b4-verify、2026-08-10実測） | 完全に消して空間を詰める表示にも切替可能です |
| 5 | 参考：ブロック前の通常の検索結果（Before比較用） | `docs/evidence/ac3-unblock.png`（b4-verify、2026-08-10実測。ブロック解除後の通常表示） | （通常の検索結果。1・4との対比用。5枚目として掲載するか、1枚目の前段として使うかは掲載時に判断） |

**掲載方針**: 1枚目は必ず「プレースホルダー表示」という中核体験（既定の見た目）を見せる。2・3枚目で操作方法（ブロックの追加・管理）を示す。4枚目でcollapseモードという追加の柔軟性を見せる。5枚目（Before）は任意——入れる場合は1枚目の前に置いて「導入前後の比較」として見せる構成が分かりやすいが、最終順序の決定はストア掲載時（r7）の裁量とする。1〜4のみでも提出可能な構成として扱ってよい。

**b4-verify（2026-08-10）での更新内容**: r2-verify 時点の旧スクリーンショット（r2-placeholder-visible.png 等）を b4-verify で撮影した kitepon.dev ブランド適用後の新画像（ac3-placeholder.png / ac2-popup.png / ac5-collapse.png）に差し替えた。商品ページボタン（2番）は b4-verify の対象外のため未更新。

**画像サイズについて**: agent-browser デフォルト（1280px 幅 viewport 相当）で撮影済み。popup（3番）は popup ウィンドウの自然なサイズでのクローズアップ。ストア提出時に1280x800キャンバスへの配置編集が要るかは r7-submit で判断すること。
