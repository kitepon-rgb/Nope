// productId → storeId を mtop API (mtop.aliexpress.pdp.pc.query) で解決する。
// 署名は md5(`${token}&${t}&${appKey}&${data}`)、token は cookie _m_h5_tk のアンダースコア区切り前半。
// CB_MD5・CB_STORAGE と同じく <script> 連結読み込み前提のグローバル公開（ビルド工程なし）。

'use strict';

const CB_MTOP = (() => {
  const APP_KEY = '12574478';
  const API_NAME = 'mtop.aliexpress.pdp.pc.query';
  const ENDPOINT = `https://acs.aliexpress.com/h5/${API_NAME}/1.0/`;

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

  return { readToken, buildData, buildUrl, parseJsonp };
})();
