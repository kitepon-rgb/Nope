// keyword-filter.js（CB_KEYWORD_FILTER）のユニットテスト。
// 正規化ルール: NFKC + toLowerCase + 部分一致 + 複数キーワードは OR。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const SRC = path.join(import.meta.dirname, '..', 'src', 'keyword-filter.js');

function loadFilter() {
  const context = vm.createContext({ console });
  vm.runInContext(readFileSync(SRC, 'utf8'), context);
  return vm.runInContext('CB_KEYWORD_FILTER', context);
}

test('normalize: NFKC正規化で全角英数字を半角に変換する', () => {
  const f = loadFilter();
  assert.equal(f.normalize('ＡＢＣ'), 'abc');
  assert.equal(f.normalize('１２３'), '123');
});

test('normalize: toLowerCaseで大文字を小文字に変換する', () => {
  const f = loadFilter();
  assert.equal(f.normalize('Hello World'), 'hello world');
});

test('normalize: 全角スペースは半角スペースに変換される', () => {
  const f = loadFilter();
  assert.equal(f.normalize('テスト　テスト'), 'テスト テスト');
});

test('matchesAny: キーワードがタイトルに部分一致すればtrueを返す', () => {
  const f = loadFilter();
  assert.ok(f.matchesAny('阪神タイガース優勝', ['タイガース']));
});

test('matchesAny: キーワードが含まれなければfalseを返す', () => {
  const f = loadFilter();
  assert.ok(!f.matchesAny('阪神タイガース優勝', ['広島']));
});

test('matchesAny: 複数キーワードはOR（いずれかが一致すればtrue）', () => {
  const f = loadFilter();
  assert.ok(f.matchesAny('広島カープ優勝', ['タイガース', 'カープ']));
  assert.ok(!f.matchesAny('DeNA優勝', ['タイガース', 'カープ']));
});

test('matchesAny: 大文字小文字を区別しない', () => {
  const f = loadFilter();
  assert.ok(f.matchesAny('Hello World News', ['hello']));
  assert.ok(f.matchesAny('hello world news', ['Hello']));
});

test('matchesAny: 全角半角を区別しない（NFKC正規化）', () => {
  const f = loadFilter();
  // 全角キーワードで半角テキストにマッチ
  assert.ok(f.matchesAny('test article', ['ｔｅｓｔ']));
  // 半角キーワードで全角テキストにマッチ
  assert.ok(f.matchesAny('ｔｅｓｔ記事', ['test']));
});

test('matchesAny: キーワードリストが空ならfalseを返す', () => {
  const f = loadFilter();
  assert.ok(!f.matchesAny('どんなテキストでも', []));
});

test('matchesAny: キーワードがnullまたはundefinedならfalseを返す', () => {
  const f = loadFilter();
  assert.ok(!f.matchesAny('テキスト', null));
  assert.ok(!f.matchesAny('テキスト', undefined));
});

test('matchesAny: 日本語キーワードの部分一致', () => {
  const f = loadFilter();
  assert.ok(f.matchesAny('「二度見しちゃった」華原朋美、現在の姿にネット騒然', ['華原朋美']));
  assert.ok(!f.matchesAny('「二度見しちゃった」華原朋美、現在の姿にネット騒然', ['中居正広']));
});
