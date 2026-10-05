import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parityCases } from './helpers/parityCases.ts';

test('all102 default gameplay traces match the pre-refactor v10 reference exactly', () => {
  const baseline = JSON.parse(readFileSync(new URL('./fixtures/default-v1-parity.json', import.meta.url), 'utf8'));
  assert.equal(baseline.sourceCommit, '1dea74af79528de9c6378fe1272080b490d130c5');
  assert.deepEqual(parityCases(), baseline.cases);
});
