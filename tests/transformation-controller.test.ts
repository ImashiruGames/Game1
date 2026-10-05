import test from 'node:test';
import assert from 'node:assert/strict';
import { BattleController } from '../src/app/BattleController.ts';
import type { BattleView } from '../src/app/BattleController.ts';
import { defaultConfig } from '../src/core/index.ts';
import type { BattleConfig, BattleState, Resolution } from '../src/core/index.ts';
const bonusConfig = (remainingStarts = 2): BattleConfig => ({ ...defaultConfig, characterId: 'red', enemyId: 'marujiro',
  initialTransformation: { character: 'red', scope: 'run', remainingStarts },
  board: { width: 1, height: 3, gravity: 'down', terrain: [], invalidCells: [] },
  initialBoxes: [1, 2].map(row => ({ id: `b:${row}`, row, col: 0, owner: 'player', type: 'normal', status: 'normal' })),
  combatants: { ...defaultConfig.combatants, enemy: { ...defaultConfig.combatants.enemy, initialHp: 1 } },
});
function harness(defer = false) {
  const resolutions: Resolution[] = []; const states: BattleState[] = []; const signals: AbortSignal[] = []; const gates: Array<() => void> = [];
  const view: BattleView = { render() {}, async animate(resolution, _before, after, signal) {
    resolutions.push(resolution); states.push(after); signals.push(signal);
    if (defer) await new Promise<void>(resolve => gates.push(resolve));
  } };
  return { view, resolutions, states, signals, gates };
}
test('first bonus kill transitions before another player action, then runs only the remaining stage-start bonus', async () => {
  const h = harness(); const controller = new BattleController(bonusConfig(2), h.view, { run: {} });
  await controller.start();
  assert.equal(controller.runSnapshot?.stage, 2);
  assert.equal(controller.snapshot.config.enemyId, 'hikikizan');
  assert.equal(controller.snapshot.actor, 'player'); assert.equal(controller.snapshot.turn, 1);
  assert.equal(controller.snapshot.enemyTurnCount, 0); assert.equal(controller.snapshot.boxes.length, 2);
  assert.equal(h.resolutions.length, 2);
  assert.ok(h.resolutions.every(resolution => resolution.events.some(event => event.type === 'turn-start')));
  assert.equal(controller.snapshot.transformation?.character === 'red' && controller.snapshot.transformation.remainingStarts, 0);
  assert.equal(controller.snapshot.gauge, 12);
  await controller.start(); assert.equal(h.resolutions.length, 2);
});
test('second bonus kill expires Red at victory boundary and cannot create a third-turn bonus', async () => {
  const h = harness(); const controller = new BattleController(bonusConfig(1), h.view, { run: {} });
  await controller.start();
  assert.equal(controller.runSnapshot?.stage, 2); assert.equal(controller.snapshot.transformation, null);
  assert.equal(controller.snapshot.boxes.length, 1); assert.equal(h.resolutions.length, 1);
  assert.ok(h.resolutions[0]!.events.some(event => event.type === 'transformation-ended'));
  assert.equal(controller.snapshot.gauge, 12);
});
test('restart during bonus animation cancels old stage work and leaves the new game untouched', async () => {
  const h = harness(true); const controller = new BattleController(bonusConfig(2), h.view, { run: {} });
  const pending = controller.start();
  assert.equal(h.resolutions.length, 1); assert.equal(await controller.boardSkill('ember'), false);
  await controller.restart(defaultConfig, {});
  assert.equal(h.signals[0]!.aborted, true);
  h.gates[0]!(); await pending;
  assert.equal(controller.snapshot.config.id, 'standard'); assert.equal(controller.snapshot.boxes.length, 0);
  assert.equal(controller.snapshot.transformation, null); assert.equal(controller.snapshot.gauge, 0);
  assert.equal(h.resolutions.length, 1); assert.equal(controller.isResolving, false);
});
test('destroy during bonus animation cannot advance to another stage or apply later hooks', async () => {
  const h = harness(true); const controller = new BattleController(bonusConfig(2), h.view, { run: {} });
  const pending = controller.start(); controller.destroy(); h.gates[0]!(); await pending;
  assert.equal(h.signals[0]!.aborted, true); assert.equal(h.resolutions.length, 1); assert.equal(controller.runSnapshot?.stage, 1);
  assert.equal(await controller.boardSkill('ember'), false);
});
test('presentation errors and repeated start calls cannot replay a committed bonus', async () => {
  let count = 0;
  const config = { ...bonusConfig(2), initialBoxes: [], board: defaultConfig.board };
  const controller = new BattleController(config, { render() {}, async animate() { count += 1; throw new Error('view'); }, reportError() {} });
  await controller.start(); await controller.start();
  assert.equal(count, 1); assert.equal(controller.snapshot.boxes.length, 1); assert.equal(controller.snapshot.turn, 1);
  assert.equal(controller.snapshot.transformation?.character === 'red' && controller.snapshot.transformation.remainingStarts, 1);
  assert.ok(Object.isFrozen(controller.snapshot)); assert.ok(Object.isFrozen(controller.snapshot.transformation));
});
