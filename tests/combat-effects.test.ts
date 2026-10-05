import test from 'node:test';
import assert from 'node:assert/strict';
import { damageHp, healHp } from '../src/core/combatEffects.ts';

test('pure damage preserves overkill but separately reports actual HP loss', () => {
  const hp = Object.freeze({ current: 3, max: 30 });
  const change = damageHp(hp, 7);
  assert.deepEqual(change, { hp: { current: -4, max: 30 }, before: 3, after: -4, amount: 7, actual: 3, overkill: 4 });
  assert.equal(hp.current, 3);
  assert.equal(damageHp({ ...hp, current: -4 }, 7).actual, 0);
});
test('pure healing caps actual recovery without mutating its source', () => {
  const hp = Object.freeze({ current: 27, max: 30 });
  assert.deepEqual(healHp(hp, 15), { hp: { current: 30, max: 30 }, before: 27, after: 30, amount: 3, actual: 3, overkill: 0 });
  assert.equal(healHp({ ...hp, current: 30 }, 15).actual, 0);
  assert.equal(hp.current, 27);
});
