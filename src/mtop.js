// productId → storeId を mtop API (mtop.aliexpress.pdp.pc.query) で解決する。
// 署名は md5(`${token}&${t}&${appKey}&${data}`)、token は cookie _m_h5_tk のアンダースコア区切り前半。
// CB_MD5・CB_STORAGE と同じく <script> 連結読み込み前提のグローバル公開（ビルド工程なし）。

'use strict';

const CB_MTOP = (() => {
  const APP_KEY = '12574478';
  const API_NAME = 'mtop.aliexpress.pdp.pc.query';
  const ENDPOINT = `https://acs.aliexpress.com/h5/${API_NAME}/1.0/`;
  const RESPONSE_TIMEOUT_MS = 10000;
  // src/mtop-main-relay.js（main world）との合図。イベント名はここが唯一の正本。
  const REQUEST_EVENT = 'cb-mtop-request';
  const RESPONSE_EVENT = 'cb-mtop-response';

  function readToken() {
    const match = document.cookie.match(/(?:^|;\s*)_m_h5_tk=([^;]+)/);
    if (!match) return null;
    return decodeURIComponent(match[1]).split('_')[0];
  }

  /** @param {string} productId @returns {string} */
  function buildData(productId) {
    return JSON.stringify({ productId: String(productId) });
  }

  /** @param {string} productId @param {string} token @param {number} t @returns {string} */
  function buildUrl(productId, token, t) {
    const data = buildData(productId);
    const sign = CB_MD5.md5(`${token}&${t}&${APP_KEY}&${data}`);
    const callback = `mtopjsonp${t}`;
    const params = new URLSearchParams({
      jsv: '2.5.1',
      appKey: APP_KEY,
      t: String(t),
      sign,
      api: API_NAME,
      type: 'originaljsonp',
      v: '1.0',
      timeout: '15000',
      dataType: 'originaljsonp',
      callback,
      data,
    });
    return { url: `${ENDPOINT}?${params.toString()}`, callback };
  }

  // レスポンスは `<callback>({...})` という JSONP 形。callback 名は自分で発行したものと突き合わせて剥がす。
  /** @param {string} text @param {string} callback @returns {any} */
  function parseJsonp(text, callback) {
    const prefix = `${callback}(`;
    if (!text.startsWith(prefix) || !text.endsWith(')')) {
      throw new Error(`mtop: JSONPの形が想定外です: ${text.slice(0, 80)}`);
    }
    return JSON.parse(text.slice(prefix.length, -1));
  }

  // 実測確定(2026-08-10 bell): ret に SUCCESS を含めば成功。storeId は
  // data.result.SHOP_CARD_PC.sellerInfo.storeNum が正（DOM の a[href*="/store/"] と一致）。
  // data.result.GLOBAL_DATA.globalData.storeId / sellerInfo.storeURL は別系統IDの罠のため使わない。
  /** @param {any} response @returns {string} */
  function extractStoreId(response) {
    const ret = Array.isArray(response && response.ret) ? response.ret : [];
    if (!ret.some((r) => typeof r === 'string' && r.startsWith('SUCCESS'))) {
      throw new Error(`mtop: 呼び出し失敗 ret=${JSON.stringify(ret)}`);
    }
    const storeId = response && response.data && response.data.result
      && response.data.result.SHOP_CARD_PC && response.data.result.SHOP_CARD_PC.sellerInfo
      && response.data.result.SHOP_CARD_PC.sellerInfo.storeNum;
    if (!storeId) throw new Error('mtop: レスポンスに SHOP_CARD_PC.sellerInfo.storeNum がありません');
    return String(storeId);
  }

  /** @param {any} response @returns {boolean} */
  function isTokenError(response) {
    const ret = Array.isArray(response && response.ret) ? response.ret : [];
    return ret.some((r) => typeof r === 'string' && (r.includes('TOKEN_EXPIRED') || r.includes('TOKEN_EMPTY')));
  }

  // 実測確定(2026-08-10 sumire): content script の isolated world から document.createElement('script')
  // で作った要素は DOM に正しく接続されても main world では実行されない（CSP違反なし・エラーも出ない
  // まま onerror/未実行のまま止まる）。よって実際の JSONP 実行は src/mtop-main-relay.js
  // （manifest.json content_scripts[].world:"MAIN" で宣言された正真の main world スクリプト）に委譲し、
  // isolated world 側はリクエストを CustomEvent で投げてレスポンスを待つだけにする。
  /** @param {string} productId @returns {Promise<any>} */
  function fetchViaJsonp(productId) {
    return new Promise((resolve, reject) => {
      const token = readToken();
      if (!token) { reject(new Error('mtop: _m_h5_tk cookie がありません（未ログイン状態の可能性）')); return; }

      const t = Date.now();
      const { url, callback } = buildUrl(productId, token, t);
      const requestId = callback;
      let settled = false;
      let timer = null;

      const cleanup = () => {
        document.removeEventListener(RESPONSE_EVENT, onResponse);
        if (timer) clearTimeout(timer);
      };
      const settle = (fn) => {
        if (settled) return;
        settled = true;
        cleanup();
        fn();
      };
      const onResponse = (ev) => {
        let payload;
        try { payload = JSON.parse(ev.detail); } catch (err) { return; }
        if (!payload || payload.requestId !== requestId) return;
        settle(() => {
          if (payload.ok) resolve(payload.data);
          else reject(new Error(payload.error || 'mtop: main world relay からエラーが返されました'));
        });
      };

      document.addEventListener(RESPONSE_EVENT, onResponse);
      timer = setTimeout(() => settle(() => reject(new Error('mtop: レスポンスタイムアウト'))), RESPONSE_TIMEOUT_MS);
      document.dispatchEvent(new CustomEvent(REQUEST_EVENT, { detail: JSON.stringify({ requestId, url, callback }) }));
    });
  }

  // productId → storeId 解決の公開API。cache を優先し、無ければ mtop を叩いて cache へ保存する。
  // TOKEN_EXPIRED/TOKEN_EMPTY は cookie 再発行後に1回だけリトライ。失敗は静かにフォールバックせず throw する。
  /** @param {string} productId @param {{useCache?: boolean}} [options] @returns {Promise<string>} */
  async function resolveStoreId(productId, options) {
    const useCache = !options || options.useCache !== false;
    if (useCache) {
      const cached = await CB_STORAGE.getCachedSource('aliexpress', productId);
      if (cached) return cached;
    }

    let response = await fetchViaJsonp(productId);
    if (isTokenError(response)) {
      response = await fetchViaJsonp(productId);
    }
    const storeId = extractStoreId(response);
    if (useCache) await CB_STORAGE.setCachedSource('aliexpress', productId, storeId);
    return storeId;
  }

  return {
    readToken, buildData, buildUrl, parseJsonp,
    extractStoreId, isTokenError, fetchViaJsonp, resolveStoreId,
  };
})();
