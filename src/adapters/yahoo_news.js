// Yahoo ニュースアダプタ（パターンB: 表示名のみ）。
// 実測: ul.newsFeed_list > li がカード。出版社名は time 直前の sibling span。
// タイトル: a[href*="/articles/"] の textContent から出版社名と日時テキストを除去（styled-components 難読化対策）。
// キーワードブロック対象 siteKey: 'yahoo_news'。

'use strict';

const CB_ADAPTER_YAHOO_NEWS = (() => {
  return {
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
      },
    },
    getTitle(card) {
      const a = card.querySelector('a[href*="/articles/"]');
      if (!a) return null;
      const time = card.querySelector('time');
      const publisher = time && time.previousElementSibling;
      let title = a.textContent.trim();
      if (publisher) title = title.replace(publisher.textContent.trim(), '');
      if (time) title = title.replace(time.textContent.trim(), '');
      return title.trim() || null;
    },
  };
})();

// content_scripts 連結読み込み時に自動起動（CB_NAME は content-name.js で定義される）。
CB_NAME.init({ adapter: CB_ADAPTER_YAHOO_NEWS }).start();
