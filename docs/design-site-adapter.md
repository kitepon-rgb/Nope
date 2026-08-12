# サイトアダプタ契約・storage スキーマ設計

設計者: tsumugi / 設計日: 2026-08-11  
根拠: `docs/survey/ec-sites.md`（nagi）・`docs/survey/media-sites.md`（shiho）の実地調査  
plan: nope-v2 / task: v1-architecture

---

## 1. 背景と目的

Nope v1.1.0 は AliExpress 専用に実装されている（`content-search.js` の CARD_SELECTOR・mtop 解決・`blockedStores` スキーマがすべて AliExpress 前提）。v2.0 で7サイト・8対象に広げるには、サイト固有の知識を「アダプタ」として外出しし、エンジン側は共通機構だけを持つ構造が必要になる。

この文書は以下を確定する:

1. **アダプタ契約** — サイトアダプタが実装しなければならない interface
2. **発信元の識別子** — ID・表示名の扱いと YouTube 2形式の方針
3. **storage スキーマ** — v2 の新スキーマ（v1.1.0 との互換性なし）
4. **表示名マッチの限界と検知** — 壊れた時にユーザーに見せる方法

---

## 2. アダプタ契約

調査で発信元の取り方が**3パターン**に分かれることが確定した。アダプタはこの3つのうち1つを実装する。

### 2-1. 3パターンの定義

```
パターンA: DOM 直読み ID
  カード内のリンク href から、発信元の安定した識別子（ID / slug）が取れる

パターンB: 表示名のみ
  カード内にチャンネル・出版社へのリンクが無い。テキストしか取れない。
  識別子は表示名そのもの（名前が変われば効かなくなる）

パターンC: 非同期解決
  カード内に発信元情報が無い。アイテムIDを取り、別ページを叩いて発信元IDを解決する。
  AliExpress（実装済み）・ヤフオク・Amazon がこのパターン
```

### 2-2. アダプタ定義の形式（JS オブジェクト）

```javascript
// 共通フィールド（全パターン必須）
{
  siteKey: 'string',       // storage のキー名。a-z / _ のみ。例: 'rakuten', 'youtube'
  matches: ['string'],     // manifest.json content_scripts.matches と一致させる
  cardSelector: 'string',  // 検索カード要素の CSS セレクタ

  // 任意。manifest の matches が商品詳細・視聴面まで含む場合、一覧エンジンを起動する面だけ true。
  // false の面では storage 読込・DOM監視・初回0件警告を開始しない。
  isTargetPage(location) → boolean,

  // カード要素から「非表示にする外側要素（wrapper）」を返す関数。
  // null を返すとそのカードはスキップ（wrapper が見つからない扱い）。
  // AliExpress 以外は card 自体が grid/flex アイテムなので (card) => card が基本。
  getWrapper(card) → Element | null,

  // resolver: パターンによって異なる（下記3種のいずれか）
  resolver: PatternA | PatternB | PatternC,
}
```

### 2-3. パターンA の resolver

```javascript
{
  type: 'dom_id',
  // カードから発信元の識別子と表示名を返す。
  // 取得できなければ null（そのカードはブロック対象外として表示のまま）。
  getSource(card: Element): { sourceId: string, sourceName: string } | null,
}
```

### 2-4. パターンB の resolver

```javascript
{
  type: 'dom_name',
  // カードから発信元の表示名を返す。
  // null を返すとそのカードはスキップ。
  // sourceName が識別子として使われる（nameOnly エントリ）。
  getSource(card: Element): { sourceName: string } | null,
}
```

### 2-5. パターンC の resolver

```javascript
{
  type: 'async_resolve',
  // カードからアイテム識別子（productId / auctionId / ASIN）を返す。
  getItemId(card: Element): string | null,
  // アイテム識別子から発信元を非同期解決する。
  // 失敗は throw（フォールバック禁止）。
  resolveSource(itemId: string): Promise<{ sourceId: string, sourceName: string }>,
}
```

### 2-6. 各サイトの具体例

#### 楽天市場（パターンA）

