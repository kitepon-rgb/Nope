// Yahoo ニュースアダプタ（src/adapters/yahoo_news.js）のユニットテスト。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const SRC = path.join(import.meta.dirname, '..', '..', 'src', 'adapters', 'yahoo_news.js');

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

/**
 * li カードの fake DOM を作る。
 * @param {{ publisher?: string, timeText?: string, articleText?: string, hasArticleLink?: boolean }} opts
 */
function makeCard({ publisher, timeText, articleText, hasArticleLink = true } = {}) {
  const timeEl = timeText !== undefined
    ? { textContent: timeText, previousElementSibling: publisher !== undefined ? { textContent: publisher } : null }
    : null;
  const articleLink = (hasArticleLink && articleText !== undefined)
    ? { href: 'https://news.yahoo.co.jp/articles/abc123', textContent: articleText }
    : null;
  return {
    querySelector(selector) {
      if (selector === 'time') return timeEl;
      if (selector === 'a[href*="/articles/"]') return articleLink;
      return null;
    },
  };
}

test('yahoo_news: time直前spanから出版社名をsourceNameとして返す', () => {
  const adapter = loadAdapter();
  const card = makeCard({ publisher: '西スポWEB OTTO!', timeText: '8/11(火) 0:00' });
  const result = adapter.resolver.getSource(card);
  assert.notEqual(result, null);
  assert.equal(result.sourceName, '西スポWEB OTTO!');
});

test('yahoo_news: timeがなければnullを返す', () => {
  const adapter = loadAdapter();
  const card = makeCard({});
  const result = adapter.resolver.getSource(card);
  assert.equal(result, null);
});

test('yahoo_news: previousElementSiblingがなければnullを返す', () => {
  const adapter = loadAdapter();
  const card = makeCard({ timeText: '8/11(火) 0:00' }); // publisher を渡さない
  const result = adapter.resolver.getSource(card);
  assert.equal(result, null);
});

test('yahoo_news: 出版社テキストが空ならnullを返す', () => {
  const adapter = loadAdapter();
  const card = makeCard({ publisher: '   ', timeText: '8/11(火) 0:00' });
  const result = adapter.resolver.getSource(card);
  assert.equal(result, null);
});

test('yahoo_news: getTitleは記事リンクテキストから出版社名と日時を除去する', () => {
  const adapter = loadAdapter();
  const fullText = '阪神タイガース連勝！投打噛み合う快勝西スポWEB OTTO!8/11(火) 0:00';
  const card = makeCard({
    publisher: '西スポWEB OTTO!',
    timeText: '8/11(火) 0:00',
    articleText: fullText,
  });
  const title = adapter.getTitle(card);
  assert.notEqual(title, null);
  // 出版社名と日時を除いたタイトルが残る
  assert.ok(!title.includes('西スポWEB OTTO!'), `タイトルに出版社名が残っている: "${title}"`);
  assert.ok(!title.includes('8/11(火) 0:00'), `タイトルに日時が残っている: "${title}"`);
  assert.ok(title.length > 0);
});

test('yahoo_news: getTitleは記事リンクがなければnullを返す', () => {
  const adapter = loadAdapter();
  const card = makeCard({ hasArticleLink: false });
  const title = adapter.getTitle(card);
  assert.equal(title, null);
});

test('yahoo_news: siteKeyがyahoo_news', () => {
  const adapter = loadAdapter();
  assert.equal(adapter.siteKey, 'yahoo_news');
});

test('yahoo_news: cardSelectorがul.newsFeed_list>li', () => {
  const adapter = loadAdapter();
  assert.equal(adapter.cardSelector, 'ul.newsFeed_list > li');
});

test('yahoo_news: resolver.typeがdom_name', () => {
  const adapter = loadAdapter();
  assert.equal(adapter.resolver.type, 'dom_name');
});

test('yahoo_news: getWrapperはcardをそのまま返す', () => {
  const adapter = loadAdapter();
  const card = { tagName: 'LI' };
  assert.equal(adapter.getWrapper(card), card);
});
