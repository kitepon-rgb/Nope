// YouTube 視聴ページアダプタ（src/adapters/youtube_watch.js）のユニットテスト。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const SRC = path.join(import.meta.dirname, '..', '..', 'src', 'adapters', 'youtube_watch.js');

function loadAdapter() {
  let captured = null;
  const context = vm.createContext({
    console,
    CB_NAME: {
      init(opts) { captured = opts.adapter; return { start() {} }; },
    },
  });
  vm.runInContext(readFileSync(SRC, 'utf8'), context);
  return captured;
}

function makeCard(spanTexts) {
  return {
    querySelectorAll(selector) {
      if (selector === 'span.ytAttributedStringHost') {
        return (spanTexts || []).map((textContent) => ({ textContent }));
      }
      return [];
    },
  };
}

test('youtube_watch: 2番目のspan.ytAttributedStringHostをチャンネル名として返す', () => {
  const adapter = loadAdapter();
  const result = adapter.resolver.getSource(makeCard([
    'Never Gonna Give You Up',
    'Rick Astley',
    '1.2M',
    '10d ago',
  ]));
  assert.notEqual(result, null);
  assert.equal(result.sourceName, 'Rick Astley');
});

test('youtube_watch: チャンネル名に相当する2番目のspanがなければnullを返す', () => {
  const adapter = loadAdapter();
  const result = adapter.resolver.getSource(makeCard(['動画タイトルだけ']));
  assert.equal(result, null);
});

test('youtube_watch: テキストが空文字ならnullを返す', () => {
  const adapter = loadAdapter();
  const result = adapter.resolver.getSource(makeCard(['動画タイトル', '   ']));
  assert.equal(result, null);
});

test('youtube_watch: siteKeyがyoutube', () => {
  const adapter = loadAdapter();
  assert.equal(adapter.siteKey, 'youtube');
});

test('youtube_watch: cardSelectorがyt-lockup-view-model', () => {
  const adapter = loadAdapter();
  assert.equal(adapter.cardSelector, 'yt-lockup-view-model');
});

test('youtube_watch: resolver.typeがdom_name', () => {
  const adapter = loadAdapter();
  assert.equal(adapter.resolver.type, 'dom_name');
});

test('youtube_watch: getWrapperはcardをそのまま返す', () => {
  const adapter = loadAdapter();
  const card = { tagName: 'YT-LOCKUP-VIEW-MODEL' };
  assert.equal(adapter.getWrapper(card), card);
});

test('youtube_watch: matchesがwww.youtube.com/watch*を含む', () => {
  const adapter = loadAdapter();
  assert.ok(adapter.matches.some((m) => m.includes('youtube.com/watch')));
});
