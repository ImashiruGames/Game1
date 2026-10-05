import test from 'node:test';
import assert from 'node:assert/strict';
import { BattleController } from '../src/next/app/BattleController.ts';
import { createTrialConfig } from '../src/next/config.ts';
import { emptyActionBreakdowns, recordActionBreakdown, lastActionBreakdownsHtml } from '../src/next/ui/battleReadability.ts';
import type { LastActionBreakdowns } from '../src/next/ui/battleReadability.ts';
import type { BattleConfig, Box, Resolution } from '../src/next/core/types.ts';
const box = (row: number, col: number, owner: Box['owner']): Box => ({ id: `lifecycle:${row}:${col}`, row, col, owner, type: 'normal', status: 'normal' });
function setup(height: number): BattleConfig {
  return { ...createTrialConfig('red'), initialGauge: 100, board: { width: 2, height, gravity: 'down', terrain: [], invalidCells: [] }, initialBoxes: [box(height - 2, 0, 'player'), box(height - 1, 0, 'player'), box(height - 2, 1, 'enemy'), box(height - 1, 1, 'enemy')] };
}
function harness(config: BattleConfig) {
  let history: LastActionBreakdowns = emptyActionBreakdowns();
  const records: { resolution: Resolution; before: LastActionBreakdowns; after: LastActionBreakdowns }[] = [];
  const controller = new BattleController(config, { render() {}, async animate(resolution, before) {
    const previous = history;
    history = recordActionBreakdown(history, resolution, before.turn);
    records.push({ resolution, before: previous, after: history });
  } });
  return { controller, records, get history() { return history; } };
}

test('real controller player attack → enemy attack → full-board Red skipped start preserves both last attack summaries', async () => {
  const h = harness(setup(3));
  await h.controller.start();
  assert.equal(await h.controller.transform(), true);
  assert.equal(await h.controller.drop('ceiling:0:0'), true);
  const sequence = h.records.slice(1);
  assert.deepEqual(sequence.map(record => record.resolution.actor), ['player', 'enemy', 'player']);
  assert.ok(sequence[0]!.resolution.events.some(event => event.type === 'attack'));
  assert.ok(sequence[1]!.resolution.events.some(event => event.type === 'attack'));
  assert.deepEqual(sequence[2]!.resolution.events.map(event => event.type), ['turn-start']);
  assert.equal(sequence[2]!.resolution.events[0]!.type === 'turn-start' && sequence[2]!.resolution.events[0]!.skipped, true);
  assert.equal(sequence[2]!.after, sequence[2]!.before);
  assert.equal(h.history.player, sequence[0]!.after.player);
  assert.equal(h.history.enemy, sequence[1]!.after.enemy);
  assert.ok(h.history.player!.lost.enemy > 0); assert.ok(h.history.enemy!.lost.player > 0);
  assert.equal(h.history.player!.label, '投入'); assert.equal(h.history.player!.turn, 1);
  assert.equal(h.history.enemy!.label, '投入'); assert.equal(h.history.enemy!.turn, 2);
  assert.match(lastActionBreakdownsHtml(h.history), /投入やHP効果のない開始処理は除き/);
  assert.equal(h.controller.snapshot.actor, 'player');
});

test('real controller Red start with actual bonus drop replaces its own record and identifies the bonus action', async () => {
  const h = harness(setup(4));
  await h.controller.start();
  assert.equal(await h.controller.transform(), true);
  assert.equal(await h.controller.drop('ceiling:0:0'), true);
  const bonus = h.records.find(record => record.resolution.events.some(event => event.type === 'turn-start'))!;
  assert.ok(bonus); assert.ok(bonus.resolution.events.some(event => event.type === 'drop'));
  assert.notEqual(bonus.after, bonus.before); assert.notEqual(bonus.after.player, bonus.before.player);
  assert.equal(bonus.after.enemy, bonus.before.enemy);
  assert.equal(h.history.player!.label, '手番開始の追加投入'); assert.equal(h.history.player!.turn, 3);
  assert.match(lastActionBreakdownsHtml(h.history), /自分の手番開始の追加投入/);
  assert.equal(h.controller.snapshot.actor, 'player');
});
