# ChromeBlocker

AliExpress の検索結果から特定ストアの商品を消す Chrome 拡張機能（MV3）。工程正本は Lattice store（`.lattice/todo`、plan `chromeblocker-mvp`）。

## コアプロダクト修理の裁定（オーナー 2026-08-10）

ChromeBlocker 開発中に踏んだコアプロダクト（Lattice・peertable 等）の不具合は、回避せず**本体側で修理する**。本体 clone は本プロジェクトの並列フォルダ（`../Lattice`、`../peertable`）にあり、`.claude/settings.local.json` の `additionalDirectories` で参照可。修理後は `npm install -g <clone>` でこの端末へ適用する。push はオーナーの明示指示時のみ。

## 実地調査で確定した技術事実（2026-08-10）

- 検索カード `a.search-card-item` に storeId は無い。productId→storeId は mtop API `mtop.aliexpress.pdp.pc.query`（署名: md5(`${token}&${t}&${appKey}&${data}`)、token=cookie `_m_h5_tk` 前半、appKey=12574478）で解決する。
- 商品ページの DOM には `a[href*="/store/"]` がある（CSR 描画後のみ。素の fetch はシェル HTML）。
- 詳細は Lattice plan 各 task の設計メモが正本。
