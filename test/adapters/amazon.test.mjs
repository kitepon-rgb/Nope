// Amazonアダプタ（src/adapters/amazon.js）のユニットテスト。
// getItemId・resolveSource のロジックを vm でサンドボックス実行して検証する。
// 実地確認: fetch() は同一オリジン（www.amazon.co.jp）で CORS なし、
//           SSR HTML に &amp;seller={id} と id="sellerProfileTriggerId" が含まれることを
//           agent-browser で確認済み（sumire 2026-08-11）。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const SRC = path.join(import.meta.dirname, '..', '..', 'src', 'adapters', 'amazon.js');

function loadAdapter(fetchImpl) {
  let captured = null;
  const context = vm.createContext({
    console,
    fetch: fetchImpl || (() => Promise.reject(new Error('fetch not mocked'))),
    CB_SEARCH: {
      init(opts) { captured = opts.adapter; return { start() {} }; },
    },
  });
  vm.runInContext(readFileSync(SRC, 'utf8'), context);
  return captured;
}

function makeCard(asin) {
  return {
    getAttribute: (attr) => attr === 'data-asin' ? (asin || null) : null,
  };
}

// Amazon 実測レスポンスに近い HTML 断片
function makeAmazonHtml(sellerId, sellerName) {
  return `<html><body>
    <a href='/gp/help/seller/at-a-glance.html/ref=dp_merchant_link?ie=UTF8&amp;seller=${sellerId}&amp;asin=B0CT857V89&amp;ref_=dp_merchant_link&amp;isAmazonFulfilled=1'
       id='sellerProfileTriggerId' class='a-size-small a-link-normal'>${sellerName}</a>
  </body></html>`;
}

test('Amazon: siteKeyが正しい', () => {
  const adapter = loadAdapter();
  assert.equal(adapter.siteKey, 'amazon');
});

test('Amazon: matchesに www.amazon.co.jp を含む', () => {
  const adapter = loadAdapter();
  assert.ok(adapter.matches.some((m) => m.includes('amazon.co.jp')));
});

test('Amazon: getWrapperはcardをそのまま返す', () => {
  const adapter = loadAdapter();
  const card = { tagName: 'DIV' };
  assert.equal(adapter.getWrapper(card), card);
});

test('Amazon: resolver.typeがasync_resolve', () => {
  const adapter = loadAdapter();
  assert.equal(adapter.resolver.type, 'async_resolve');
});

test('Amazon: getItemId — data-asin 属性から ASIN を取得', () => {
  const adapter = loadAdapter();
  const card = makeCard('B0CT857V89');
  assert.equal(adapter.resolver.getItemId(card), 'B0CT857V89');
});

test('Amazon: getItemId — data-asin が無ければ null', () => {
  const adapter = loadAdapter();
  const card = makeCard(null);
  assert.equal(adapter.resolver.getItemId(card), null);
});

test('Amazon: resolveSource — sellerIdとsellerNameを取得できる', async () => {
  const html = makeAmazonHtml('A3EMK34PT3V85P', 'HK-JIMI');
  const fetchMock = async (url) => {
    assert.ok(url.includes('B0CT857V89'), 'URL に ASIN が含まれること');
    return { ok: true, text: async () => html };
  };
  const adapter = loadAdapter(fetchMock);
  const result = await adapter.resolver.resolveSource('B0CT857V89');
  assert.equal(result.sourceId, 'A3EMK34PT3V85P');
  assert.equal(result.sourceName, 'HK-JIMI');
});

test('Amazon: resolveSource — &amp; でなく ? でも sellerId を取得できる', async () => {
  // ?seller= 形式のパターンも許容（実装の堅牢性確認）
  const html = `<html><body>
    <a href='?seller=ABCDEFGHIJ12' id='sellerProfileTriggerId'>テスト販売者</a>
  </body></html>`;
  const fetchMock = async () => ({ ok: true, text: async () => html });
  const adapter = loadAdapter(fetchMock);
  const result = await adapter.resolver.resolveSource('B0XXXXXXXX');
  assert.equal(result.sourceId, 'ABCDEFGHIJ12');
  assert.equal(result.sourceName, 'テスト販売者');
});

test('Amazon: resolveSource — seller ID が無ければ throw', async () => {
  const html = '<html><body><p>商品が見つかりません</p></body></html>';
  const fetchMock = async () => ({ ok: true, text: async () => html });
  const adapter = loadAdapter(fetchMock);
  await assert.rejects(
    () => adapter.resolver.resolveSource('B0NOTFOUND'),
    (err) => { assert.ok(err && err.message && err.message.includes('seller ID')); return true; },
  );
});

test('Amazon: resolveSource — HTTP エラーなら throw', async () => {
  const fetchMock = async () => ({ ok: false, status: 503, text: async () => '' });
  const adapter = loadAdapter(fetchMock);
  await assert.rejects(
    () => adapter.resolver.resolveSource('B0XXXXXXXX'),
    (err) => { assert.ok(err && err.message && err.message.includes('503')); return true; },
  );
});

test('Amazon: resolveSource — ネットワークエラーなら throw', async () => {
  const fetchMock = async () => { throw new TypeError('Failed to fetch'); };
  const adapter = loadAdapter(fetchMock);
  await assert.rejects(
    () => adapter.resolver.resolveSource('B0XXXXXXXX'),
    (err) => { assert.ok(err && err.message); return true; },
  );
});

test('Amazon: resolveSource — sellerProfileTriggerId が無い場合は sourceId を名前として使う', async () => {
  // id="sellerProfileTriggerId" が無い HTML（sellerName が取れない）
  const html = `<html><body>
    <a href='?seller=A3EMK34PT3V85P'>販売者</a>
  </body></html>`;
  const fetchMock = async () => ({ ok: true, text: async () => html });
  const adapter = loadAdapter(fetchMock);
  const result = await adapter.resolver.resolveSource('B0CT857V89');
  assert.equal(result.sourceId, 'A3EMK34PT3V85P');
  assert.equal(result.sourceName, 'A3EMK34PT3V85P');
});
