// Yahoo! JAPAN アダプタ（src/adapters/yahoo_japan.js）のユニットテスト。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const SRC = path.join(import.meta.dirname, '..', '..', 'src', 'adapters', 'yahoo_japan.js');

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

function makeCard({ citeText, h1Text } = {}) {
  return {
    querySelector(selector) {
      if (selector === 'cite') {
        if (citeText === undefined) return null;
        return { textContent: citeText };
      }
      if (selector === 'h1') {
        if (h1Text === undefined) return null;
        return { textContent: h1Text };
      }
      return null;
    },
  };
}

test('yahoo_japan: citeテキストをsourceNameとして返す', () => {
  const adapter = loadAdapter();
  const card = makeCard({ citeText: 'TRILL ニュース' });
  const result = adapter.resolver.getSource(card);
  assert.notEqual(result, null);
  assert.equal(result.sourceName, 'TRILL ニュース');
});

test('yahoo_japan: cite要素がなければnullを返す', () => {
  const adapter = loadAdapter();
  const card = makeCard({});
  const result = adapter.resolver.getSource(card);
  assert.equal(result, null);
});

test('yahoo_japan: citeテキストが空ならnullを返す', () => {
  const adapter = loadAdapter();
  const card = makeCard({ citeText: '   ' });
  const result = adapter.resolver.getSource(card);
  assert.equal(result, null);
});

test('yahoo_japan: getTitleはh1テキストを返す', () => {
  const adapter = loadAdapter();
  const card = makeCard({ citeText: 'ねとらぼ', h1Text: 'ヒマワリ迷路' });
  const title = adapter.getTitle(card);
  assert.equal(title, 'ヒマワリ迷路');
});

test('yahoo_japan: getTitleはh1がなければnullを返す', () => {
  const adapter = loadAdapter();
  const card = makeCard({ citeText: 'ねとらぼ' });
  const title = adapter.getTitle(card);
  assert.equal(title, null);
});

test('yahoo_japan: getTitleはh1テキストが空ならnullを返す', () => {
  const adapter = loadAdapter();
  const card = makeCard({ citeText: 'ねとらぼ', h1Text: '   ' });
  const title = adapter.getTitle(card);
  assert.equal(title, null);
});

test('yahoo_japan: siteKeyがyahoo_japan', () => {
  const adapter = loadAdapter();
  assert.equal(adapter.siteKey, 'yahoo_japan');
});

test('yahoo_japan: cardSelectorがarticle:has(cite):not(:has(article))', () => {
  const adapter = loadAdapter();
  assert.equal(adapter.cardSelector, 'article:has(cite):not(:has(article))');
});

test('yahoo_japan: resolver.typeがdom_name', () => {
  const adapter = loadAdapter();
  assert.equal(adapter.resolver.type, 'dom_name');
});

test('yahoo_japan: getWrapperはcardをそのまま返す', () => {
  const adapter = loadAdapter();
  const card = { tagName: 'ARTICLE' };
  assert.equal(adapter.getWrapper(card), card);
});
