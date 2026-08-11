# nope-v2 終端監査

- 日時: 2026-08-11
- 監査者: bell
- 対象: plan `nope-v2`（v1-architecture 〜 v8b-package の全 11 ToDo が done）

## 結論

**配布物として成立している。** v2.0.0 の ZIP を隔離環境へ展開して実ロードし、
対象8面でブロックが成立することを実測した（`docs/evidence/v8b-package-smoke.md`）。

ただし監査として**重大な所見が1つある**（次節）。これは今回の成果を否定するものではないが、
同じ工程を繰り返せば同じ穴に落ちる。

## 所見: done の判定が実物検証を伴っていなかった ToDo がある

v7 系の検証と配布物 smoke で、**すでに done になっていた ToDo の成果が実ブラウザで
動いていなかった**ことが4件発覚した。いずれも fixture ベースのテストは green だった。

| 発覚した不具合 | 影響 | 由来する ToDo |
| --- | --- | --- |
| `content-search.js` が全 adapter を `async_resolve` 扱いし `CB_MTOP` を無条件参照 | 楽天・Yahoo!ショッピング・YouTube検索が**カード処理前に `CB_MTOP is not defined` で全滅** | v3-adapter-id |
| Yahoo!ショッピングの selector が `[href$="/"]` を要求 | 実 DOM は `/{storeId}/{item}.html` のため**ストアリンク180本に対し一致0本** | v3-adapter-id |
| YouTube watch が `span.ytAttributedStringHost` の index 0 を取得 | 発信元名として**動画タイトルを返していた** | v4-adapter-name |
| Amazon の `resolveSource` が seller 不在で例外 | 検索結果の**78%が warn を出し、本物の失敗が埋もれる** | v5-adapter-resolve |
| 共通エンジン末尾の `CB_SEARCH.init().start()` | 他サイトの entry でも AliExpress 既定 adapter が起動（二重起動） | v2-refactor |

**共通する原因は「fixture が実 DOM と違っていた」ことである。** fixture は実装者が書くので、
実 DOM を誤解していれば fixture も同じ誤解を含む。テストは通るが実物は動かない。

v8b の設計メモが書いていた「**ソースツリーで動くことは配布物が動く証拠にならない**」は、
配布物に限らず**アダプタ実装そのものに当てはまる**。

## 検収の範囲（誰が何を実物で確認したか）

**bell が今日実物で検収した**もの:

- v7c-verify-resolve — ヤフオク・Amazon を実ブラウザで検証（`v7c-verify-resolve.md`）
- v8a-manifest — テスト 171/171 と adapter の `resolver.type` 宣言を全件確認
- v8b-package — テスト 178/178 を fail 0 で実測、ZIP 内外の SHA-256 一致を確認
- 上記の過程で見つかった不具合修正 5 件（二重起動・dom_id 型不一致・YouTube watch 名・
  Amazon seller 不在・Yahoo!ショッピング selector）を、diff・テスト・実ブラウザで検収

**bell が実物再検証していない**もの:

- v1-architecture、v2-refactor、v3-adapter-id、v4-adapter-name、v5-adapter-resolve、
  v6-popup、v7a-verify-id、v7b-verify-name
  → 前セッションの worker が done にしたもので、evidence 文書の存在は確認したが、
    bell 自身が実物を再検証してはいない。**上表の不具合はここから出た。**

## 未解決・未検証（配布前に把握しておくべきもの）

1. **AliExpress は未成立。** 配布物はカード認識・mtop 発行・失敗 warn まで動くが、
   発信元解決が `FAIL_SYS_USER_VALIDATE / RGV587_ERROR` で外部拒否される。
   自動化ブラウザからの実測なので、実ユーザーの通常セッションで同じ壁に当たるかは**未確認**。
2. **popup の `nameOnly: true` エントリへの警告表示が未実装。** 設計文書 `design-site-adapter.md:373`
   が求めている（名前ベースブロックは改名・同名別チャンネルのリスクがある）。今回スコープ外とした。
3. **即時反映（`onBlockedSourcesChanged`）が未検証。** タブ1枚では検証できないため実施していない。
4. **解除ボタン経由の復元**は Yahoo News で確認済みだが、他面では未実施。

## 監査の判定

`gate_ready` → **review 通過とする。**

配布物としての受入条件（隔離ロード・アイコン・popup・対象サイトのブロック）は実測で満たされている。
上記の未解決事項はいずれも既知として記録されており、隠されていない。

**ただし次の plan では、adapter の done 判定に実ブラウザ実測を含めること。**
fixture green だけで done にした結果、5件の不具合が終盤まで残った。