```javascript
{
  siteKey: 'rakuten',
  matches: ['*://search.rakuten.co.jp/*'],
  cardSelector: '.dui-card',
  getWrapper: (card) => card,
  resolver: {
    type: 'dom_id',
    getSource(card) {
      const a = card.querySelector('a[href^="https://www.rakuten.co.jp/"][href$="/"]');
      if (!a) return null;
      const m = /rakuten\.co\.jp\/([^\/]+)\//.exec(a.href);
      if (!m) return null;
      return { sourceId: m[1], sourceName: a.textContent.trim() };
      // 例: { sourceId: 'aidort', sourceName: '愛度楽天市場店' }
    },
  },
}
```

#### Yahoo!ショッピング（パターンA）

```javascript
{
  siteKey: 'yahoo_shopping',
  matches: ['*://shopping.yahoo.co.jp/*'],
  cardSelector: 'div[class*="SearchResult_SearchResultItem"]',
  getWrapper: (card) => card,
  resolver: {
    type: 'dom_id',
    getSource(card) {
      // **末尾スラッシュを要求してはいけない**（2026-08-11 実ブラウザ実測）。
      // 実 DOM のリンクは `store.shopping.yahoo.co.jp/{storeId}/{item}.html?...` で、
      // `[href$="/"]` を付けるとストアリンク180本に対し一致0本になり、この面は完全に死ぬ。
      const a = card.querySelector('a[href^="https://store.shopping.yahoo.co.jp/"]');
      if (!a) return null;
      const m = /store\.shopping\.yahoo\.co\.jp\/([^\/]+)\//.exec(a.href);
      if (!m) return null;
      return { sourceId: m[1], sourceName: a.textContent.trim() };
      // 例: { sourceId: 'smahoservic', sourceName: 'L&Lスマホサービス' }
    },
  },
}
```

**備考**: `div[class*="SearchResult_SearchResultItem"]` は CSS Modules ハッシュ付き。サイト側のビルドで変わりうる。セレクタが0件になった場合を検知するための「カード数が0のときは警告を出す」仕組みをエンジン側に持つこと（セレクタの壊れを運用中に検知できるようにする）。

#### YouTube 検索結果（パターンA）

```javascript
{
  siteKey: 'youtube',
  matches: ['*://www.youtube.com/*'],
  cardSelector: 'ytd-video-renderer',
  getWrapper: (card) => card,
  resolver: {
    type: 'dom_id',
    getSource(card) {
      const a = card.querySelector('a[href*="/@"], a[href*="/channel/"]');
      if (!a) return null;
      const href = a.getAttribute('href') || '';
      const handleM = /^\/@([^/?]+)/.exec(href);
      if (handleM) {
        // handle 形式: '@MagicClub686' として保存（@ 付き）
        return { sourceId: `@${handleM[1]}`, sourceName: a.textContent.trim() };
      }
      const channelM = /\/channel\/(UC[^/?]+)/.exec(href);
      if (channelM) {
        // channelId 形式: 'UCxxxxxx' として保存
        return { sourceId: channelM[1], sourceName: a.textContent.trim() };
      }
      return null;
    },
  },
}
```

**重要**: YouTube 検索結果と視聴ページ関連動画は同一 siteKey `'youtube'` を共有する。  
カードセレクタは面によって異なる（検索結果=`ytd-video-renderer`、関連動画=`yt-lockup-view-model`）ため、アダプタを面ごとに分けるか、1つのアダプタが複数セレクタを持つかは v2-refactor 時に決める（→ 先送り、§6 参照）。

#### YouTube 視聴ページ関連動画（パターンB）

```javascript
{
  siteKey: 'youtube',
  matches: ['*://www.youtube.com/watch*'],
  cardSelector: 'yt-lockup-view-model',
  getWrapper: (card) => card,
  resolver: {
    type: 'dom_name',
    getSource(card) {
      // **index 1 を取る**（2026-08-11 実ブラウザ実測）。実測順は index 0 が動画タイトル、
      // index 1 がチャンネル名。`querySelector` で先頭を取ると発信元名として動画タイトルを返す。
      const span = card.querySelectorAll('span.ytAttributedStringHost')[1];
      if (!span) return null;
      const name = span.textContent.trim();
      if (!name) return null;
      return { sourceName: name };
      // 例: { sourceName: 'Rick Astley' }
    },
  },
}
```

#### Yahoo ニュース（パターンB）

