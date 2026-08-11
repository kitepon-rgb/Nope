// YouTube 視聴ページ関連動画アダプタ（パターンB: 表示名のみ）。
// 実測: yt-lockup-view-model 内にチャンネルリンクは存在しない（2026-08-11 shiho 実測）。
// span.ytAttributedStringHost の2番目（index 1）からチャンネル表示名を取る。
// siteKey は youtube 検索結果アダプタと共有するため、ブロックリストも共有される。

'use strict';

const CB_ADAPTER_YOUTUBE_WATCH = (() => {
  return {
    siteKey: 'youtube',
    matches: ['*://www.youtube.com/watch*'],
    cardSelector: 'yt-lockup-view-model',
    getWrapper: (card) => card,
    resolver: {
      type: 'dom_name',
      getSource(card) {
        const span = card.querySelectorAll('span.ytAttributedStringHost')[1];
        if (!span) return null;
        const name = span.textContent.trim();
        if (!name) return null;
        return { sourceName: name };
      },
    },
  };
})();

// content_scripts 連結読み込み時に自動起動（CB_NAME は content-name.js で定義される）。
CB_NAME.init({ adapter: CB_ADAPTER_YOUTUBE_WATCH }).start();
