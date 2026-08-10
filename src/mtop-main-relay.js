// mtop.js（isolated world content script）からの JSONP 実行依頼を main world で処理する中継スクリプト。
//
// 実測確定(2026-08-10 sumire): isolated world の content script が
// document.createElement('script') で作った要素は、DOM には正しく接続される
// (isConnected/parentNode/instanceof は正常) にも関わらず main world では
// 実行されない（inline textContent も src 付きも同様。CSP違反イベントは発火せず、
// console にもエラーは出ない）。JSONP はブラウザが main world のグローバル関数を
// 呼び出す仕組みなので、真に main world で動くコードでなければ受け取れない。
//
// このファイルは manifest.json の content_scripts[].world:"MAIN"（Chrome 111+）で
// 宣言し、本物の main world スクリプトとして実行する。isolated world とは
// document への CustomEvent（'cb-mtop-request' / 'cb-mtop-response'、detail は
// JSON文字列）でのみやり取りする。

'use strict';

(() => {
  const REQUEST_EVENT = 'cb-mtop-request';
  const RESPONSE_EVENT = 'cb-mtop-response';
  const RELAY_TIMEOUT_MS = 10000;

  document.addEventListener(REQUEST_EVENT, (ev) => {
    let payload;
    try { payload = JSON.parse(ev.detail); } catch (err) { return; }
    if (!payload || !payload.requestId || !payload.url || !payload.callback) return;
    const { requestId, url, callback } = payload;

    const respond = (result) => {
      document.dispatchEvent(new CustomEvent(RESPONSE_EVENT, { detail: JSON.stringify({ requestId, ...result }) }));
    };

    let settled = false;
    const jsonpScript = document.createElement('script');

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      jsonpScript.remove();
      delete window[callback];
      respond(result);
    };

    const timer = setTimeout(() => finish({ ok: false, error: 'mtop: main world relay タイムアウト' }), RELAY_TIMEOUT_MS);

    window[callback] = (data) => finish({ ok: true, data });

    jsonpScript.src = url;
    jsonpScript.onerror = () => finish({ ok: false, error: 'mtop: JSONPスクリプトの読込に失敗しました' });
    document.documentElement.appendChild(jsonpScript);
  });
})();
