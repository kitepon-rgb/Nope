// YouTube アダプタ（src/adapters/youtube.js）のユニットテスト。
// getSource のロジックだけを vm でサンドボックス実行して検証する。
// 実ブラウザでのDOM適用・CB_SEARCH連結は実地確認で担保する。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const SRC = path.join(import.meta.dirname, '..', '..', 'src', 'adapters', 'youtube.js');

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

// handle形式 (/@handle) と UC形式 (/channel/UC...) の両パターンで querySelector を模倣する。
function makeCard({ handleHref, handleText, ucHref, ucText } = {}) {
  return {
    querySelector(selector) {
      if (selector === 'a[href*="/@"]') {
        if (!handleHref) return null;
        return {
          getAttribute: (attr) => attr === 'href' ? handleHref : null,
          textContent: handleText || '',
        };
      }
      if (selector === 'a[href*="/channel/"]') {
        if (!ucHref) return null;
        return {
          getAttribute: (attr) => attr === 'href' ? ucHref : null,
          textContent: ucText || '',
        };
      }
      return null;
    },
  };
}

test('YouTube: handle形式からsourceIdを取得できる', () => {
  const adapter = loadAdapter();
  const card = makeCard({ handleHref: '/@MagicClub686', handleText: 'Magic Club' });
  const result = adapter.resolver.getSource(card);
  assert.notEqual(result, null);
  assert.equal(result.sourceId, '@MagicClub686');
  assert.equal(result.sourceName, 'Magic Club');
});

test('YouTube: UC形式からsourceIdを取得できる', () => {
  const adapter = loadAdapter();
  const card = makeCard({ ucHref: '/channel/UCMJEnW8naproLde7E2GInhw', ucText: 'MELLOW SPOT' });
  const result = adapter.resolver.getSource(card);
  assert.notEqual(result, null);
  assert.equal(result.sourceId, 'UCMJEnW8naproLde7E2GInhw');
  assert.equal(result.sourceName, 'MELLOW SPOT');
});

test('YouTube: handle形式が優先される（両方あればhandle）', () => {
  const adapter = loadAdapter();
  // 同一カードにboth形式がある場合（実測では0件だが、ロジックの優先順を保証する）
  const card = makeCard({
    handleHref: '/@HandleChannel',
    handleText: 'Handle Channel',
    ucHref: '/channel/UCxxxxxx',
    ucText: 'UC Channel',
  });
  const result = adapter.resolver.getSource(card);
  assert.notEqual(result, null);
  assert.equal(result.sourceId, '@HandleChannel');
  assert.equal(result.sourceName, 'Handle Channel');
});

test('YouTube: チャンネルリンクが無ければnullを返す', () => {
  const adapter = loadAdapter();
  const card = makeCard({});
  const result = adapter.resolver.getSource(card);
  assert.equal(result, null);
});

test('YouTube: hrefが/@で始まらない場合はUCにフォールバック', () => {
  const adapter = loadAdapter();
  // querySelector は /@MagicClub686 を返すがhrefがマッチしない形式の場合
  const card = {
    querySelector(selector) {
      if (selector === 'a[href*="/@"]') {
        // href に /@ が含まれているが正規表現 /^\/@/ にはマッチしない（絶対URL形式）
        return {
          getAttribute: () => 'https://www.youtube.com/@MagicClub686',
          textContent: 'Magic Club',
        };
      }
      if (selector === 'a[href*="/channel/"]') {
        return {
          getAttribute: () => '/channel/UCMJEnW8naproLde7E2GInhw',
          textContent: 'MELLOW SPOT',
        };
      }
      return null;
    },
  };
  // 絶対URL形式は /^\/@/ にマッチしないのでUCへフォールバック
  const result = adapter.resolver.getSource(card);
  assert.notEqual(result, null);
  assert.equal(result.sourceId, 'UCMJEnW8naproLde7E2GInhw');
  assert.equal(result.sourceName, 'MELLOW SPOT');
});

test('YouTube: siteKeyが正しい', () => {
  const adapter = loadAdapter();
  assert.equal(adapter.siteKey, 'youtube');
});

test('YouTube: matchesに www.youtube.com を含む', () => {
  const adapter = loadAdapter();
  assert.ok(adapter.matches.some((m) => m.includes('youtube.com')));
});

test('YouTube: cardSelectorがytd-video-renderer', () => {
  const adapter = loadAdapter();
  assert.equal(adapter.cardSelector, 'ytd-video-renderer');
});

test('YouTube: getWrapperはcardをそのまま返す', () => {
  const adapter = loadAdapter();
  const card = { tagName: 'YTD-VIDEO-RENDERER' };
  assert.equal(adapter.getWrapper(card), card);
});

test('YouTube: resolver.typeがdom_id', () => {
  const adapter = loadAdapter();
  assert.equal(adapter.resolver.type, 'dom_id');
});
