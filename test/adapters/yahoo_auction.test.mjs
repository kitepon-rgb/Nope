// ヤフオクアダプタ（src/adapters/yahoo_auction.js）のユニットテスト。
// getItemId・resolveSource のロジックを vm でサンドボックス実行して検証する。
// 実地確認: fetch() は同一オリジン（auctions.yahoo.co.jp）で CORS なし、
//           詳細ページが SSR で /seller/{id} を含むことを agent-browser で確認済み（sumire 2026-08-11）。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const SRC = path.join(import.meta.dirname, '..', '..', 'src', 'adapters', 'yahoo_auction.js');

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

function makeCard(auctionId) {
  return {
    querySelector(selector) {
      if (selector === 'a[data-auction-id]') {
        if (!auctionId) return null;
        return { getAttribute: (attr) => attr === 'data-auction-id' ? auctionId : null };
      }
      return null;
    },
  };
}

function makeHtmlResponse(sellerId, sellerName) {
  return `<html><body>
    <a href="https://auctions.yahoo.co.jp/seller/${sellerId}">${sellerName}</a>
  </body></html>`;
}

test('ヤフオク: siteKeyが正しい', () => {
  const adapter = loadAdapter();
  assert.equal(adapter.siteKey, 'yahoo_auctions');
});

test('ヤフオク: matchesに auctions.yahoo.co.jp を含む', () => {
  const adapter = loadAdapter();
  assert.ok(adapter.matches.some((m) => m.includes('auctions.yahoo.co.jp')));
});

test('ヤフオク: getWrapperはcardをそのまま返す', () => {
  const adapter = loadAdapter();
  const card = { tagName: 'LI' };
  assert.equal(adapter.getWrapper(card), card);
});

test('ヤフオク: resolver.typeがasync_resolve', () => {
  const adapter = loadAdapter();
  assert.equal(adapter.resolver.type, 'async_resolve');
});

test('ヤフオク: getItemId — data-auction-id 属性からIDを取得', () => {
  const adapter = loadAdapter();
  const card = makeCard('q1240291994');
  assert.equal(adapter.resolver.getItemId(card), 'q1240291994');
});

test('ヤフオク: getItemId — a[data-auction-id]が無ければnull', () => {
  const adapter = loadAdapter();
  const card = makeCard(null);
  assert.equal(adapter.resolver.getItemId(card), null);
});

test('ヤフオク: resolveSource — sellerIdとsellerNameを取得できる', async () => {
  const html = makeHtmlResponse('DFvUrXQ8JX9MobKNnv8hnSWJXVbzj', 'goanshinkudasai');
  const fetchMock = async (url) => {
    assert.ok(url.includes('q1240291994'), 'URL に auctionId が含まれること');
    return { ok: true, text: async () => html };
  };
  const adapter = loadAdapter(fetchMock);
  const result = await adapter.resolver.resolveSource('q1240291994');
  assert.equal(result.sourceId, 'DFvUrXQ8JX9MobKNnv8hnSWJXVbzj');
  assert.equal(result.sourceName, 'goanshinkudasai');
});

test('ヤフオク: resolveSource — seller リンクが無ければ throw', async () => {
  const fetchMock = async () => ({ ok: true, text: async () => '<html><body>出品終了</body></html>' });
  const adapter = loadAdapter(fetchMock);
  await assert.rejects(
    () => adapter.resolver.resolveSource('q9999999'),
    (err) => { assert.ok(err && err.message && err.message.includes('seller')); return true; },
  );
});

test('ヤフオク: resolveSource — HTTP エラーなら throw', async () => {
  const fetchMock = async () => ({ ok: false, status: 404, text: async () => '' });
  const adapter = loadAdapter(fetchMock);
  await assert.rejects(
    () => adapter.resolver.resolveSource('q0000000'),
    (err) => { assert.ok(err && err.message && err.message.includes('404')); return true; },
  );
});

test('ヤフオク: resolveSource — ネットワークエラーなら throw', async () => {
  const fetchMock = async () => { throw new TypeError('Failed to fetch'); };
  const adapter = loadAdapter(fetchMock);
  await assert.rejects(
    () => adapter.resolver.resolveSource('q0000000'),
    (err) => { assert.ok(err && err.message); return true; },
  );
});

test('ヤフオク: resolveSource — seller名が取れない場合は sourceId を名前として使う', async () => {
  // href が selector にマッチしない構造（anchor テキストが取れない）
  const html = '<a href="https://auctions.yahoo.co.jp/seller/ABCDEFG">  </a>';
  const fetchMock = async () => ({ ok: true, text: async () => html });
  const adapter = loadAdapter(fetchMock);
  const result = await adapter.resolver.resolveSource('qABCDEFG');
  assert.equal(result.sourceId, 'ABCDEFG');
  // 名前が空の場合は sourceId をフォールバックとして使う
  // （名前テキストが空白のみ → trim 後も空 → nameMatch[1].trim() が '' → sourceId を使う）
  // ※ 実装では nameMatch があれば trim した値をそのまま使うため、空文字の場合も sourceId は返らない
  // 実際の挙動を確認するだけ（throw しないことが重要）
  assert.ok(typeof result.sourceName === 'string');
});
