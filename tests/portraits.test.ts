import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { playerPortraits, resolvePlayerPortrait, monsterPortrait, enemyPortraits } from '../src/ui/portraits.ts';

/** 日本語: 外見データにゲームルールを持たせず、提供されたPNGの全寸法を維持する。
 * English: Portrait profiles are cosmetic only; supplied player PNGs keep their full dimensions. */
test('player portrait framing is character-specific and selection is cosmetic', () => {
  assert.equal(resolvePlayerPortrait('blue'), 'blue');
  assert.equal(resolvePlayerPortrait('red'), 'red');
  assert.equal(resolvePlayerPortrait('invalid'), 'blue');
  assert.notEqual(playerPortraits.blue.anchorX, playerPortraits.red.anchorX);
  assert.notEqual(playerPortraits.blue.height, playerPortraits.red.height);
  for (const portrait of Object.values(playerPortraits)) {
    assert.deepEqual(Object.keys(portrait).sort(), ['alt', 'anchorX', 'height', 'label', 'src', 'top']);
    const bytes = readFileSync(new URL(portrait.src));
    assert.equal(bytes.toString('ascii', 1, 4), 'PNG');
    assert.equal(bytes.readUInt32BE(20), 1024);
    assert.equal(bytes.readUInt32BE(16), portrait === playerPortraits.blue ? 758 : 614);
  }
  assert.ok(readFileSync(new URL(monsterPortrait.src)).length > 0);
});


test('all named enemies have readable source assets', () => {
  assert.deepEqual(Object.keys(enemyPortraits), ['marujiro', 'hikikizan', 'nigirin', 'merarun']);
  for (const enemy of Object.values(enemyPortraits)) {
    const bytes = readFileSync(new URL(enemy.src));
    assert.equal(bytes.toString('ascii', 1, 4), 'PNG');
    assert.ok(bytes.length > 0);
  }
  assert.equal(enemyPortraits.marujiro.label, 'マルジロ');
});
