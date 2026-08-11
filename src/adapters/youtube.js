// YouTube 検索結果アダプタ（パターンA: DOM から発信元ID を直接取得）。
// 根拠: docs/survey/media-sites.md（shiho 実地調査 2026-08-11）・docs/design-site-adapter.md（tsumugi 設計）。
// カード ytd-video-renderer 内の a[href*="/@"] または a[href*="/channel/"] からチャンネル識別子を取得する。
//
// 【handle/UC 正規化（v2決定・room裁定 2026-08-11・design-site-adapter.md §3-3を上書き）】
//   plan成功条件2「片方だけ再出現する状態を許さない」を満たすため、UC形式を正本として正規化する。
//   handle形式のカードは resolver.canonicalize() で実チャンネル応答（canonical link）から真のUC IDを
//   解決してから保存・照合する。表示名は識別子として使わない。blockedSources には常にUC IDだけが
//   キーとして入り、handle→UCの対応は itemSourceCache（storage.getCachedSource/setCachedSource、
//   AliExpress等と同じ解決キャッシュ）を再利用してsiteKey='youtube'の名前空間に持つ。
//   解決できない（fetch失敗・canonical link不在）場合は登録操作を提供しない
//   （部分登録へのフォールバック禁止・エラーをカード上に明示する。CB_SEARCH側の実装参照）。
//
// 【実測（nagi 2026-08-11・kotone 2026-08-11）】
//   検索結果で handle形式・UC形式が混在（同一チャンネルが両形式で出たケースは0件、DOM単独では
//   紐付ける手段が無い）。
// 【実測（mashiro 2026-08-11・curl直叩き）】
//   `https://www.youtube.com/@NASA` の応答に `<link rel="canonical" href=".../channel/UC...">` が
//   1件だけ含まれ、真のUC IDを確実に取得できる。逆方向 `https://www.youtube.com/channel/UC...` の
//   応答にも `"canonicalBaseUrl":"/@handle"` が含まれる（bellが独立に再現・裁定[45]）。
//
// SPA・無限スクロール: MutationObserver 追従は CB_SEARCH エンジンが担当（shadow DOM なし・実測確認済み）。

'use strict';

