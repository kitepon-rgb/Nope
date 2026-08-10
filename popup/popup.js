// ブラックリスト管理画面。ブロック済みストアの一覧・削除・手動追加・キャッシュクリアを行う。
// popup context は content script と別実行環境なので、CB_STORAGE を popup.html から個別に読み込む。

'use strict';

const CB_POPUP = (() => {
  /** ストアURL（/store/\d+ を含む文字列）または数値IDをパースする。 @param {string} input @returns {string|null} */
  function parseStoreInput(input) {
    const trimmed = input.trim();
    const urlMatch = trimmed.match(/\/store\/(\d+)/);
    if (urlMatch) return urlMatch[1];
    if (/^\d+$/.test(trimmed)) return trimmed;
    return null;
  }

  /** @param {number} timestamp @returns {string} */
  function formatDate(timestamp) {
    return new Date(timestamp).toLocaleString('ja-JP');
  }

  /** addedAt降順。 @param {Record<string, {name: string, addedAt: number}>} blockedStores */
  function sortEntries(blockedStores) {
    return Object.entries(blockedStores).sort((a, b) => b[1].addedAt - a[1].addedAt);
  }

  function renderRow(storeId, info, onRemove) {
    const li = document.createElement('li');
    li.className = 'cb-store-row';

    const label = document.createElement('span');
    label.className = 'cb-store-label';
    label.textContent = `${info.name}（${storeId}）— ${formatDate(info.addedAt)}`;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = '削除';
    removeBtn.addEventListener('click', () => onRemove(storeId));

    li.append(label, removeBtn);
    return li;
  }

  async function renderList(listEl) {
    const blocked = await CB_STORAGE.getBlockedSources('aliexpress');
    const entries = sortEntries(blocked);
    listEl.replaceChildren();
    if (entries.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'cb-empty';
      empty.textContent = 'ブロック中のストアはありません';
      listEl.append(empty);
      return;
    }
    for (const [storeId, info] of entries) {
      listEl.append(renderRow(storeId, info, async (id) => {
        await CB_STORAGE.removeBlockedSource('aliexpress', id);
        await renderList(listEl);
      }));
    }
  }

  /** 現在のdisplayModeに応じてラジオのcheckedを設定し、changeでsetDisplayModeを呼ぶ。 @param {Array<{value:string,checked:boolean,addEventListener:Function}>} radios @param {typeof CB_STORAGE} storage */
  async function bindDisplayModeControl(radios, storage) {
    const current = await storage.getDisplayMode();
    for (const radio of radios) {
      radio.checked = radio.value === current;
      radio.addEventListener('change', async () => {
        if (radio.checked) await storage.setDisplayMode(radio.value);
      });
    }
  }

  function init() {
    const listEl = document.getElementById('store-list');
    const form = document.getElementById('add-form');
    const input = document.getElementById('add-input');
    const nameInput = document.getElementById('add-name');
    const clearCacheBtn = document.getElementById('clear-cache');
    const statusEl = document.getElementById('status');
    const displayModeRadios = document.querySelectorAll('input[name="display-mode"]');

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const storeId = parseStoreInput(input.value);
      if (!storeId) {
        statusEl.textContent = 'ストアURLまたは数値IDを入力してください';
        return;
      }
      await CB_STORAGE.addBlockedSource('aliexpress', storeId, nameInput.value);
      input.value = '';
      nameInput.value = '';
      statusEl.textContent = '';
      await renderList(listEl);
    });

    clearCacheBtn.addEventListener('click', async () => {
      await CB_STORAGE.clearCache();
      statusEl.textContent = 'キャッシュをクリアしました';
    });

    bindDisplayModeControl(displayModeRadios, CB_STORAGE);
    renderList(listEl);
  }

  return { parseStoreInput, formatDate, sortEntries, renderList, bindDisplayModeControl, init };
})();

CB_POPUP.init();