```javascript
{
  siteKey: 'yahoo_news',
  matches: ['*://news.yahoo.co.jp/*'],
  cardSelector: 'ul.newsFeed_list > li',
  getWrapper: (card) => card,
  resolver: {
    type: 'dom_name',
    getSource(card) {
      const time = card.querySelector('time');
      if (!time || !time.previousElementSibling) return null;
      const name = time.previousElementSibling.textContent.trim();
      if (!name) return null;
      return { sourceName: name };
      // 例: { sourceName: '西スポWEB OTTO!' }
    },
  },
}
```

#### Yahoo! JAPAN（パターンB）

```javascript
{
  siteKey: 'yahoo_japan',
  matches: ['*://www.yahoo.co.jp/*'],
  cardSelector: 'article:has(cite):not(:has(article))',
  getWrapper: (card) => card,
  resolver: {
    type: 'dom_name',
    getSource(card) {
      const cite = card.querySelector('cite');
      if (!cite) return null;
      const name = cite.textContent.trim();
      if (!name) return null;
      return { sourceName: name };
      // 例: { sourceName: 'TRILL ニュース' }
    },
  },
}
```

#### ヤフオク（パターンC）

```javascript
{
  siteKey: 'yahoo_auctions',
  matches: ['*://auctions.yahoo.co.jp/*'],
  cardSelector: 'li.Product',
  getWrapper: (card) => card,
  resolver: {
    type: 'async_resolve',
    getItemId(card) {
      const a = card.querySelector('a[data-auction-id]');
      return a ? a.getAttribute('data-auction-id') : null;
      // 例: 'q1240291994'
    },
    async resolveSource(auctionId) {
      // オークション詳細ページを fetch して a[href*="/seller/"] を探す
      // 実装詳細は v5-adapter-resolve で確定させる
      // 失敗は throw（フォールバック禁止）
    },
  },
}
```

#### Amazon（パターンC）

```javascript
{
  siteKey: 'amazon',
  matches: ['*://www.amazon.co.jp/*'],
  cardSelector: 'div[data-component-type="s-search-result"]',
  getWrapper: (card) => card,
  resolver: {
    type: 'async_resolve',
    getItemId(card) {
      return card.getAttribute('data-asin');
      // 例: 'B0CT857V89'
    },
    async resolveSource(asin) {
      // 商品詳細ページを fetch して a[href*="seller="] を探す
      // 実装詳細は v5-adapter-resolve で確定させる
      // 失敗は throw（フォールバック禁止）
    },
  },
}
```

---

## 3. 発信元の識別子

### 3-1. ID ベース（パターンA・C）と表示名ベース（パターンB）の共存

同一の `blockedSources[siteKey]` オブジェクト内に両方のエントリが混在する。エントリ形式:

```javascript
// ID ベースエントリ（パターンA / C から登録）
{
  name: string,       // 表示用の発信元名
  addedAt: number,    // epoch ms
  // nameOnly フィールドなし（欠如 = ID ベース）
}

// 表示名ベースエントリ（パターンB から登録）
{
  name: string,
  addedAt: number,
  nameOnly: true,     // 表示名ベースであることを明示
}
```

キーは: ID ベースなら発信元ID（`'aidort'`, `'@MagicClub686'`, `'A3EMK34PT3V85P'` など）、表示名ベースなら発信元の表示名そのもの（`'西スポWEB OTTO!'` など）。

### 3-2. マッチングの優先順位とフォールバック

エンジンがカードの発信元を blocklist と突き合わせる順序:

```
1. resolver が sourceId を返した場合 → blocked[sourceId] の直接照合（exact match）
2. resolver が sourceName だけを返した場合（パターンB）:
   a. blocked[sourceName] の直接照合（表示名ベースエントリとの exact match）
   b. 一致なし → 表示のまま（warn も出さない。パターンBが「誰でもない」のは正常）
```

**パターンA ↔ パターンB の橋渡しはしない**（§3-4 参照）。

### 3-3. YouTube の2形式問題

**確定した実測事実（shiho 2026-08-11）**: 検索結果5件中、handle 形式 `/@xxx` が3件・channelId 形式 `/channel/UC...` が2件。

**追加実測（nagi 2026-08-11）**: 検索結果23件（未ログイン）を精査。handle 形式 11件・UC 形式 12件が混在。**同一チャンネルが `/@handle` と `/channel/UC...` の両形式で出たケースは23件中0件**（サンプル数23）。この範囲では問題は観測されなかったが、サンプル数が限られるため「絶対に起きない」とは断言できない。

