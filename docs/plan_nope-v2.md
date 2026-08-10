# Nope v2.0 マルチサイト対応工程（plan: nope-v2）

`docs/roadmap-block-targets.md` の8対象・7サイトを実装する工程。着手前に **`docs/survey/ec-sites.md`** と **`docs/survey/media-sites.md`**（nagi・shiho の実地調査、2026-08-11）を読むこと。**この2つが実装の事実正本であり、この文書の要約ではない。**

## 調査で確定した設計の分岐

発信元の取り方が**3パターン**に分かれることが実測で確定した。サイトアダプタはこの3つを扱えなければならない。

### パターンA — DOM に発信元の ID がある（軽い）
| サイト | カードセレクタ | 発信元の取り方 |
|---|---|---|
| 楽天市場 | `.dui-card` | `a[href^="https://www.rakuten.co.jp/"][href$="/"]` の URL から shopSlug、テキストが店舗名 |
| Yahoo!ショッピング | `div[class*="SearchResult_SearchResultItem"]` | `a[href^="https://store.shopping.yahoo.co.jp/"][href$="/"]` の URL から storeId |
| YouTube 検索結果 | `ytd-video-renderer` | `a[href*="/@"]`（handle 形式）または `a[href*="/channel/"]`（UC 形式） |

### パターンB — 表示名しか無い（ID が取れない）
| サイト | カードセレクタ | 発信元の取り方 |
|---|---|---|
| YouTube 視聴ページの関連動画 | `yt-lockup-view-model` | チャンネルリンク**なし**。`span.ytAttributedStringHost` の表示名テキストのみ |
| Yahoo ニュース | （調査文書参照） | `time.previousElementSibling`（span）の出版社名テキスト |
| Yahoo! JAPAN | （調査文書参照） | `cite` 要素の出版社名テキスト |

### パターンC — DOM に発信元が無い（非同期解決＋キャッシュ）
| サイト | カードセレクタ | 発信元の取り方 |
|---|---|---|
| AliExpress | `a.search-card-item` | mtop API（**実装済み**） |
| ヤフオク | `li.Product` | オークションページの `a[href*="/seller/"]` から sellerId |
| Amazon | `div[data-component-type="s-search-result"]` | 商品詳細ページの `a[href*="seller="]` の URL パラメータから sellerId |

## 実装に効く実測事実（推測しないこと）

- **YouTube にチャンネル ID の2形式が混在する**。同一チャンネルが `/@handle` と `/channel/UC...` の両方で現れうる（検索結果5件中、UC 形式2件・handle 形式3件）。**正規化しないと「ブロックしたのに別形式で出てくる」**。どちらを正とするかは v1 で決める
- **Shadow DOM の壁は無い**。`ytd-video-renderer.shadowRoot === null`、`yt-lockup-view-model.shadowRoot === null` を実測確認済み。content script の通常の `querySelectorAll` で届く
- **AliExpress の `.card-out-wrapper` 罠は他サイトに無い**。調査した6サイトすべて、カード要素自身が grid/flex のアイテムで、`display:none` で素直に空間が詰まる
- **Yahoo!ショッピングのセレクタは CSS Modules のハッシュ付き**。サイト側のビルドで変わりうるため、部分一致（`class*=`）で拾い、壊れた時に検知できるようにする
- **YouTube・Yahoo ニュースは SPA**。MutationObserver 必須（実装済みの機構が使える）
- **YouTube のホーム画面は未実測**（未ログインでコンテンツが出ないため）。ログイン状態での実測が要る
- 全サイトともログイン不要で一覧が見える（YouTube ホームを除く）

## タスク

### v1-architecture — サイトアダプタと storage スキーマの設計

3パターンを扱えるアダプタ契約を決め、`docs/design-site-adapter.md` に記す。設計の核は次の3点。

1. **アダプタ契約**: サイトごとに `matches` / カードセレクタ / 発信元の取得（同期 DOM / 表示名のみ / 非同期解決）を定義する形。共通側が持つのは非表示の当て方（プレースホルダー / 詰めて消す）・キャッシュ・MutationObserver 追従・storage
2. **発信元の識別子**: ID がある場合と表示名しか無い場合の両方を1つのブロックリストで扱う。**表示名マッチは表記揺れとサイト側の改名で壊れる**——その限界を設計として明示し、静かに失敗させない
3. **storage スキーマの移行**: 現行 `blockedStores`（storeId 前提）から、サイト種別を含む形へ。**既存ユーザーのデータを壊さない移行経路**を必ず設計する（v1.1.0 の利用者が居る前提で、旧キーを読んで新形式へ移す）

### v2-refactor — 既存 AliExpress をアダプタ構造へ移行

機能を変えずに構造だけ移す。**受入条件は「テストが全 green のまま」と「AliExpress の動作が実ブラウザで従来どおり」**。ここで壊すと既に検証済みの成果を失う。

### v3-adapter-id — パターンA実装（楽天・Yahoo!ショッピング・YouTube 検索結果）

DOM から発信元 ID を取る3サイト。YouTube の handle/UC 正規化を含む。

### v4-adapter-name — パターンB実装（YouTube 関連動画・Yahoo ニュース・Yahoo! JAPAN）＋キーワードブロック

表示名でマッチする3面と、Yahoo のタイトル文字列によるキーワードブロック（roadmap #2）。**キーワードは部分一致か完全一致か、大文字小文字と全角半角をどう扱うかを決めて記録すること。**

### v5-adapter-resolve — パターンC実装（ヤフオク・Amazon）

非同期解決の2サイト。AliExpress の解決キュー（2並列・300ms 間隔・失敗時は静かに消さない）をアダプタ経由で再利用する。**サイトごとに解決先の URL と抽出方法が違う**（ヤフオク=オークションページの `/seller/` リンク、Amazon=商品詳細の `?seller=` パラメータ）。

### v6-popup — サイト別のブロックリスト管理 UI

popup で「どのサイトの何をブロックしているか」が分かる形にする。サイトが7つに増えるため、現行の平坦なリストでは破綻する。ブランド適用済みのデザイン（Paper / Ink / Action Orange）を維持すること。

### v7-verify — 全サイト実ブラウザ検証

7サイトすべてで、①ブロック対象が消える ②プレースホルダー/詰めて消すの両モード ③解除の復元 ④リロード無し即時反映、を実測する。**「たぶん動く」で閉じない。**

### v8-package — 配布物 v2.0.0

`manifest.json` の version を `2.0.0` へ、`content_scripts.matches` に全対象サイトを追加。ZIP を作り直し、**展開先をロードしての配布物 smoke** を取る。`docs/store/listing.md` の権限の正当化を、増えたサイトぶん更新する。

## 依存

- v2 ← v1
- v3・v4・v5・v6 ← v2（着手時点で並列）
- v7 ← v3・v4・v5・v6
- v8 ← v7

## この工程の外にあるもの

- **ストア提出（r7-submit）**: オーナーの $5 デベロッパー登録待ち。v1.1.0 で先に出すか v2.0.0 を待つかは未裁定
- **YouTube ホーム画面の対応**: 未実測のため、v1 の設計時に実測してから範囲に入れるか決める
