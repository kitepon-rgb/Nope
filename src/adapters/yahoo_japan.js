// Yahoo! JAPAN アダプタ（パターンB: 表示名のみ）。
// 実測: article:has(cite):not(:has(article)) がカード（入れ子 article の葉のみ選択）。
// 出版社名: cite 要素テキスト（意味論的に安定）。
// タイトル: article h1 テキスト（2026-08-11 実測確認）。
// キーワードブロック対象 siteKey: 'yahoo_japan'。

'use strict';

const CB_ADAPTER_YAHOO_JAPAN = (() => {
  return {
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
      },
    },
    getTitle(card) {
      const h1 = card.querySelector('h1');
      return h1 ? (h1.textContent.trim() || null) : null;
    },
  };
})();

// content_scripts 連結読み込み時に自動起動（CB_NAME は content-name.js で定義される）。
CB_NAME.init({ adapter: CB_ADAPTER_YAHOO_JAPAN }).start();
