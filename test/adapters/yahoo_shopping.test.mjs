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
    URL,
    CB_SEARCH: {
      init(opts) { captured = opts.adapter; return { start() {} }; },
    },
  });
  vm.runInContext(readFileSync(SRC, 'utf8'), context);
  return captured;
}

function makeCard(storeHref, storeText = 'テストストア') {
  const links = [];
  if (storeHref) {
    links.push({ href: storeHref, textContent: '' });
    const storeId = /store\.shopping\.yahoo\.co\.jp\/([^/]+)\//.exec(storeHref)?.[1];
    if (storeId) {
      links.push({
        href: `https://store.shopping.yahoo.co.jp/${storeId}/?sc_i=store`,
        textContent: storeText,
      });
    }
  }
  return {
    querySelectorAll(selector) {
      if (selector === 'a[href^="https://store.shopping.yahoo.co.jp/"]') {
        return links;
      }
      return [];
    },
  };
}

test('Yahoo!ショッピング: ストアIDと店舗名を取得できる', () => {
  const adapter = loadAdapter();
  const card = makeCard(
    'https://store.shopping.yahoo.co.jp/smahoservic/lz-70512.html?sc_i=shopping-pc-web-result-item',
    'L&Lスマホサービス',
  );
  const result = adapter.resolver.getSource(card);
  assert.notEqual(result, null);
  assert.equal(result.sourceId, 'smahoservic');
  assert.equal(result.sourceName, 'L&Lスマホサービス');
});

test('Yahoo!ショッピング: 商品リンクではなくストアホームの表示名を使う', () => {
  const adapter = loadAdapter();
  const card = {
    querySelectorAll() {
      return [
        {
          href: 'https://store.shopping.yahoo.co.jp/thanksjp/item.html?sc_i=img',
          textContent: '',
        },
        {
          href: 'https://store.shopping.yahoo.co.jp/thanksjp/item.html?sc_i=title',
          textContent: '商品タイトル',
        },
        {
          href: 'https://store.shopping.yahoo.co.jp/thanksjp/?sc_i=store',
          textContent: 'サンクスジェピ',
        },
      ];
    },
  };

  assert.deepEqual(
    { ...adapter.resolver.getSource(card) },
    { sourceId: 'thanksjp', sourceName: 'サンクスジェピ' },
  );
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
    querySelectorAll(selector) {
      // 条件を満たすリンクが無いケース
      return [];
    },
  };
  const result = adapter.resolver.getSource(card);
  assert.equal(result, null);
});

test('Yahoo!ショッピング: siteKeyが正しい', () => {
  const adapter = loadAdapter();
  assert.equal(adapter.siteKey, 'yahoo_shopping');
});

test('Yahoo!ショッピング: 検索面だけを対象とし商品詳細面を除外する', () => {
  const adapter = loadAdapter();

  assert.equal(adapter.isTargetPage({ pathname: '/search' }), true);
  assert.equal(adapter.isTargetPage({ pathname: '/search/%E3%83%A1%E3%83%A2%E3%83%AA/0/' }), true);
  assert.equal(adapter.isTargetPage({ pathname: '/products/example' }), false);
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

test('Yahoo!ショッピング: 検索結果直下の商品カードだけを対象にする', () => {
  const adapter = loadAdapter();
  assert.equal(
    adapter.cardSelector,
    'div[class*="SearchResult_SearchResult__"] > div[class^="SearchResult_SearchResultItem__"]',
  );
});

test('Yahoo!ショッピング: 検索カードからショップを登録するUI契約を持つ', () => {
  const adapter = loadAdapter();
  assert.equal(adapter.resolver.register.entityLabel, 'ショップ');
});
