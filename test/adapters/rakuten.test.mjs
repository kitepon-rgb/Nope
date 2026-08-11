// 楽天市場アダプタ（src/adapters/rakuten.js）のユニットテスト。
// getSource のロジックだけを vm でサンドボックス実行して検証する。
// 実ブラウザでのDOM適用・CB_SEARCH連結は実地確認で担保する。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const SRC = path.join(import.meta.dirname, '..', '..', 'src', 'adapters', 'rakuten.js');

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

function makeCard(shopId, storeText = '楽天テスト店') {
  return {
    getAttribute(name) {
      return name === 'data-shop-id' ? shopId : null;
    },
    querySelector(selector) {
      if (selector === '.content.merchant' && storeText !== null) {
        return { textContent: storeText };
      }
      return null;
    },
  };
}

test('楽天: data-shop-idと店舗名を取得できる', () => {
  const adapter = loadAdapter();
  const card = makeCard('299852', 'スマホメモリ専門スターフォーカス');
  const result = adapter.resolver.getSource(card);
  assert.notEqual(result, null);
  assert.equal(result.sourceId, '299852');
  assert.equal(result.sourceName, 'スマホメモリ専門スターフォーカス');
});

test('楽天: CPC広告カードも共通のdata-shop-idから取得できる', () => {
  const adapter = loadAdapter();
  const card = makeCard('208080', 'マウスコンピューター 楽天市場店');
  const result = adapter.resolver.getSource(card);
  assert.equal(result.sourceId, '208080');
  assert.equal(result.sourceName, 'マウスコンピューター 楽天市場店');
});

test('楽天: data-shop-idが無ければnullを返す', () => {
  const adapter = loadAdapter();
  const card = makeCard(null);
  const result = adapter.resolver.getSource(card);
  assert.equal(result, null);
});

test('楽天: 店舗名が無ければdata-shop-idを表示名に使う', () => {
  const adapter = loadAdapter();
  const result = adapter.resolver.getSource(makeCard('320091', null));
  assert.equal(result.sourceId, '320091');
  assert.equal(result.sourceName, '320091');
});

test('楽天: siteKeyが正しい', () => {
  const adapter = loadAdapter();
  assert.equal(adapter.siteKey, 'rakuten');
});

test('楽天: matchesに search.rakuten.co.jp を含む', () => {
  const adapter = loadAdapter();
  assert.ok(adapter.matches.some((m) => m.includes('search.rakuten.co.jp')));
});

test('楽天: getWrapperはcardをそのまま返す', () => {
  const adapter = loadAdapter();
  const card = { tagName: 'DIV' };
  assert.equal(adapter.getWrapper(card), card);
});

test('楽天: resolver.typeがdom_id', () => {
  const adapter = loadAdapter();
  assert.equal(adapter.resolver.type, 'dom_id');
});

test('楽天: 検索カードからショップを登録するUI契約を持つ', () => {
  const adapter = loadAdapter();
  assert.equal(adapter.resolver.register.entityLabel, 'ショップ');
});
