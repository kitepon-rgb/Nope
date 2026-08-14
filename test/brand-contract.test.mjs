import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repoRoot = path.resolve(import.meta.dirname, '..');
const campaign = 'utm_source=nope&utm_medium=chrome_extension&utm_campaign=nope-brand-link';

test('導入後の2リンクは固定campaignでkitepon.dev rootへ戻る', () => {
  const search = readFileSync(path.join(repoRoot, 'src/content-search.js'), 'utf8');
  const name = readFileSync(path.join(repoRoot, 'src/content-name.js'), 'utf8');
  const popup = readFileSync(path.join(repoRoot, 'popup/popup.html'), 'utf8');

  assert.match(search, new RegExp(`${campaign}&utm_content=blocked-placeholder`));
  assert.match(name, new RegExp(`${campaign}&utm_content=blocked-placeholder`));
  assert.match(popup, /https:\/\/kitepon\.dev\/\?utm_source=nope&amp;utm_medium=chrome_extension&amp;utm_campaign=nope-brand-link&amp;utm_content=popup-footer/);
  assert.doesNotMatch(search, /const BRAND_URL = 'https:\/\/kitepon\.dev\/';/);
  assert.doesNotMatch(name, /const BRAND_URL = 'https:\/\/kitepon\.dev\/';/);
});

test('READMEは審査中を正確に示し、日本語の利用者入口を持つ', () => {
  const readme = readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
  for (const heading of ['5秒でわかる', '現在の配布状態', '30秒の使い方', '対応する7サービス群・8対応面', 'プライバシー・権限・制限']) {
    assert.match(readme, new RegExp(`## ${heading}`));
  }
  assert.match(readme, /2\.0\.1は再申請済みで、Chrome Web Storeの審査中/);
  assert.match(readme, /docs\/evidence\/r5-smoke-restored\.png/);
  assert.match(readme, /docs\/evidence\/r5-smoke-blocked\.png/);
  assert.doesNotMatch(readme, /Chrome ウェブストアには未公開のため、開発者モードでの読み込み/);
});
