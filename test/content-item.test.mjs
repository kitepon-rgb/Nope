// content-item.js の純粋ロジック（storeId/店名抽出、リンク探索）を検証する。
// 実ブラウザでのDOM注入・MutationObserver統合は agent-browser による実地確認で担保する（CLAUDE.md参照）。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const SRC = path.join(import.meta.dirname, '..', 'src', 'content-item.js');

class FakeMutationObserver {
  observe() {}
  disconnect() {}
}

function loadContentItem() {
  const context = vm.createContext({
    document: {
      querySelectorAll: () => [],
      body: {},
      createElement: () => ({ style: {}, addEventListener() {} }),
    },
    MutationObserver: FakeMutationObserver,
    CB_STORAGE: { getBlockedStores: async () => ({}) },
  });
  vm.runInContext(readFileSync(SRC, 'utf8'), context);
  return vm.runInContext('CB_ITEM', context);
}

test('extractStoreIdはhref中の/store/<id>を取り出す', () => {
  const item = loadContentItem();
  assert.equal(item.extractStoreId('https://ja.aliexpress.com/store/1100223114'), '1100223114');
  assert.equal(item.extractStoreId('//ja.aliexpress.com/store/1100223114'), '1100223114');
  assert.equal(item.extractStoreId('https://ja.aliexpress.com/item/123.html'), null);
});

test('extractStoreNameは「販売者」接頭辞を除去する', () => {
  const item = loadContentItem();
  assert.equal(item.extractStoreName({ textContent: '販売者NailNest Store' }, '1100223114'), 'NailNest Store');
  assert.equal(item.extractStoreName({ textContent: 'NailNest Store' }, '1100223114'), 'NailNest Store');
});

test('extractStoreNameはテキストが空ならstoreIdからフォールバック名を作る', () => {
  const item = loadContentItem();
  assert.equal(item.extractStoreName({ textContent: '' }, '1100223114'), 'store:1100223114');
});

test('findStoreLinkは最初にstoreIdが取れるリンクを返す', () => {
  const item = loadContentItem();
  const links = [
    { getAttribute: () => '/other/page', textContent: '' },
    { getAttribute: () => '//ja.aliexpress.com/store/1100223114', textContent: '販売者NailNest Store' },
    { getAttribute: () => '//ja.aliexpress.com/store/1100223114', textContent: 'NailNest Store' },
  ];
  const found = item.findStoreLink({ querySelectorAll: () => links });
  assert.equal(found.storeId, '1100223114');
  assert.equal(found.name, 'NailNest Store');
  assert.equal(found.link, links[1]);
});

test('findStoreLinkはstoreリンクが無ければnullを返す', () => {
  const item = loadContentItem();
  const found = item.findStoreLink({ querySelectorAll: () => [{ getAttribute: () => '/item/123.html', textContent: '' }] });
  assert.equal(found, null);
});
