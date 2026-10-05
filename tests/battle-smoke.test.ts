import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, createBattle, defaultConfig, getDropOptions, settleBoxes } from '../src/core/index.ts';
import type { BattleAction } from '../src/core/index.ts';

/** 日本語: 小さな受け入れ例に加え、多数のシードで1戦を最後まで進める。
 * English: Seed sweeps exercise complete matches, not just isolated rule examples. */
test('100 seeded battles terminate with legal stable boxes and no post-result actions', () => {
  const winners = new Set<string>();
  for (let seed = 0; seed < 100; seed += 1) {
    let state = createBattle({ ...defaultConfig, seed });
    for (let step = 0; step < 100 && !state.result; step += 1) {
      const legal = getDropOptions(state).filter(option => option.available);
      const action: BattleAction = state.actor === 'enemy'
        ? { type: 'enemy' }
        : legal.length
          ? { type: 'drop', candidateId: legal[(seed + state.turn) % legal.length]!.id }
          : { type: 'skip' };
      const before = state;
      const outcome = applyAction(state, action);
      assert.equal(outcome.accepted, true);
      assert.ok(outcome.resolution);
      state = outcome.state;
      const drops = outcome.resolution.events.filter(event => event.type === 'drop');
      assert.ok(drops.length <= 1);
      assert.equal(state.boxes.length, before.boxes.length + drops.length);
      assert.equal(new Set(state.boxes.map(box => `${box.row}:${box.col}`)).size, state.boxes.length);
      assert.deepEqual(state.boxes, settleBoxes(state.config.board, state.boxes));
      assert.equal(getDropOptions(state).length, 6, 'boxes must never generate new ceilings');
    }
    assert.ok(state.result, `Seed ${seed} must terminate before the board can overflow`);
    winners.add(state.result.winner);
    const terminal = applyAction(state, { type: 'enemy' });
    assert.equal(terminal.accepted, false);
    assert.equal(terminal.state, state);
  }
  assert.deepEqual([...winners].sort(), ['enemy', 'player'], 'seed sweep should reproduce both HP outcomes');
});
