import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const SRC = path.join(import.meta.dirname, '..', 'src', 'content-name.js');

class FakeMutationObserver {
  observe() {}
}

function makeElement(tagName) {
  const element = {
    tagName,
    className: '',
    style: { display: '' },
    children: [],
    listeners: {},
    attributes: {},
    parent: null,
    textContent: '',
    appendChild(child) { child.parent = element; element.children.push(child); return child; },
    addEventListener(type, handler) { element.listeners[type] = handler; },
    setAttribute(name, value) { element.attributes[name] = value; },
    querySelector(selector) {
      const className = selector.startsWith('.') ? selector.slice(1) : selector;
      return element.children.find((child) => child.className === className) || null;
    },
    remove() {
      if (!element.parent) return;
      element.parent.children = element.parent.children.filter((child) => child !== element);
      element.parent = null;
    },
  };
  return element;
}

function loadContentName(cards, storage) {
  const body = makeElement('body');
  const document = {
    body,
    createElement: (tag) => makeElement(tag),
    querySelectorAll: () => cards,
  };
  const context = vm.createContext({
    document,
    MutationObserver: FakeMutationObserver,
    setTimeout: () => 0,
    console,
    chrome: { runtime: { getURL: (assetPath) => `chrome-extension://test/${assetPath}` } },
    CB_STORAGE: storage,
    CB_KEYWORD_FILTER: { matchesAny: () => false },
  });
  vm.runInContext(readFileSync(SRC, 'utf8'), context);
  return { contentName: vm.runInContext('CB_NAME', context), document };
}

function makeStorage(initial = {}) {
  let blocked = { ...initial };
  let sourceListener = null;
  const additions = [];
  return {
    additions,
    setBlocked(next) { blocked = { ...next }; },
    emitBlocked(next) { blocked = { ...next }; sourceListener(blocked); },
    async getBlockedSources() { return blocked; },
    async addBlockedSource(...args) {
      additions.push(args);
      const [, sourceId, name] = args;
      blocked = { ...blocked, [sourceId]: { name, nameOnly: args[3], addedAt: 1 } };
    },
    async removeBlockedSource(_siteKey, sourceId) {
      const next = { ...blocked };
      delete next[sourceId];
      blocked = next;
    },
    async getBlockedKeywords() { return []; },
    async getDisplayMode() { return 'placeholder'; },
    onBlockedSourcesChanged(_siteKey, handler) { sourceListener = handler; },
    onBlockedKeywordsChanged() {},
    onDisplayModeChanged() {},
  };
}

function adapterFor(names) {
  return {
    siteKey: 'yahoo_news',
    cardSelector: '.card',
    getWrapper: (card) => card,
    resolver: { getSource: (card) => ({ sourceName: names.get(card) }) },
  };
}

test('Pattern Bは各未ブロックカードへhover/focus表示の発信元ボタンを注入する', async () => {
  const first = makeElement('article');
  const second = makeElement('article');
  const names = new Map([[first, '発信元A'], [second, '発信元B']]);
  const storage = makeStorage();
  const { contentName } = loadContentName([first, second], storage);

  await contentName.init({ storage, adapter: adapterFor(names) }).start();

  for (const card of [first, second]) {
    const button = card.querySelector('.cb-source-block-button');
    assert.ok(button);
    assert.equal(button.style.opacity, '0');
    assert.equal(button.style.pointerEvents, 'none');
    card.listeners.mouseenter();
    assert.equal(button.style.opacity, '1');
    card.listeners.mouseleave();
    assert.equal(button.style.opacity, '0');
    button.listeners.focus();
    assert.equal(button.style.opacity, '1');
    button.listeners.blur();
    assert.equal(button.style.opacity, '0');
  }
});

test('Pattern BボタンはnameOnly=trueで登録し、toast後にplaceholderだけを表示する', async () => {
  const card = makeElement('article');
  const names = new Map([[card, '西スポWEB OTTO!']]);
  const storage = makeStorage();
  const { contentName, document } = loadContentName([card], storage);
  await contentName.init({ storage, adapter: adapterFor(names) }).start();

  const button = card.querySelector('.cb-source-block-button');
  let prevented = false;
  let stopped = false;
  await button.listeners.click({
    preventDefault: () => { prevented = true; },
    stopPropagation: () => { stopped = true; },
  });

  assert.deepEqual(storage.additions, [['yahoo_news', '西スポWEB OTTO!', '西スポWEB OTTO!', true]]);
  assert.equal(prevented, true);
  assert.equal(stopped, true);
  assert.ok(card.querySelector('.cb-blocked-placeholder'));
  assert.equal(button.style.display, 'none');
  assert.ok(document.body.children.some((child) => child.className === 'cb-toast'
    && child.textContent.includes('ブロックしました')));
});

test('Pattern Bのブロック済みカードは注入ボタンを出さず、解除後に初めて出す', async () => {
  const card = makeElement('article');
  const sourceName = '発信元A';
  const names = new Map([[card, sourceName]]);
  const storage = makeStorage({ [sourceName]: { name: sourceName, nameOnly: true, addedAt: 1 } });
  const { contentName } = loadContentName([card], storage);
  await contentName.init({ storage, adapter: adapterFor(names) }).start();

  assert.ok(card.querySelector('.cb-blocked-placeholder'));
  assert.equal(card.querySelector('.cb-source-block-button'), null);

  storage.emitBlocked({});
  assert.equal(card.querySelector('.cb-blocked-placeholder'), null);
  assert.ok(card.querySelector('.cb-source-block-button'));
});
