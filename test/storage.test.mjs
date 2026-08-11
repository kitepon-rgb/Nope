// storage.js の focused test。chrome.storage を最小 mock して契約（設計メモ）を検証する。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const SRC = path.join(import.meta.dirname, '..', 'src', 'storage.js');

function chromeMock() {
  const areas = { sync: {}, local: {} };
  const listeners = [];
  const makeArea = (name) => ({
    async get(defaults) {
      const out = {};
      for (const key of Object.keys(defaults)) {
        out[key] = key in areas[name] ? areas[name][key] : defaults[key];
      }
      return out;
    },
    async set(values) {
      if (name === 'sync') {
        const changes = {};
        for (const key of Object.keys(values)) changes[key] = { oldValue: areas[name][key], newValue: values[key] };
        Object.assign(areas[name], values);
        if (Object.keys(changes).length) {
          for (const listener of listeners) listener(changes, 'sync');
        }
      } else {
        Object.assign(areas[name], values);
      }
    },
    async remove(key) { delete areas[name][key]; },
  });
  return {
    areas,
    listeners,
    chrome: {
      storage: {
        sync: makeArea('sync'),
        local: makeArea('local'),
        onChanged: {
          addListener(fn) { listeners.push(fn); },
          removeListener(fn) { listeners.splice(listeners.indexOf(fn), 1); },
        },
      },
    },
  };
}

function loadStorage(mock) {
  const context = vm.createContext({ chrome: mock.chrome, Date });
  vm.runInContext(readFileSync(SRC, 'utf8'), context);
  // const宣言はcontextのglobalに載らないため、context内で評価して取り出す。
  return vm.runInContext('CB_STORAGE', context);
}

test('blocklistはsyncへblockedSources[siteKey][sourceId]で保存し追加・削除できる', async () => {
  const mock = chromeMock();
  const storage = loadStorage(mock);
  await storage.addBlockedSource('aliexpress', '12345', 'Store A');
  const stored = mock.areas.sync.blockedSources;
  assert.equal(stored.aliexpress['12345'].name, 'Store A');
  assert.equal(typeof stored.aliexpress['12345'].addedAt, 'number');
  await storage.removeBlockedSource('aliexpress', '12345');
  // vm realm越しのobjectはprototypeが異なりdeepStrictEqualが使えないため、キーで比較する。
  assert.deepEqual(Object.keys(await storage.getBlockedSources('aliexpress')), []);
});

test('sourceIdは文字列制限なし（storeId数値制限は廃止）', async () => {
  const mock = chromeMock();
  const storage = loadStorage(mock);
  await storage.addBlockedSource('youtube', '@MagicClub686', 'Magic Club');
  assert.equal((await storage.getBlockedSources('youtube'))['@MagicClub686'].name, 'Magic Club');
});

test('nameOnly:trueエントリを保存できる', async () => {
  const mock = chromeMock();
  const storage = loadStorage(mock);
  await storage.addBlockedSource('yahoo_news', '西スポWEB OTTO!', '西スポWEB OTTO!', true);
  const entry = (await storage.getBlockedSources('yahoo_news'))['西スポWEB OTTO!'];
  assert.equal(entry.nameOnly, true);
});

test('siteKeyを分けてblocklistを管理できる', async () => {
  const mock = chromeMock();
  const storage = loadStorage(mock);
  await storage.addBlockedSource('aliexpress', '111', 'AliStore');
  await storage.addBlockedSource('rakuten', 'shopA', '楽天店A');
  assert.deepEqual(Object.keys(await storage.getBlockedSources('aliexpress')), ['111']);
  assert.deepEqual(Object.keys(await storage.getBlockedSources('rakuten')), ['shopA']);
  assert.deepEqual(Object.keys(await storage.getBlockedSources('amazon')), []);
});

test('cacheはlocalへ{siteKey}:{itemId}で保存し上限5000超過で挿入順の古いものから削る', async () => {
  const mock = chromeMock();
  const storage = loadStorage(mock);
  for (let index = 0; index < 5001; index += 1) {
    await storage.setCachedSource('aliexpress', `p${index}`, `s${index}`);
  }
  const cache = mock.areas.local.itemSourceCache;
  assert.equal(Object.keys(cache).length, 5000);
  assert.equal(await storage.getCachedSource('aliexpress', 'p0'), null);
  assert.equal(await storage.getCachedSource('aliexpress', 'p5000'), 's5000');
  await storage.clearCache();
  assert.equal(await storage.getCachedSource('aliexpress', 'p5000'), null);
});

test('getCachedSourceはsiteKeyが異なるキーを区別する', async () => {
  const mock = chromeMock();
  const storage = loadStorage(mock);
  await storage.setCachedSource('aliexpress', 'item1', 'store1');
  await storage.setCachedSource('amazon', 'item1', 'seller1');
  assert.equal(await storage.getCachedSource('aliexpress', 'item1'), 'store1');
  assert.equal(await storage.getCachedSource('amazon', 'item1'), 'seller1');
});

