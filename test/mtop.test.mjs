// mtop.js の署名生成・JSONP剥がし・storeId抽出を検証する。
// resolveStoreId/fetchViaJsonp のDOM実行(script注入+CustomEventリレー)はnode vmでは
// 論理を模擬するだけで実測にならないため対象外。実測はagent-browserで行う。
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const MD5_SRC = path.join(import.meta.dirname, '..', 'src', 'md5.js');
const MTOP_SRC = path.join(import.meta.dirname, '..', 'src', 'mtop.js');

function nodeMd5(text) {
  return createHash('md5').update(text, 'utf8').digest('hex');
}

function loadMtop(cookie) {
  const context = vm.createContext({
    TextEncoder, Math, DataView, Uint8Array, Uint32Array, Array, URLSearchParams, JSON,
    document: { cookie: cookie ?? '' },
  });
  vm.runInContext(readFileSync(MD5_SRC, 'utf8'), context);
  vm.runInContext(readFileSync(MTOP_SRC, 'utf8'), context);
  return vm.runInContext('CB_MTOP', context);
}

test('readTokenはcookieの_m_h5_tkからアンダースコア前半を取り出す', () => {
  const mtop = loadMtop('cna=abc; _m_h5_tk=abcdef0123456789abcdef0123456789_1786000000000; other=1');
  assert.equal(mtop.readToken(), 'abcdef0123456789abcdef0123456789');
});

test('readTokenはcookieが無ければnullを返す', () => {
  const mtop = loadMtop('cna=abc; other=1');
  assert.equal(mtop.readToken(), null);
});

test('buildUrlのsignはmd5(token&t&appKey&data)と一致する', () => {
  const mtop = loadMtop();
  const token = 'abcdef0123456789abcdef0123456789';
  const t = 1786346460568;
  const { url, callback } = mtop.buildUrl('1005010587572937', token, t);
  const data = mtop.buildData('1005010587572937');
  const expectedSign = nodeMd5(`${token}&${t}&12574478&${data}`);

  const parsed = new URL(url);
  assert.equal(parsed.origin + parsed.pathname, 'https://acs.aliexpress.com/h5/mtop.aliexpress.pdp.pc.query/1.0/');
  assert.equal(parsed.searchParams.get('sign'), expectedSign);
  assert.equal(parsed.searchParams.get('appKey'), '12574478');
  assert.equal(parsed.searchParams.get('api'), 'mtop.aliexpress.pdp.pc.query');
  assert.equal(parsed.searchParams.get('t'), String(t));
  assert.equal(parsed.searchParams.get('data'), data);
  assert.equal(parsed.searchParams.get('callback'), callback);
});

test('parseJsonpはcallback(...)を剥がしてJSONを返す', () => {
  const mtop = loadMtop();
  const result = mtop.parseJsonp('cb123({"ret":["SUCCESS"],"data":{"storeId":"1102"}})', 'cb123');
  assert.deepEqual(result, { ret: ['SUCCESS'], data: { storeId: '1102' } });
});

test('parseJsonpは想定外の形にthrowする', () => {
  const mtop = loadMtop();
  assert.throws(() => mtop.parseJsonp('not-jsonp-shaped', 'cb123'), /JSONPの形が想定外/);
});

// 2026-08-10 bell実測で確定した実レスポンス構造（要点のみ抜粋）。
const SUCCESS_RESPONSE = {
  ret: ['SUCCESS::调用成功'],
  data: {
    result: {
      SHOP_CARD_PC: { sellerInfo: { storeNum: '1104977015', storeURL: '1104977016' } },
      GLOBAL_DATA: { globalData: { storeId: '1104977016', sellerId: '6003189887' } },
      DESC: { storeId: '1104977016' },
    },
  },
};

test('extractStoreIdはSHOP_CARD_PC.sellerInfo.storeNumを返す（globalData.storeIdは罠なので使わない）', () => {
  const mtop = loadMtop();
  assert.equal(mtop.extractStoreId(SUCCESS_RESPONSE), '1104977015');
});

test('extractStoreIdはretにSUCCESSが無ければthrowする', () => {
  const mtop = loadMtop();
  const response = { ret: ['FAIL_SYS_USER_VALIDATE'], data: {} };
  assert.throws(() => mtop.extractStoreId(response), /呼び出し失敗/);
});

test('extractStoreIdはstoreNumが欠けていればthrowする', () => {
  const mtop = loadMtop();
  const response = { ret: ['SUCCESS::调用成功'], data: { result: { SHOP_CARD_PC: { sellerInfo: {} } } } };
  assert.throws(() => mtop.extractStoreId(response), /storeNum がありません/);
});

test('isTokenErrorはTOKEN_EXPIRED/TOKEN_EMPTYを検知する', () => {
  const mtop = loadMtop();
  assert.equal(mtop.isTokenError({ ret: ['FAIL_SYS_SESSION_EXPIRED::TOKEN_EXPIRED'] }), true);
  assert.equal(mtop.isTokenError({ ret: ['FAIL_SYS_TOKEN_EMPTY::TOKEN_EMPTY'] }), true);
  assert.equal(mtop.isTokenError({ ret: ['SUCCESS::调用成功'] }), false);
});
