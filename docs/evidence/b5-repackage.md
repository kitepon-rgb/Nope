# b5-repackage 完了証拠

作業者: mio（b5-repackage worker）  
実施日: 2026-08-11  
対象: ChromeBlocker v1.1.0（配布物 smoke）

---

## 実施内容

### 1. manifest.json バージョン更新

- `"version": "1.0.0"` → `"version": "1.1.0"` へ変更

### 2. pack.mjs の修正（WSL 互換対応）

**問題**: `node scripts/pack.mjs` を WSL bash から実行すると PowerShell の `Compress-Archive` が `/tmp/...` および `/mnt/c/...` の WSL パスを認識できず失敗していた（`ArchiveCmdletPathNotFound`）。

**修正内容**: PowerShell `Compress-Archive` を **Python3 zipfile** へ切り替え。
- ZIP エントリ名をフォワードスラッシュ統一（`assets/mascot-blocked.png` 等）— PowerShell 版はバックスラッシュで保存するため WSL 展開時に平坦ファイル名になる問題を同時解消
- WSL・Windows 両環境で動作（追加依存ゼロ：Python3 は WSL Ubuntu に標準搭載）

### 3. 配布 ZIP 生成

```
dist/chromeblocker-v1.1.0.zip
```

### 4. ZIP 内容確認

```
   72403 assets/mascot-blocked.png   ← 同梱済み ✓
   35269 icons/icon128.png
     290 icons/icon16.png
    6315 icons/icon48.png
    1130 manifest.json
    3130 popup/popup.css
    1362 popup/popup.html
    4093 popup/popup.js
    3603 src/content-item.js
   12394 src/content-search.js
    2985 src/md5.js
    2314 src/mtop-main-relay.js
    6606 src/mtop.js
    3953 src/storage.js
```

`assets/mascot-source.png`（原本、2MB超）は除外されていることを確認 ✓  
エントリ名がフォワードスラッシュであることを確認 ✓

---

## 配布物 smoke（受入条件）

**環境**: ZIP を `/tmp/chromeblocker-smoke-b5/` へ展開し、`agent-browser --session mio --extension /tmp/chromeblocker-smoke-b5` で Chrome for Testing v151 に配布物としてロード。拡張 ID: `oejfaemglbjgllkgnodooaeiocokgcdh`（ソースツリーとは別 ID — 正常）

### ① アイコンが出る

`chrome://extensions` で ChromeBlocker カードにマスコット 48px アイコンが表示されることを確認 ✓

### ② popup がブランド適用後の見た目で開く

`chrome-extension://oejfaemglbjgllkgnodooaeiocokgcdh/popup/popup.html` を開き、以下を確認:
- タイトル「ChromeBlocker」
- 表示モードラジオ（ブロック表示に置き換え / 非表示にして詰める）
- ADD STORE フォーム
- BLOCKED リスト
- キャッシュクリアボタン
- kitepon.dev フッターリンク
- Discovery Orange (#ef8d32) の配色

すべて正常表示 ✓

### ③ 検索ページでマスコット付きプレースホルダーが出る

**注入データ**: storeId `911489458` + productId 5件 → キャッシュ注入（displayMode: placeholder）

**実測結果**:
- `.cb-blocked-placeholder` 件数: **5** ✓
- マスコット画像 URL: `chrome-extension://oejfaemglbjgllkgnodooaeiocokgcdh/assets/mascot-blocked.png` ✓  
  （配布物自身の ID から `assets/mascot-blocked.png` が解決されている = ZIP への同梱が正しく機能している）

**スクリーンショット**: `docs/evidence/b5-smoke-placeholder.png`

---

## 総評

受入条件（①アイコン・②ポップアップブランドUI・③マスコットプレースホルダー）を配布物 smoke で全て実測 PASS。  
`assets/mascot-blocked.png` の同梱が ZIP → 展開 → ロード → ページ内画像解決まで通しで機能することを確認した。