test('cacheは発信元名がある場合にIDと名称を一緒に保持する', async () => {
  const mock = chromeMock();
  const storage = loadStorage(mock);
  await storage.setCachedSource('amazon', 'B0MARKET', 'SELLER123', '対象出品者');
  const cached = await storage.getCachedSource('amazon', 'B0MARKET');
  assert.equal(cached.sourceId, 'SELLER123');
  assert.equal(cached.sourceName, '対象出品者');
});

test('onBlockedSourcesChangedはsync変更で発火し解除関数で止まる', async () => {
  const mock = chromeMock();
  const storage = loadStorage(mock);
  const seen = [];
  const unsubscribe = storage.onBlockedSourcesChanged('aliexpress', (value) => seen.push(value));
  await storage.addBlockedSource('aliexpress', '7', 'S');
  assert.equal(seen.length, 1);
  assert.equal(seen[0]['7'].name, 'S');
  unsubscribe();
  await storage.addBlockedSource('aliexpress', '8', 'T');
  assert.equal(seen.length, 1);
});

test('onBlockedSourcesChangedは対象siteKey以外の変更では発火しない', async () => {
  const mock = chromeMock();
  const storage = loadStorage(mock);
  const seen = [];
  storage.onBlockedSourcesChanged('aliexpress', (value) => seen.push(value));
  await storage.addBlockedSource('rakuten', 'shopA', '楽天店A');
  assert.equal(seen.length, 0);
});

test('getDisplayModeは未設定時に既定値placeholderを返す', async () => {
  const storage = loadStorage(chromeMock());
  assert.equal(await storage.getDisplayMode(), 'placeholder');
});

test('setDisplayModeで保存した値をgetDisplayModeが返す', async () => {
  const mock = chromeMock();
  const storage = loadStorage(mock);
  await storage.setDisplayMode('collapse');
  assert.equal(mock.areas.sync.displayMode, 'collapse');
  assert.equal(await storage.getDisplayMode(), 'collapse');
});

test('displayModeに不明値を渡すと既定値へフォールバックする', async () => {
  const mock = chromeMock();
  const storage = loadStorage(mock);
  await storage.setDisplayMode('bogus-mode');
  assert.equal(mock.areas.sync.displayMode, 'placeholder');
  assert.equal(await storage.getDisplayMode(), 'placeholder');
});

test('onDisplayModeChangedはsync変更で発火し解除関数で止まる', async () => {
  const mock = chromeMock();
  const storage = loadStorage(mock);
  const seen = [];
  const unsubscribe = storage.onDisplayModeChanged((value) => seen.push(value));
  await storage.setDisplayMode('collapse');
  assert.equal(seen.length, 1);
  assert.equal(seen[0], 'collapse');
  unsubscribe();
  await storage.setDisplayMode('placeholder');
  assert.equal(seen.length, 1);
});

// vm realm 越しの配列は Array.prototype が異なり deepStrictEqual が失敗するため、
// Array.from で変換してから比較する（オブジェクトの Object.keys 変換と同じ理由）。
test('getBlockedKeywordsは未設定時に空配列を返す', async () => {
  const storage = loadStorage(chromeMock());
  assert.deepEqual(Array.from(await storage.getBlockedKeywords('yahoo_news')), []);
});

test('addBlockedKeywordで追加したキーワードをgetBlockedKeywordsが返す', async () => {
  const mock = chromeMock();
  const storage = loadStorage(mock);
  await storage.addBlockedKeyword('yahoo_news', 'フェイクニュース');
  await storage.addBlockedKeyword('yahoo_news', 'PR');
  const keywords = Array.from(await storage.getBlockedKeywords('yahoo_news'));
  assert.deepEqual(keywords, ['フェイクニュース', 'PR']);
});

test('addBlockedKeywordは重複を無視する', async () => {
  const mock = chromeMock();
  const storage = loadStorage(mock);
  await storage.addBlockedKeyword('yahoo_news', 'PR');
  await storage.addBlockedKeyword('yahoo_news', 'PR');
  assert.equal((await storage.getBlockedKeywords('yahoo_news')).length, 1);
});

test('addBlockedKeywordはトリミングして保存する', async () => {
  const mock = chromeMock();
  const storage = loadStorage(mock);
  await storage.addBlockedKeyword('yahoo_news', '  広告  ');
  assert.deepEqual(Array.from(await storage.getBlockedKeywords('yahoo_news')), ['広告']);
});

test('addBlockedKeywordは空文字列を無視する', async () => {
  const mock = chromeMock();
  const storage = loadStorage(mock);
  await storage.addBlockedKeyword('yahoo_news', '   ');
  assert.deepEqual(Array.from(await storage.getBlockedKeywords('yahoo_news')), []);
});

test('removeBlockedKeywordで指定キーワードを削除できる', async () => {
  const mock = chromeMock();
  const storage = loadStorage(mock);
  await storage.addBlockedKeyword('yahoo_japan', 'キーワードA');
  await storage.addBlockedKeyword('yahoo_japan', 'キーワードB');
  await storage.removeBlockedKeyword('yahoo_japan', 'キーワードA');
  assert.deepEqual(Array.from(await storage.getBlockedKeywords('yahoo_japan')), ['キーワードB']);
});

