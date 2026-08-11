// YouTube アダプタ（src/adapters/youtube.js）のユニットテスト。
// getSource のロジックだけを vm でサンドボックス実行して検証する。
// 実ブラウザでのDOM適用・CB_SEARCH連結は実地確認で担保する。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const SRC = path.join(import.meta.dirname, '..', '..', 'src', 'adapters', 'youtube.js');

function loadAdapter({ fetch: fetchImpl } = {}) {
  let captured = null;
  const context = vm.createContext({
    console,
    fetch: fetchImpl,
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

// room裁定2026-08-11・bell実測[86]: ホームの実カードはytd-video-rendererではなく
// ytd-rich-item-renderer（オーナーのログイン済みホームでytd-video-renderer=0件と判明・差し戻し）。
// 検索結果とホームを1つのadapterで拾うため両方を含む。
test('YouTube: cardSelectorは検索結果(ytd-video-renderer)とホーム(ytd-rich-item-renderer)の両方を含む', () => {
  const adapter = loadAdapter();
  assert.equal(adapter.cardSelector, 'ytd-video-renderer, ytd-rich-item-renderer');
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

// docs/design-youtube-surfaces.md §2/§4-A: handle→UC正規化。plan成功条件2「片方だけ再出現する
// 状態を許さない」をUC正本化で満たす（room裁定[45][47][48]）。
test('YouTube: canonicalizeはUC形式をfetchせずそのまま返す', async () => {
  let fetchCalled = false;
  const adapter = loadAdapter({ fetch: async () => { fetchCalled = true; } });
  const result = await adapter.resolver.canonicalize('UCMJEnW8naproLde7E2GInhw');
  assert.equal(result, 'UCMJEnW8naproLde7E2GInhw');
  assert.equal(fetchCalled, false);
});

test('YouTube: canonicalizeはhandle形式を実チャンネル応答のcanonical linkからUC IDへ解決する', async () => {
  const html = '<html><head><link rel="canonical" href="https://www.youtube.com/channel/UCLA_DiR1FfKNvjuUpBHmylQ"></head></html>';
  let requestedUrl = null;
  const adapter = loadAdapter({
    fetch: async (url) => {
      requestedUrl = url;
      return { ok: true, text: async () => html };
    },
  });
  const result = await adapter.resolver.canonicalize('@NASA');
  assert.equal(result, 'UCLA_DiR1FfKNvjuUpBHmylQ');
  assert.equal(requestedUrl, 'https://www.youtube.com/@NASA');
});

test('YouTube: canonicalizeはfetch失敗時にthrowする（部分登録へのフォールバック禁止）', async () => {
  const adapter = loadAdapter({ fetch: async () => { throw new Error('network down'); } });
  await assert.rejects(() => adapter.resolver.canonicalize('@NASA'), /fetchに失敗/);
});

test('YouTube: canonicalizeはHTTPエラー応答時にthrowする', async () => {
  const adapter = loadAdapter({ fetch: async () => ({ ok: false, status: 404, text: async () => '' }) });
  await assert.rejects(() => adapter.resolver.canonicalize('@NASA'), /HTTPエラー/);
});

test('YouTube: canonicalizeはcanonical linkが無い応答ではthrowする（表示名等への推測フォールバック禁止）', async () => {
  const adapter = loadAdapter({ fetch: async () => ({ ok: true, text: async () => '<html>no canonical here</html>' }) });
  await assert.rejects(() => adapter.resolver.canonicalize('@NASA'), /canonical linkが見つかりません/);
});

// room裁定[55][58]: UC起点のブロックでも逆方向（UC→handle）を解決してaliasを学習しないと、
// 同じチャンネルが後でhandle形式カードとして現れた時に「片方だけ再出現する」。
test('YouTube: findHandleAliasはUC IDから実チャンネル応答のcanonicalBaseUrlでhandleへ解決する', async () => {
  const html = '<html><body>...."canonicalBaseUrl":"/@NASA"....</body></html>';
  let requestedUrl = null;
  const adapter = loadAdapter({
    fetch: async (url) => {
      requestedUrl = url;
      return { ok: true, text: async () => html };
    },
  });
  const result = await adapter.resolver.findHandleAlias('UCLA_DiR1FfKNvjuUpBHmylQ');
  assert.equal(result, '@NASA');
  assert.equal(requestedUrl, 'https://www.youtube.com/channel/UCLA_DiR1FfKNvjuUpBHmylQ');
});

test('YouTube: findHandleAliasはfetch失敗時にthrowする（部分登録へのフォールバック禁止）', async () => {
  const adapter = loadAdapter({ fetch: async () => { throw new Error('network down'); } });
  await assert.rejects(() => adapter.resolver.findHandleAlias('UC1'), /fetchに失敗/);
});

test('YouTube: findHandleAliasはHTTPエラー応答時にthrowする', async () => {
  const adapter = loadAdapter({ fetch: async () => ({ ok: false, status: 404, text: async () => '' }) });
  await assert.rejects(() => adapter.resolver.findHandleAlias('UC1'), /HTTPエラー/);
});

test('YouTube: findHandleAliasはcanonicalBaseUrlが無い応答ではthrowする（handle不在と推測しない・bell裁定[58]）', async () => {
  const adapter = loadAdapter({ fetch: async () => ({ ok: true, text: async () => '<html>no canonicalBaseUrl here</html>' }) });
  await assert.rejects(() => adapter.resolver.findHandleAlias('UC1'), /canonicalBaseUrlが見つかりません/);
});

// room裁定2026-08-11・bell実測[86]（オーナー実Chromeでの差し戻し）: ホームには#dismissibleが無い。
test('YouTube: register.anchorは#dismissibleを優先し、無ければ#contentへフォールバックする', () => {
  const adapter = loadAdapter();
  const dismissibleCard = { querySelector: (sel) => (sel === '#dismissible' ? { tag: 'dismissible-el' } : null) };
  const contentOnlyCard = { querySelector: (sel) => (sel === '#content' ? { tag: 'content-el' } : null) };
  const neitherCard = { querySelector: () => null };
  assert.equal(adapter.resolver.register.anchor(dismissibleCard).tag, 'dismissible-el');
  assert.equal(adapter.resolver.register.anchor(contentOnlyCard).tag, 'content-el');
  assert.equal(adapter.resolver.register.anchor(neitherCard), null);
});
