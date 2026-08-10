// mtop.js の署名生成とJSONP剥がしを検証する。
// mtop 実レスポンスのフィールド抽出（storeId 解決本体）は実測未確定のためテスト対象外。
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