test('removeBlockedKeywordは存在しないキーワードを渡してもエラーにならない', async () => {
  const mock = chromeMock();
  const storage = loadStorage(mock);
  await storage.removeBlockedKeyword('yahoo_news', '存在しない');
  assert.deepEqual(Array.from(await storage.getBlockedKeywords('yahoo_news')), []);
});

test('getBlockedKeywordsはsiteKeyごとに独立して管理される', async () => {
  const mock = chromeMock();
  const storage = loadStorage(mock);
  await storage.addBlockedKeyword('yahoo_news', 'ニュースワード');
  await storage.addBlockedKeyword('yahoo_japan', 'JAPANワード');
  assert.deepEqual(Array.from(await storage.getBlockedKeywords('yahoo_news')), ['ニュースワード']);
  assert.deepEqual(Array.from(await storage.getBlockedKeywords('yahoo_japan')), ['JAPANワード']);
});

test('onBlockedKeywordsChangedは対象siteKeyのキーワード変更で発火する', async () => {
  const mock = chromeMock();
  const storage = loadStorage(mock);
  const seen = [];
  const unsubscribe = storage.onBlockedKeywordsChanged('yahoo_news', (value) => seen.push(Array.from(value)));
  await storage.addBlockedKeyword('yahoo_news', 'テスト');
  assert.equal(seen.length, 1);
  assert.deepEqual(seen[0], ['テスト']);
  unsubscribe();
  await storage.addBlockedKeyword('yahoo_news', 'テスト2');
  assert.equal(seen.length, 1);
});

test('onBlockedKeywordsChangedは対象外siteKeyの変更で発火しない', async () => {
  const mock = chromeMock();
  const storage = loadStorage(mock);
  const seen = [];
  storage.onBlockedKeywordsChanged('yahoo_news', (value) => seen.push(value));
  await storage.addBlockedKeyword('yahoo_japan', '別サイト');
  assert.equal(seen.length, 0);
});

test('getAllBlockedSourcesは全サイトのblockedSourcesを返す', async () => {
  const mock = chromeMock();
  const storage = loadStorage(mock);
  await storage.addBlockedSource('aliexpress', '111', 'AliStore');
  await storage.addBlockedSource('rakuten', 'shopA', '楽天店A');
  const all = await storage.getAllBlockedSources();
  assert.equal(all.aliexpress['111'].name, 'AliStore');
  assert.equal(all.rakuten['shopA'].name, '楽天店A');
});

// sourceAlias（handle→チャンネルID等）はblockedSourcesと同じくsyncへ保存する
// （room裁定2026-08-11・[51]: localのitemSourceCacheは端末間で共有されないため不適）。
test('getSourceAliasesは未設定時に空オブジェクトを返す', async () => {
  const storage = loadStorage(chromeMock());
  assert.deepEqual(Object.keys(await storage.getSourceAliases('youtube')), []);
});

test('setSourceAliasはsyncへ保存しgetSourceAliasesが返す', async () => {
  const mock = chromeMock();
  const storage = loadStorage(mock);
  await storage.setSourceAlias('youtube', '@NASA', 'UCLA_DiR1FfKNvjuUpBHmylQ');
  assert.equal(mock.areas.sync.sourceAliases.youtube['@NASA'], 'UCLA_DiR1FfKNvjuUpBHmylQ');
  const aliases = await storage.getSourceAliases('youtube');
  assert.equal(aliases['@NASA'], 'UCLA_DiR1FfKNvjuUpBHmylQ');
});

test('setSourceAliasはsiteKeyを分けて管理する', async () => {
  const mock = chromeMock();
  const storage = loadStorage(mock);
  await storage.setSourceAlias('youtube', '@NASA', 'UC1');
  await storage.setSourceAlias('other_site', '@x', 'UC2');
  assert.deepEqual(Object.keys(await storage.getSourceAliases('youtube')), ['@NASA']);
  assert.deepEqual(Object.keys(await storage.getSourceAliases('other_site')), ['@x']);
});

test('onSourceAliasesChangedはsync変更で発火し解除関数で止まる', async () => {
  const mock = chromeMock();
  const storage = loadStorage(mock);
  const seen = [];
  const unsubscribe = storage.onSourceAliasesChanged('youtube', (value) => seen.push(value));
  await storage.setSourceAlias('youtube', '@NASA', 'UC1');
  assert.equal(seen.length, 1);
  assert.equal(seen[0]['@NASA'], 'UC1');
  unsubscribe();
  await storage.setSourceAlias('youtube', '@Other', 'UC2');
  assert.equal(seen.length, 1);
});

test('onSourceAliasesChangedは対象siteKey以外の変更では発火しない', async () => {
  const mock = chromeMock();
  const storage = loadStorage(mock);
  const seen = [];
  storage.onSourceAliasesChanged('youtube', (value) => seen.push(value));
  await storage.setSourceAlias('other_site', '@x', 'UC1');
  assert.equal(seen.length, 0);
});