**v1 の決定: 取れた形式をそのまま保存・照合する（正規化しない）**

- `/@MagicClub686` → sourceId = `'@MagicClub686'`
- `/channel/UCxxxxxx` → sourceId = `'UCxxxxxx'`
- ブロックリストの照合は exact match のみ

**この決定の結果として生じる既知の限界**:  
同一チャンネルが検索結果で `/@handle` 形式のカードと `/channel/UC...` 形式のカードの両方で出た場合、片方のみでブロックを登録すると、もう片方のカードにはブロックが効かない。23件の実測では両形式の併存は観測されなかったが、より広いサンプル・ログイン状態・ホーム画面等の未実測経路での発生は排除できない。

**v2 での改善（先送り）**: YouTube Data API を使って handle → channelId の正規化を行い、登録時に統一した識別子で保存する。

**正規化しない理由**: Content script から YouTube の OAuth API を叩くにはユーザーの認証フローが必要で、v1 の scope を大きく超える。「完璧にしようとして動かない」より「限界を明示して動く」を選んだ。

### 3-4. パターンA ↔ B の橋渡しを v1 でしない理由

YouTube を例にすると:
- 検索結果（パターンA）で `@MagicClub686` をブロックすると、名前 `"Magic Club"` もエントリに保存されている
- 関連動画（パターンB）のカードには `"Magic Club"` テキストが出る
- 「名前フィールドで突き合わせれば同じチャンネルをブロックできる」に見える

しかし名前フィールドでの突き合わせは **表示名マッチと同じリスク**（改名・同名別チャンネル）を持つ。また「名前が完全一致する別チャンネル」を誤ってブロックするリスクを知らずにユーザーが踏む。v1 で黙って実装するより、v2 で `nameOnly: true` のエントリとして明示的に追加する UI を提供する方が誠実。

---

## 4. 表示名マッチの限界と検知

### 4-1. 壊れるシナリオ

パターンB（表示名のみ）の `nameOnly: true` エントリは以下で効かなくなる:

1. **サイト側の改名**: 出版社名・チャンネル名が変更される  
   例: "西スポWEB OTTO!" が "西スポ OTTO!" に改名 → ブロックが効かなくなる
2. **表記揺れ**: 全角/半角・空白の有無など  
   例: "TRILL ニュース" と "TRILLニュース" が混在していると片方にしか効かない
3. **YouTube 関連動画**: 同名の別チャンネルを誤ってブロックする

### 4-2. ユーザーへの見せ方

**popup で `nameOnly: true` エントリに警告アイコンを付ける**:
- エントリ一覧の表示名の横に `⚠ 名前マッチ` バッジを付ける
- ホバー/タップで説明: 「この発信元は名前でブロックされています。発信元が名前を変えると自動的に解除されます」

**エンジン側でのセレクタ壊れの検知**:
- `isTargetPage` が true（未定義なら従来どおり対象）の面だけ `cardSelector` に対して `querySelectorAll` を実行し、初回スキャン時に0件だった場合は `console.warn` を出す
- 商品詳細・動画視聴など、検索カード0件が正常な面では一覧エンジン自体を起動しない
- Yahoo!ショッピングのような CSS Modules セレクタ（`class*=` 部分一致）が壊れた場合に運用で気づけるようにする

**マッチが壊れたことそのものの自動検知はしない**:  
「ブロックが効かなくなった」はサイトの名前変更で起きるが、拡張機能がそれを知る方法がない（定期的なクロールは禁止、push 通知もない）。運用上の対処は「ユーザーが効かないことに気づいてポップアップで削除・再登録する」。自動検知の実装は v2 の検討事項として先送り。

---

## 5. storage スキーマ

### 5-1. v2 新スキーマ（chrome.storage.sync）