// 【ホーム対応（room裁定 2026-08-11・bellの実Chrome実測[86]、オーナーのログイン済みホームで確認）】
//   検索結果と違いホームのカードは `ytd-rich-item-renderer`（`ytd-video-renderer` ではない。
//   実測: ytd-video-renderer=0件、ytd-rich-item-renderer=37件、ホーム実装の初版はここを取り違えて
//   登録ボタンが1件も出ない欠陥だった）。構造:
//     ytd-rich-item-renderer > div#content > yt-lockup-view-model > div.ytLockupViewModelHost
//       > a[href="/watch..."], a[href="/@handle"], ...
//   `#dismissible` は存在せず、登録ボタンのアンカーは `#content`（ytd-rich-item-renderer の直下）。
//   `yt-lockup-view-model` を cardSelector に直接使ってはいけない——広告カード
//   （`ytd-rich-item-renderer > #content > ytd-ad-slot-renderer > ...`）の内部にも深く入れ子で
//   存在するため、rich-item単位より多くヒットし広告・内部要素を誤って拾う（実測: lockup=45件 >
//   rich-item=37件）。広告カードは getSource が対象リンクを持たずnullを返すため、既存の
//   「source無しはスキップ」処理で自然に除外される（広告固有の判定コードは不要）。
const YOUTUBE_ADAPTER = {
  siteKey: 'youtube',
  matches: ['*://www.youtube.com/*'],

  // 検索結果（ytd-video-renderer）とホーム（ytd-rich-item-renderer）の両方を1つのadapterで拾う。
  // Shadow DOM なし（実測確認）。
  cardSelector: 'ytd-video-renderer, ytd-rich-item-renderer',

  // どちらの面でもカード自体が block 要素で、display:none で空間が詰まる（実測確認）。
  getWrapper: (card) => card,

  resolver: {
    type: 'dom_id',

    /**
     * カードからチャンネル識別子と表示名を取得する。
     * @param {Element} card `ytd-video-renderer` 要素
     * @returns {{ sourceId: string, sourceName: string } | null}
     */
    getSource(card) {
      // handle 形式を優先（より新しい形式）。
      const handleLink = card.querySelector('a[href*="/@"]');
      if (handleLink) {
        const href = handleLink.getAttribute('href') || '';
        const m = /^\/@([^/?#]+)/.exec(href);
        if (m) {
          return {
            sourceId: `@${m[1]}`,
            sourceName: handleLink.textContent.trim(),
          };
          // 実測例: { sourceId: '@MagicClub686', sourceName: 'Magic Club' }
        }
      }

      // UC 形式にフォールバック。
      const channelLink = card.querySelector('a[href*="/channel/"]');
      if (channelLink) {
        const href = channelLink.getAttribute('href') || '';
        const m = /\/channel\/(UC[^/?#]+)/.exec(href);
        if (m) {
          return {
            sourceId: m[1],
            sourceName: channelLink.textContent.trim(),
          };
          // 実測例: { sourceId: 'UCMJEnW8naproLde7E2GInhw', sourceName: 'MELLOW SPOT' }
        }
      }

      return null;
    },

    /**
     * rawSourceId（handle形式 '@xxx' またはUC形式 'UCxxx'）から正本のUC IDを解決する。
     * UC形式は既に正本なのでfetchせずそのまま返す。handle形式は実チャンネル応答の
     * canonical linkから真のUC IDを取得する。解決できなければthrow（フォールバック禁止）。
     * @param {string} rawSourceId
     * @returns {Promise<string>}
     */
    async canonicalize(rawSourceId) {
      if (rawSourceId.startsWith('UC')) return rawSourceId;

      const url = `https://www.youtube.com/${rawSourceId}`;
      let res;
      try {
        res = await fetch(url);
      } catch (err) {
        throw new Error(`youtube: canonical解決のfetchに失敗しました rawSourceId=${rawSourceId}: ${err && err.message}`);
      }
      if (!res.ok) {
        throw new Error(`youtube: canonical解決でHTTPエラー status=${res.status} rawSourceId=${rawSourceId}`);
      }
      const html = await res.text();
      const m = /<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[^"]+)">/.exec(html);
      if (!m) {
        throw new Error(`youtube: canonical linkが見つかりませんでした rawSourceId=${rawSourceId}`);
      }
      return m[1];
      // 実測例（2026-08-11 curl）: '@NASA' → 'UCLA_DiR1FfKNvjuUpBHmylQ'
    },

    /**
     * 逆方向: 正本UC IDから対応するhandleを解決する（room裁定 2026-08-11・[55][58]）。
     * UCカードを起点にブロックした場合でも、同じチャンネルが後でhandle形式カードとして
     * 現れた時に「片方だけ再出現する」ことを防ぐため、UC側クリック時にもhandleを解決する。
     * fetch失敗・非200・**canonicalBaseUrlパターン不一致は全てthrow**——
     * 「パターンが見つからない＝handleが無い」と推測しない（bell裁定[58]: 黙ったfallback禁止。
     * 応答が解析できない場合は同一性未確定として扱い、UC側のブロックも成立させない）。
     * @param {string} canonicalUCId
     * @returns {Promise<string>} handle形式（'@xxx'）
     */
    async findHandleAlias(canonicalUCId) {
      const url = `https://www.youtube.com/channel/${canonicalUCId}`;
      let res;
      try {
        res = await fetch(url);
      } catch (err) {
        throw new Error(`youtube: handle解決のfetchに失敗しました canonicalUCId=${canonicalUCId}: ${err && err.message}`);
      }
      if (!res.ok) {
        throw new Error(`youtube: handle解決でHTTPエラー status=${res.status} canonicalUCId=${canonicalUCId}`);
      }
      const html = await res.text();
      const m = /"canonicalBaseUrl":"\/(@[^"]+)"/.exec(html);
      if (!m) {
        throw new Error(`youtube: canonicalBaseUrlが見つかりませんでした（handle不在とは断定しない） canonicalUCId=${canonicalUCId}`);
      }
      return m[1];
      // 実測例（2026-08-11 curl）: 'UCLA_DiR1FfKNvjuUpBHmylQ' → '@NASA'
    },

    // docs/design-youtube-surfaces.md §3: hover/focusで現れる登録トグルボタンを挿入する。
    // 検索結果は #dismissible（kotone実測）、ホームは #content（bell実測[86]、#dismissible無し）。
    // カード種別で分岐せず「#dismissibleがあれば使う、無ければ#content、どちらも無ければcard自体」の
    // 優先順で決める（cardSelectorが複数面を1つのadapterで拾うため、呼び出し側で面を判定しない）。
    register: {
      anchor(card) {
        return (card.querySelector && (card.querySelector('#dismissible') || card.querySelector('#content'))) || null;
      },
    },
  },
};

// ブラウザ環境で CB_SEARCH エンジンが読み込まれていれば自動起動する。
if (typeof CB_SEARCH !== 'undefined') {
  CB_SEARCH.init({ adapter: YOUTUBE_ADAPTER }).start();
}
