// popup.js の純粋ロジック（入力パース・並び替え）を検証する。
// 実際のDOM描画・拡張ロードはブラウザ実測停止指示により保留（CLAUDE.md参照）。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const SRC = path.join(import.meta.dirname, '..', 'popup', 'popup.js');

function makeFakeElement() {
  const listeners = {};
  const el = {
    textContent: '',
    children: [],
    append(...items) { el.children.push(...items); },
    addEventListener(type, handler) { listeners[type] = handler; },
    fireClick() { return listeners.click(); },
  };
  return el;
}

function makeFakeListEl() {
  const el = makeFakeElement();
  el.replaceChildren = () => { el.children = []; };
  return el;
}

function makeFakeStorage(initialBlocked) {
  let blocked = { ...initialBlocked };
  return {
    async getBlockedStores() { return { ...blocked }; },
    async removeBlockedStore(storeId) { delete blocked[storeId]; },
  };
}

function loadPopup(storage) {
  const context = vm.createContext({
    document: {
      getElementById: () => makeFakeListEl(),
      createElement: () => makeFakeElement(),
    },
    CB_STORAGE: storage ?? { getBlockedStores: async () => ({}) },
  });
  vm.runInContext(readFileSync(SRC, 'utf8'), context);
  return vm.runInContext('CB_POPUP', context);
}

test('parseStoreInputはストアURLから数値IDを取り出す', () => {
  const popup = loadPopup();
  assert.equal(popup.parseStoreInput('https://ja.aliexpress.com/store/1100223114'), '1100223114');
  assert.equal(popup.parseStoreInput('//ja.aliexpress.com/store/1100223114?spm=x'), '1100223114');
});

test('parseStoreInputは数値IDのみの入力もそのまま受け付ける', () => {
  const popup = loadPopup();
  assert.equal(popup.parseStoreInput('  1100223114  '), '1100223114');
});

test('parseStoreInputはIDを含まない入力にnullを返す', () => {
  const popup = loadPopup();
  assert.equal(popup.parseStoreInput('not a store'), null);
  assert.equal(popup.parseStoreInput(''), null);
});

test('sortEntriesはaddedAt降順に並べる', () => {
  const popup = loadPopup();
  const blocked = {
    100: { name: 'old', addedAt: 1000 },
    200: { name: 'new', addedAt: 3000 },
    300: { name: 'mid', addedAt: 2000 },
  };
  const sorted = popup.sortEntries(blocked);
  assert.deepEqual(Array.from(sorted, ([id]) => id), ['200', '300', '100']);
});

test('formatDateは文字列を返す', () => {
  const popup = loadPopup();
  const formatted = popup.formatDate(1786000000000);
  assert.equal(typeof formatted, 'string');
  assert.ok(formatted.length > 0);
});

test('renderListは空なら「ブロック中のストアはありません」を表示する', async () => {
  const popup = loadPopup(makeFakeStorage({}));
  const listEl = makeFakeListEl();
  await popup.renderList(listEl);
  assert.equal(listEl.children.length, 1);
  assert.equal(listEl.children[0].textContent, 'ブロック中のストアはありません');
});

test('renderListはaddedAt降順で行を描画する', async () => {
  const popup = loadPopup(makeFakeStorage({
    100: { name: 'Old Store', addedAt: 1000 },
    200: { name: 'New Store', addedAt: 3000 },
  }));
  const listEl = makeFakeListEl();
  await popup.renderList(listEl);
  assert.equal(listEl.children.length, 2);
  assert.ok(listEl.children[0].children[0].textContent.includes('New Store'));
  assert.ok(listEl.children[1].children[0].textContent.includes('Old Store'));
});

test('renderListの削除ボタンでstoreを消して再描画する', async () => {
  const storage = makeFakeStorage({ 100: { name: 'Store A', addedAt: 1000 } });
  const popup = loadPopup(storage);
  const listEl = makeFakeListEl();
  await popup.renderList(listEl);
  const removeBtn = listEl.children[0].children[1];
  await removeBtn.fireClick();
  assert.deepEqual(await storage.getBlockedStores(), {});
  assert.equal(listEl.children[0].textContent, 'ブロック中のストアはありません');
});