```json
{
  "blockedSources": {
    "aliexpress": {
      "1100223114": { "name": "NailNest Store", "addedAt": 1723200000000 }
    },
    "youtube": {
      "@MagicClub686": { "name": "Magic Club", "addedAt": 1723200000000 },
      "UCxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx": { "name": "Some Channel", "addedAt": 1723200000000 },
      "Rick Astley": { "name": "Rick Astley", "nameOnly": true, "addedAt": 1723200000000 }
    },
    "rakuten": {
      "aidort": { "name": "愛度楽天市場店", "addedAt": 1723200000000 }
    },
    "yahoo_shopping": {
      "smahoservic": { "name": "L&Lスマホサービス", "addedAt": 1723200000000 }
    },
    "yahoo_auctions": {
      "DFvUrXQ8JX9MobKNnv8hnSWJXVbzj": { "name": "goanshinkudasai", "addedAt": 1723200000000 }
    },
    "amazon": {
      "A3EMK34PT3V85P": { "name": "HK-JIMI", "addedAt": 1723200000000 }
    },
    "yahoo_news": {
      "西スポWEB OTTO!": { "name": "西スポWEB OTTO!", "nameOnly": true, "addedAt": 1723200000000 }
    },
    "yahoo_japan": {
      "TRILL ニュース": { "name": "TRILL ニュース", "nameOnly": true, "addedAt": 1723200000000 }
    }
  },
  "displayMode": "placeholder"
}
```

**注**: `blockedSources` は 1 つの sync キーとして持つ。各サイトのエントリ数が増えた場合に `chrome.storage.sync` の1アイテム制限（8,192バイト）を超えるリスクがあれば、v2-refactor でサイト別キー（`blockedSources_aliexpress` など）に分割する設計を検討する（現時点では起きていない・起きそうな規模でもない）。

### 5-2. v2 新スキーマ（chrome.storage.local）

非同期解決キャッシュを `productStoreCache`（AliExpress 専用・平坦）から `itemSourceCache`（サイト別プレフィックス）へ改める。

```json
{
  "itemSourceCache": {
    "aliexpress:1005012897132115": "1100223114",
    "yahoo_auctions:q1240291994": "DFvUrXQ8JX9MobKNnv8hnSWJXVbzj",
    "amazon:B0CT857V89": "A3EMK34PT3V85P"
  }
}
```

キー形式: `{siteKey}:{itemId}`

### 5-3. v1.1.0 との非互換

**この storage スキーマは v1.1.0（`blockedStores`・`productStoreCache`）と互換性がない。v2.0 へ更新すると既存のブロックリストとキャッシュは失われる。**  
オーナー裁定 2026-08-11: 現在の利用者はオーナー1名のみであり、既存データの消失は許容済み。将来ユーザーが増えた場合は移行経路の設計が必要になる（その時点で判断する）。

### 5-4. storage API の変更点

`storage.js` の改修方針（実装は v2-refactor で行う）:

```javascript
// 旧
getBlockedStores() → Promise<{ [storeId: string]: { name, addedAt } }>
addBlockedStore(storeId, name) → 数値バリデーション付き
removeBlockedStore(storeId)

// 新
getBlockedSources(siteKey) → Promise<{ [sourceId: string]: { name, addedAt, nameOnly? } }>
addBlockedSource(siteKey, sourceId, name, nameOnly?) → storeId の数値制限を外す
removeBlockedSource(siteKey, sourceId)

getCachedSource(siteKey, itemId) → Promise<string | null>
setCachedSource(siteKey, itemId, sourceId)
```

`onBlockedStoresChanged` → `onBlockedSourcesChanged(siteKey, listener)` に変更。

---

## 6. 先送りにしたこと

### YouTube ホーム画面（未実測）

未ログインではコンテンツが出ない。ログイン状態での実測が必要。先行 worker（shiho）の調査では `ytd-rich-item-renderer` の内部が視聴ページと同じ `yt-lockup-view-model` 構造と推定されているが、チャンネルリンクの有無は未確認。

**v1 の扱い**: 対象外。v2 で実測してからパターンを確定させる。  
**room への議題**: v2 スコープに含めるかオーナーが決める。

### YouTube アダプタの面分割

検索結果（`ytd-video-renderer`、パターンA）と視聴ページ関連動画（`yt-lockup-view-model`、パターンB）は siteKey は `'youtube'` で共通だが、カードセレクタが異なる。

1つのアダプタオブジェクトが複数セレクタを持つ形式（`{ cardSelector: ['ytd-video-renderer', 'yt-lockup-view-model'], resolvers: { ... } }`）にするか、面ごとに別アダプタにして同じ siteKey を共有させるかは v2-refactor で決める。

