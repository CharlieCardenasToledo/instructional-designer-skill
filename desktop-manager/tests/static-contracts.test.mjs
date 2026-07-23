import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('el sistema visual no declara degradados CSS', async () => {
  const css = await readFile(new URL('src/styles.css', root), 'utf8');
  assert.doesNotMatch(css, /gradient\s*\(/i);
});

test('el onboarding mantiene siete pasos y la llamada de finalización', async () => {
  const source = await readFile(new URL('src/onboarding.js', root), 'utf8');
  assert.match(source, /TOTAL_STEPS\s*=\s*7/);
  assert.match(source, /completeOnboarding/);
  assert.match(source, /advanceOnboarding/);
});
