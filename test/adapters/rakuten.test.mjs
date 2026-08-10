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

function makeCard(storeHref, storeText = '楽天テスト店') {
  return {
    querySelector(selector) {
      if (selector === 'a[href^="https://www.rakuten.co.jp/"][href$="/"]') {
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

test('楽天: ショップslugと店舗名を取得できる', () => {
  const adapter = loadAdapter();
  const card = makeCard('https://www.rakuten.co.jp/aidort/', '愛度楽天市場店');
  const result = adapter.resolver.getSource(card);
  assert.notEqual(result, null);
  assert.equal(result.sourceId, 'aidort');
  assert.equal(result.sourceName, '愛度楽天市場店');
});

test('楽天: ストアリンクが無ければnullを返す', () => {
  const adapter = loadAdapter();
  const card = makeCard(null);
  const result = adapter.resolver.getSource(card);
  assert.equal(result, null);
});

test('楽天: URLのパターンにマッチしなければnullを返す', () => {
  const adapter = loadAdapter();
  // href はある（selector条件を通す）が、slug が抜けない形式
  const card = {
    querySelector(selector) {
      if (selector === 'a[href^="https://www.rakuten.co.jp/"][href$="/"]') {
        return { href: 'https://www.rakuten.co.jp/', textContent: '楽天市場' };
      }
      return null;
    },
  };
  const result = adapter.resolver.getSource(card);
  assert.equal(result, null);
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
