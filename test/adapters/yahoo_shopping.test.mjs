// Yahoo!ショッピングアダプタ（src/adapters/yahoo_shopping.js）のユニットテスト。
// getSource のロジックだけを vm でサンドボックス実行して検証する。
// 実ブラウザでのDOM適用・CB_SEARCH連結は実地確認で担保する。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const SRC = path.join(import.meta.dirname, '..', '..', 'src', 'adapters', 'yahoo_shopping.js');

function loadAdapter() {
  let captured = null;
  const context = vm.createContext({
    console,
    CB_SEARCH: {
      init(opts) { captured = opts.adapter; return { start() {} }; },
    },
  });
  vm.runInContext(readFileSync(SRC, 'utf8'), context);
  return captured;
}

function makeCard(storeHref, storeText = 'テストストア') {
  return {
    querySelector(selector) {
      if (selector === 'a[href^="https://store.shopping.yahoo.co.jp/"][href$="/"]') {
        if (!storeHref) return null;
        return {
          href: storeHref,
          textContent: storeText,
        };
      }
      return null;
    },
  };
}

test('Yahoo!ショッピング: ストアIDと店舗名を取得できる', () => {
  const adapter = loadAdapter();
  const card = makeCard('https://store.shopping.yahoo.co.jp/smahoservic/', 'L&Lスマホサービス');
  const result = adapter.resolver.getSource(card);
  assert.notEqual(result, null);
  assert.equal(result.sourceId, 'smahoservic');
  assert.equal(result.sourceName, 'L&Lスマホサービス');
});

test('Yahoo!ショッピング: 広告カード（直リンクなし）はnullを返す', () => {
  const adapter = loadAdapter();
  // 広告カードには store.shopping.yahoo.co.jp 直リンクがない
  const card = makeCard(null);
  const result = adapter.resolver.getSource(card);
  assert.equal(result, null);
});

test('Yahoo!ショッピング: 別ドメインのリンクはnullを返す', () => {
  const adapter = loadAdapter();
  // リダイレクト系（shopping-item-reach.yahoo.co.jp）→ querySelector で null になる
  const card = {
    querySelector(selector) {
      // 条件を満たすリンクが無いケース
      return null;
    },
  };
  const result = adapter.resolver.getSource(card);
  assert.equal(result, null);
});

test('Yahoo!ショッピング: siteKeyが正しい', () => {
  const adapter = loadAdapter();
  assert.equal(adapter.siteKey, 'yahoo_shopping');
});

test('Yahoo!ショッピング: matchesに shopping.yahoo.co.jp を含む', () => {
  const adapter = loadAdapter();
  assert.ok(adapter.matches.some((m) => m.includes('shopping.yahoo.co.jp')));
});

test('Yahoo!ショッピング: getWrapperはcardをそのまま返す', () => {
  const adapter = loadAdapter();
  const card = { tagName: 'DIV' };
  assert.equal(adapter.getWrapper(card), card);
});

test('Yahoo!ショッピング: resolver.typeがdom_id', () => {
  const adapter = loadAdapter();
  assert.equal(adapter.resolver.type, 'dom_id');
});

test('Yahoo!ショッピング: cardSelectorにSearchResult_SearchResultItemを含む', () => {
  const adapter = loadAdapter();
  assert.ok(adapter.cardSelector.includes('SearchResult_SearchResultItem'));
});