**→ v4 で確定（2026-08-11 shiho）**: 面ごとに別アダプタ・siteKey は `'youtube'` で共有する形に決定。`src/adapters/youtube.js`（パターンA・検索結果、v3-adapter-id）と `src/adapters/youtube_watch.js`（パターンB・視聴ページ関連動画、v4-adapter-name）が独立したファイルとして共存する。

### YouTube handle↔channelId 正規化

§3-3 参照。v2 で YouTube Data API を使った正規化を実装する。

### Yahoo!ショッピング CSS Modules セレクタの変更検知

`div[class*="SearchResult_SearchResultItem"]` はハッシュ部分が変わりうる。「0件になったら warn」以上の仕組み（定期チェック・バージョン対応表の維持）は先送り。

### パターンC（ヤフオク・Amazon）の fetch 実装

非同期解決の HTTP リクエストをどう飛ばすか（`fetch` の CORS 対策・`content_scripts` での credential 扱い）は v5-adapter-resolve で確定させる。AliExpress の JSONP リレー実装（`src/mtop-main-relay.js`）が参考になるが、ヤフオク・Amazon は HTML ページを直接 fetch するため実装が異なる。

### キーワードブロック（roadmap #2）

Yahoo/Yahoo ニュースの特定キーワードでのコンテンツブロック。カードのタイトルテキストに対する部分一致が基本になる。全角/半角・大文字小文字の正規化方針は v4-adapter-name で決める。

**→ v4 で確定（2026-08-11 shiho）**: 一致方式は部分一致、大文字小文字は区別しない（toLowerCase）、全角半角は区別しない（NFKC 正規化）、複数キーワードは OR。保存は生文字列のまま（正規化はマッチング時にエンジン側で行う）。storage キー: `blockedKeywords[siteKey]: string[]`。実装: `src/keyword-filter.js`。

### パターンBエンジンの分離（v4 確定）

設計時点ではエンジン実装の粒度を確定していなかったが、v4-adapter-name 実装（2026-08-11 shiho）で確定した。

**決定**: パターンBは既存の `src/content-search.js`（パターンC専用）に統合せず、`src/content-name.js` として別エンジンを新設する。

理由:
1. `content-search.js` はパターンCの非同期解決のための async queue（2並列・300ms 間隔制御）を内包しており、パターンB（同期解決）を混在させると条件分岐が複雑になりエラー追跡が困難になる
2. `manifest.json` の `content_scripts` は面ごとに別エントリ（独立したコンテキスト）で動く設計のため、ファイル分離は自然な境界
3. テストが独立して書きやすい

§2-2 のアダプタ契約（`resolver: PatternA | PatternB | PatternC`）は変わらない。エンジンの実装が2ファイルになったことを示す追加情報。

---

## 7. 各決定の理由

| 決定 | 理由 |
|---|---|
| 3パターンのアダプタ契約 | 実測で取得方法が3つに分岐することが確定。統一すると「できないこと」を実装で隠すことになる |
| パターンB の識別子を表示名そのものにする | ID がない以上、識別子にできるのは表示名だけ。`nameOnly: true` フラグで「不安定なエントリ」を明示し、ユーザーが判断できるようにする |
| YouTube を正規化しない（v1） | handle→channelId の変換は API 必要で content script の scope 外。「完璧にしようとして動かない」より「限界を明示して動く」 |
| パターンA↔B の橋渡しをしない（v1） | 「名前フィールドで突き合わせる」はユーザーが知らないうちに誤ブロックのリスクを生む。v2 で `nameOnly: true` エントリとして明示的に登録できる UI を提供する方が誠実 |
| storage を v1.1.0 と非互換にする | オーナー裁定により移行不要。互換維持のための歪みなしに「あるべき形」で設計する |
| `itemSourceCache` を `{siteKey}:{itemId}` でフラットにする | サイト間でキーが衝突しない。サイト別 get も `Object.entries` でフィルタするだけで済む |
| `blockedSources` を1キーに収める | 最初から分割するより、容量問題が発生してから分割する（YAGNI）。現実的なユーザー規模では起きない |
| `getWrapper` をアダプタに持たせる | AliExpress の `.card-out-wrapper` 問題（§2-6 備考）が他サイトでも起きうる。card ≠ wrapper のケースをアダプタが知っている方が自然 |
