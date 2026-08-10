// md5.js を RFC 1321 のテストスイートと、Node の crypto による独立照合で検証する。
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const SRC = path.join(import.meta.dirname, '..', 'src', 'md5.js');

function loadMd5() {
  const context = vm.createContext({ TextEncoder, Math, DataView, Uint8Array, Uint32Array, Array });
  vm.runInContext(readFileSync(SRC, 'utf8'), context);
  return vm.runInContext('CB_MD5', context);
}

test('RFC 1321のテストスイートと一致する', () => {
  const { md5 } = loadMd5();
  const vectors = [
    ['', 'd41d8cd98f00b204e9800998ecf8427e'],
    ['a', '0cc175b9c0f1b6a831c399e269772661'],
    ['abc', '900150983cd24fb0d6963f7d28e17f72'],
    ['message digest', 'f96b697d7cb7938d525a2f31aaf161d0'],
    ['abcdefghijklmnopqrstuvwxyz', 'c3fcd3d76192e4007dfb496cca67e13b'],
    ['ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
      'd174ab98d277d9f5a5611c2c9f419d9f'],
    ['12345678901234567890123456789012345678901234567890123456789012345678901234567890',
      '57edf4a22be3c955ac49da2e2107b67a'],
  ];
  for (const [input, expected] of vectors) assert.equal(md5(input), expected);
});

test('64byte境界前後とUTF-8多バイトをNode cryptoと照合する', () => {
  const { md5 } = loadMd5();
  const samples = [
    'x'.repeat(55), 'x'.repeat(56), 'x'.repeat(57), 'x'.repeat(63),
    'x'.repeat(64), 'x'.repeat(65), 'x'.repeat(119), 'x'.repeat(120),
    'ベルとクオ', '日本語とemoji🍣が混ざる',
  ];
  for (const sample of samples) {
    assert.equal(md5(sample), createHash('md5').update(sample, 'utf8').digest('hex'), sample.slice(0, 16));
  }
});

test('mtop署名の形（token&t&appKey&data）でも32桁hexを返す', () => {
  const { md5 } = loadMd5();
  const signature = md5('abcdef0123456789&1786000000000&12574478&{"productId":"1005006"}');
  assert.match(signature, /^[0-9a-f]{32}$/u);
  assert.equal(signature,
    createHash('md5').update('abcdef0123456789&1786000000000&12574478&{"productId":"1005006"}', 'utf8').digest('hex'));
});
