# t4-mtop 完了証拠（2026-08-10）

## 実施

- `src/mtop.js`: 署名生成（既存）に加え、`extractStoreId`（`data.result.SHOP_CARD_PC.sellerInfo.storeNum` を返す。`GLOBAL_DATA.globalData.storeId` 等の別系統IDは使わない）、`isTokenError`（TOKEN_EXPIRED/TOKEN_EMPTY 検知）、`resolveStoreId`（productStoreCache 優先→無ければ mtop 実行→cache保存、TOKEN_EXPIRED/TOKEN_EMPTY 時は1回だけリトライ、失敗は throw）を実装。
- `src/mtop-main-relay.js`（新規）: JSONP の実行本体。manifest の `content_scripts[].world:"MAIN"`（Chrome 111+）で宣言し、真の main world スクリプトとして動く。isolated world の `mtop.js` とは `document` への CustomEvent（`cb-mtop-request` / `cb-mtop-response`、detail は JSON文字列）でのみやり取りする。
- `manifest.json`: content_scripts に world:"MAIN" のエントリを追加（`src/mtop-main-relay.js`、`run_at: document_start`）。host_permissions は追加していない（不要と判明・後述）。

## 設計変更の経緯（実測で覆った当初案）

当初は「isolated world の content script が `document.createElement('script')` で `<script>` を作り、main world へ注入する」という一般的な JSONP 実行テクニックを踏襲する予定だった（bell の 2026-08-10 17:10-17:15 実測でこの経路の有効性が示唆されていた）。

しかし実際に content script（isolated world）経由で実装して agent-browser 実測したところ、**inline スクリプトも `src` 付きスクリプトも、同一originか別originかを問わず一切実行/読込されない**ことが判明した（DOM 接続は正常: `isConnected`/`parentNode`/`instanceof HTMLScriptElement` すべて true、`securitypolicyviolation` イベントも発火せず、console にもエラーが出ない——ただし onerror のみ発火）。host_permissions を `acs.aliexpress.com` および `*://*.aliexpress.com/*` に広げても変化なし。

再調査の結果、bell の「成功」は agent-browser の `eval`（= main world 直接実行、ページ自身のスクリプトとして動く）経由であり、拡張の content script（isolated world）からの経路は当時まだ検証されていなかったと判明した。

正しい解決策として、Chrome 111+ の manifest 機能 `content_scripts[].world:"MAIN"` で中継専用スクリプト（`src/mtop-main-relay.js`）を宣言し、真の main world コードとして JSONP を実行する設計に変更した。isolated world 側は CustomEvent でリクエストを投げてレスポンスを待つだけにした。

## unit test

`node --test test/*.test.mjs` — 33/33 green（`test/mtop.test.mjs` 9件: 署名生成・JSONP剥がし・`extractStoreId`（正/罠フィールド排除/欠落）・`isTokenError`）。

`resolveStoreId`/`fetchViaJsonp`・`mtop-main-relay.js` の DOM 実行系は node vm では論理を過剰に模擬するだけで実測にならないため unit test 対象外とし、下記の実ブラウザ実測で検証した。

## 実ブラウザ検証（sumire実測、2026-08-10）

agent-browser 隔離ブラウザに拡張ロード（`--headed --extension "C:/Users/kite_/Documents/Program/ChromeBlocker"`）、実在商品ページ `https://ja.aliexpress.com/item/1005009468037554.html` で以下を確認:

1. 拡張の実際の content script 経路（isolated world → main world 中継、テスト用の一時的な CustomEvent ブリッジを content-item.js に仮設し、確認後に削除）で `CB_MTOP.resolveStoreId('1005009468037554', {useCache:false})` を呼び出し、`{"ok":true,"storeId":"1104977015"}` を取得。DOM の `a[href*="/store/"]`（bell実測の同一商品ページ）と一致する正しい storeId。スクリーンショット: `t4-resolve-success.png`。
2. `agent-browser network requests` で実際に `acs.aliexpress.com/h5/mtop.aliexpress.pdp.pc.query/1.0/` への GET リクエストが発生していることを確認（main world relay 経由で本物の JSONP リクエストが飛んでいる証跡）。
3. host_permissions なしでも成功（`content_scripts[].world:"MAIN"` は main world の通常のページスクリプトと同じ扱いになるため、拡張の host_permissions は不要だった）。
4. ボタン注入（t3機能）が world:"MAIN" エントリ追加後も引き続き正常動作することを確認（`.cb-block-button` 1個検出）。

## 結論

設計メモの受入条件（署名付き mtop 呼び出し・storeId 解決・失敗時 throw・cache 接続）を満たし、実際の拡張 content script 経路で `resolveStoreId` が正しい storeId を返すことを実測確認した。当初設計（isolated world から直接 DOM 注入）は実機で機能しないと判明したため、MV3 正規機能である `world:"MAIN"` 中継スクリプトへ設計変更した。unit test・実ブラウザ検証ともに合格。done とする。
