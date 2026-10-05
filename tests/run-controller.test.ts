import test from 'node:test';
import assert from 'node:assert/strict';
import { BattleController } from '../src/app/BattleController.ts';
import type { BattleRunState, BattleView } from '../src/app/BattleController.ts';
import { carryTopPlayerRow, createNextStageConfig, prepareEnemyOrder, stageSeed } from '../src/app/BattleRun.ts';
import {
  battleFixtures, createBattle, defaultConfig, enemyDefinitions, getDropOptions,
} from '../src/core/index.ts';
import type { BattleConfig, BattleState, Box, EnemyId, Resolution } from '../src/core/index.ts';

const firstCandidate = (state: BattleState): string => {
  const option = getDropOptions(state).find(option => option.available);
  assert.ok(option, 'Test requires a legal drop');
  return option.id;
};
const fixture = (id: string): BattleConfig => {
  const value = battleFixtures.find(config => config.id === id);
  assert.ok(value);
  return value;
};
const victoryConfig = (enemyId: EnemyId = 'marujiro'): BattleConfig => ({
  ...fixture('cross-attack'), characterId: 'red', enemyId,
  combatants: {
    ...fixture('cross-attack').combatants,
    player: { ...defaultConfig.combatants.player, initialHp: 17 },
  },
});
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
const box = (id: string, row: number, col: number, owner: Box['owner']): Box => ({
  id, row, col, owner, type: 'normal', status: 'normal',
});

function viewHarness(deferActions = false, deferStages = false) {
  const actionGates: Array<() => void> = [];
  const stageGates: Array<() => void> = [];
  const resolutions: Resolution[] = [];
  const actionSignals: AbortSignal[] = [];
  const transitions: Array<{ before: BattleState; after: BattleState; signal: AbortSignal }> = [];
  const view: BattleView = {
    render() {},
    async animate(resolution, _before, _after, signal) {
      resolutions.push(resolution);
      actionSignals.push(signal);
      if (deferActions) await new Promise<void>(resolve => actionGates.push(resolve));
    },
    async animateStageTransition(before, after, _run, signal) {
      transitions.push({ before, after, signal });
      if (deferStages) await new Promise<void>(resolve => stageGates.push(resolve));
    },
  };
  return { view, actionGates, stageGates, resolutions, actionSignals, transitions };
}

test('run victory advances to a fresh enemy without a dead enemy action or passive attack', async () => {
  const mock = viewHarness();
  const config = victoryConfig();
  const controller = new BattleController(config, mock.view, { run: {} });
  const original = controller.snapshot;
  await controller.drop(firstCandidate(original));
  assert.deepEqual(controller.runSnapshot, {
    stage: 2, defeatedCount: 1, currentEnemyId: 'hikikizan', status: 'active',
  });
  assert.equal(mock.resolutions.length, 1);
  assert.equal(mock.transitions.length, 1);
  assert.equal(mock.resolutions[0]!.events.some(event => event.type === 'link-growth'), true);
  assert.equal(mock.transitions[0]!.before.link3Growth, 1);
  assert.equal(controller.snapshot.link3Growth, 0);
  assert.equal(controller.snapshot.actor, 'player');
  assert.equal(controller.snapshot.turn, 1);
  assert.equal(controller.snapshot.enemyTurnCount, 0);
  assert.equal(controller.snapshot.enemyPatternIndex, 0);
  assert.equal(controller.snapshot.hp.player.current, 17);
  assert.equal(controller.snapshot.hp.enemy.current, enemyDefinitions.hikikizan.maxHp);
  assert.equal(controller.snapshot.result, null);
  assert.equal(controller.snapshot.boxes.length, 3);
  assert.ok(controller.snapshot.boxes.every(item => item.owner === 'player' && item.row === 2));
  assert.deepEqual(original, createBattle(config), 'Old battle snapshots remain unchanged');
  assert.equal(controller.isResolving, false);
});

test('carry keeps only player boxes in the highest own row and settles without crossing terrain', () => {
  const config: BattleConfig = {
    ...defaultConfig,
    board: { width: 5, height: 5, gravity: 'down', terrain: [{ row: 3, col: 0 }], invalidCells: [] },
    initialBoxes: [
      box('higher-enemy', 0, 3, 'enemy'), box('higher-neutral', 0, 4, 'neutral'),
      box('carry-a', 1, 0, 'player'), box('same-row-enemy', 1, 1, 'enemy'),
      box('carry-b', 1, 2, 'player'), box('same-row-neutral', 1, 3, 'neutral'),
      box('lower-player', 2, 4, 'player'), box('lowest-player', 4, 1, 'player'),
    ],
  };
  const state = createBattle(config);
  const carried = carryTopPlayerRow(state);
  assert.deepEqual(carried, [box('carry-a', 2, 0, 'player'), box('carry-b', 4, 2, 'player')]);
  assert.equal(Object.isFrozen(carried), true);
  assert.deepEqual(state.boxes, config.initialBoxes);
});

test('carry with no own boxes is empty and invalid destination geometry rejects', () => {
  const state = createBattle({ ...defaultConfig, initialBoxes: [box('enemy', 7, 0, 'enemy')] });
  assert.deepEqual(carryTopPlayerRow(state), []);
  const invalid: BattleState = {
    ...state,
    boxes: [box('outside', 100, 0, 'player')],
  };
  assert.throws(() => carryTopPlayerRow(invalid), /Invalid box cell/);
});

test('run options copy, slice the finite route, validate, and deterministic stage seeds reset', async () => {
  const order: EnemyId[] = ['marujiro', 'hikikizan', 'nigirin', 'merarun'];
  const config = victoryConfig('nigirin');
  assert.deepEqual(prepareEnemyOrder(config, { enemyOrder: order }), ['nigirin', 'merarun']);
  assert.equal(stageSeed(7, 1), 7);
  assert.equal(stageSeed(7, 2), stageSeed(7, 2));
  assert.notEqual(stageSeed(7, 2), stageSeed(8, 2));
  const mock = viewHarness();
  const controller = new BattleController(config, mock.view, { run: { enemyOrder: order } });
  order.reverse();
  await controller.drop(firstCandidate(controller.snapshot));
  assert.equal(controller.runSnapshot?.currentEnemyId, 'merarun');
  const stageTwo = controller.snapshot;
  const runTwo = controller.runSnapshot;
  await controller.restart();
  assert.equal(controller.runSnapshot?.stage, 1);
  assert.equal(controller.runSnapshot?.defeatedCount, 0);
  assert.equal(controller.runSnapshot?.currentEnemyId, 'nigirin');
  assert.deepEqual(controller.snapshot, createBattle(config));
  await controller.drop(firstCandidate(controller.snapshot));
  assert.deepEqual(controller.snapshot, stageTwo);
  assert.deepEqual(controller.runSnapshot, runTwo);
  assert.equal(Object.isFrozen(controller.runSnapshot), true);
  assert.throws(() => { (controller.runSnapshot as { stage: number }).stage = 88; });
});

test('custom roster is a finite suffix and never wraps back to preceding enemies', () => {
  const config = victoryConfig('hikikizan');
  assert.deepEqual(prepareEnemyOrder(config, { enemyOrder: ['nigirin', 'hikikizan'] }), ['hikikizan']);
  assert.deepEqual(prepareEnemyOrder(config, {}), ['hikikizan', 'nigirin']);
  assert.deepEqual(prepareEnemyOrder(victoryConfig('marujiro'), {}), ['marujiro', 'hikikizan', 'nigirin']);
  assert.deepEqual(prepareEnemyOrder(victoryConfig('nigirin'), {}), ['nigirin']);
  assert.deepEqual(prepareEnemyOrder(victoryConfig('merarun'), {}), ['merarun']);
  assert.throws(() => prepareEnemyOrder(config, { enemyOrder: [] }));
  assert.throws(() => prepareEnemyOrder(config, { enemyOrder: ['nigirin'] }));
  assert.throws(() => prepareEnemyOrder(config, { enemyOrder: ['hikikizan', 'hikikizan'] }));
  assert.throws(() => prepareEnemyOrder(config, { enemyOrder: ['hikikizan', 'unknown' as EnemyId] }));
});

test('defeating the final selected enemy clears the finite run without another stage or enemy turn', async () => {
  for (const enemyId of ['nigirin', 'merarun'] as const) {
    const mock = viewHarness();
    const controller = new BattleController(victoryConfig(enemyId), mock.view, { run: {} });
    await controller.drop(firstCandidate(controller.snapshot));
    assert.deepEqual(controller.runSnapshot, { stage: 1, defeatedCount: 1, currentEnemyId: enemyId, status: 'cleared' });
    assert.equal(controller.snapshot.result?.winner, 'player');
    assert.equal(mock.resolutions.length, 1);
    assert.equal(mock.transitions.length, 0);
    const completed = controller.snapshot;
    assert.equal(await controller.boardSkill('ember'), false);
    await controller.start();
    assert.equal(controller.snapshot, completed);
    assert.equal(mock.resolutions.length, 1);
    await controller.restart();
    assert.equal(controller.runSnapshot?.status, 'active');
    assert.equal(controller.runSnapshot?.defeatedCount, 0);
  }
});

test('invalid restart options preserve an in-flight battle and its animation', async () => {
  const mock = viewHarness(true);
  const controller = new BattleController(victoryConfig(), mock.view, { run: {} });
  const pending = controller.drop(firstCandidate(controller.snapshot));
  const state = controller.snapshot;
  const run = controller.runSnapshot;
  await assert.rejects(controller.restart(undefined, { run: { enemyOrder: [] } }));
  assert.equal(controller.snapshot, state);
  assert.equal(controller.runSnapshot, run);
  assert.equal(mock.actionSignals[0]!.aborted, false);
  mock.actionGates[0]!();
  await pending;
  assert.equal(controller.runSnapshot?.stage, 2);
});

test('restart during victory animation cancels pending stage advancement', async () => {
  const mock = viewHarness(true);
  const config = victoryConfig();
  const controller = new BattleController(config, mock.view, { run: {} });
  const pending = controller.drop(firstCandidate(controller.snapshot));
  assert.equal(controller.snapshot.result?.winner, 'player');
  assert.equal(controller.runSnapshot?.defeatedCount, 1);
  await controller.restart();
  mock.actionGates[0]!();
  await pending;
  assert.equal(mock.actionSignals[0]!.aborted, true);
  assert.equal(mock.transitions.length, 0);
  assert.equal(controller.runSnapshot?.stage, 1);
  assert.equal(controller.runSnapshot?.defeatedCount, 0);
  assert.deepEqual(controller.snapshot, createBattle(config));
});

test('restart during stage transition blocks double input and stale completion', async () => {
  const mock = viewHarness(false, true);
  const config = victoryConfig();
  const controller = new BattleController(config, mock.view, { run: {} });
  const pending = controller.drop(firstCandidate(controller.snapshot));
  await flush();
  assert.equal(controller.runSnapshot?.stage, 2);
  assert.equal(controller.runSnapshot?.status, 'transitioning');
  assert.equal(controller.isResolving, true);
  assert.equal(await controller.drop(firstCandidate(controller.snapshot)), false);
  assert.equal(await controller.boardSkill('ember'), false);
  await controller.restart({ ...config, seed: 99 });
  const restartState = controller.snapshot;
  mock.stageGates[0]!();
  await pending;
  assert.equal(mock.transitions[0]!.signal.aborted, true);
  assert.equal(controller.snapshot, restartState);
  assert.equal(controller.runSnapshot?.stage, 1);
  assert.equal(controller.runSnapshot?.defeatedCount, 0);
  assert.equal(controller.snapshot.rngState, 99);
  assert.equal(controller.isResolving, false);
});

test('destroy during victory prevents transition and cannot be revived by delayed handlers', async () => {
  const mock = viewHarness(true);
  const controller = new BattleController(victoryConfig(), mock.view, { run: {} });
  const pending = controller.drop(firstCandidate(controller.snapshot));
  controller.destroy();
  const state = controller.snapshot;
  const run = controller.runSnapshot;
  mock.actionGates[0]!();
  await pending;
  await controller.restart();
  await controller.start();
  assert.equal(await controller.boardSkill('ember'), false);
  assert.equal(controller.snapshot, state);
  assert.equal(controller.runSnapshot, run);
  assert.equal(mock.transitions.length, 0);
});

test('destroy during committed transition prevents later advancement or unlock rendering', async () => {
  const mock = viewHarness(false, true);
  let renders = 0;
  mock.view.render = () => { renders += 1; };
  const controller = new BattleController(victoryConfig(), mock.view, { run: {} });
  const pending = controller.drop(firstCandidate(controller.snapshot));
  await flush();
  controller.destroy();
  const state = controller.snapshot;
  const run = controller.runSnapshot;
  const count = renders;
  mock.stageGates[0]!();
  await pending;
  assert.equal(mock.transitions[0]!.signal.aborted, true);
  assert.equal(controller.snapshot, state);
  assert.equal(controller.runSnapshot, run);
  assert.equal(renders, count);
  assert.equal(await controller.drop(firstCandidate(state)), false);
});

test('animation, stage, render, and error-display failures never replay a victory', async () => {
  let actions = 0;
  let transitions = 0;
  const controller = new BattleController(victoryConfig(), {
    render() { throw new Error('render failed'); },
    async animate() { actions += 1; throw new Error('action animation failed'); },
    async animateStageTransition() { transitions += 1; throw new Error('transition failed'); },
    reportError() { throw new Error('error display failed'); },
  }, { run: {} });
  await controller.drop(firstCandidate(controller.snapshot));
  assert.equal(actions, 1);
  assert.equal(transitions, 1);
  assert.equal(controller.runSnapshot?.stage, 2);
  assert.equal(controller.runSnapshot?.defeatedCount, 1);
  assert.equal(controller.isResolving, false);
  await controller.start();
  assert.equal(actions, 1);
  assert.equal(transitions, 1);
});

test('run loss is terminal until full run restart', async () => {
  const config: BattleConfig = {
    ...defaultConfig, characterId: 'red', enemyId: 'marujiro',
    combatants: { ...defaultConfig.combatants, player: { ...defaultConfig.combatants.player, initialHp: 3 } },
  };
  const mock = viewHarness();
  const controller = new BattleController(config, mock.view, { run: {} });
  await controller.boardSkill('ember');
  assert.equal(controller.snapshot.result?.winner, 'enemy');
  assert.equal(controller.snapshot.hp.player.current, 0);
  assert.equal(controller.runSnapshot?.status, 'lost');
  const lost = controller.snapshot;
  assert.equal(await controller.drop(firstCandidate(lost)), false);
  assert.equal(await controller.boardSkill('ember'), false);
  await controller.start();
  assert.equal(controller.snapshot, lost);
  assert.equal(mock.resolutions.length, 1);
  assert.equal(mock.transitions.length, 0);
  assert.throws(() => createNextStageConfig(config, lost, 'hikikizan', 2));
  await controller.restart();
  assert.equal(controller.runSnapshot?.stage, 1);
  assert.equal(controller.runSnapshot?.defeatedCount, 0);
  assert.equal(controller.runSnapshot?.status, 'active');
});

test('restart can switch run mode and selected combatants while legacy fixtures stay standalone', async () => {
  const mock = viewHarness();
  const config = victoryConfig();
  const controller = new BattleController(config, mock.view, { run: {} });
  await controller.restart(config, {});
  assert.equal(controller.runSnapshot, null);
  await controller.drop(firstCandidate(controller.snapshot));
  assert.equal(controller.snapshot.result?.winner, 'player');
  assert.equal(mock.transitions.length, 0);
  await controller.restart({ ...config, characterId: 'blue', enemyId: 'nigirin' }, { run: {} });
  assert.equal((controller.runSnapshot as BattleRunState | null)?.currentEnemyId, 'nigirin');
  assert.equal(controller.snapshot.config.characterId, 'blue');
  await controller.restart(fixture('cross-attack'));
  assert.equal(controller.runSnapshot, null);
  await controller.drop(firstCandidate(controller.snapshot));
  assert.equal(controller.snapshot.result?.winner, 'player');
  assert.equal(mock.transitions.length, 0);
});

test('three-stage route reaches game clear in fixed order and replays the complete run after restart', async () => {
  const config: BattleConfig = {
    ...defaultConfig, characterId: 'red', enemyId: 'marujiro',
    board: { width: 1, height: 4, gravity: 'down', terrain: [], invalidCells: [] },
    initialBoxes: [box('start-a', 2, 0, 'player'), box('start-b', 3, 0, 'player')],
    combatants: {
      player: { maxHp: 30, initialHp: 17, attacks: { 3: 100, 4: 100, 5: 100 } },
      enemy: { maxHp: 60, initialHp: 60, attacks: { 3: 2, 4: 4, 5: 6 } },
    },
    enemyPattern: [{ type: 'heal', amount: 0 }],
  };
  const mock = viewHarness();
  const controller = new BattleController(config, mock.view, { run: {} });
  const seen = [controller.runSnapshot!.currentEnemyId];
  const commands: string[] = [];
  for (let step = 0; step < 10 && controller.runSnapshot!.status !== 'cleared'; step += 1) {
    commands.push(firstCandidate(controller.snapshot));
    await controller.drop(commands.at(-1)!);
    const enemy = controller.runSnapshot!.currentEnemyId;
    if (seen.at(-1) !== enemy) seen.push(enemy);
  }
  assert.deepEqual(seen, ['marujiro', 'hikikizan', 'nigirin']);
  assert.deepEqual(controller.runSnapshot, { stage: 3, defeatedCount: 3, currentEnemyId: 'nigirin', status: 'cleared' });
  assert.equal(mock.transitions.length, 2);
  assert.equal(commands.length, 5);
  assert.equal(mock.resolutions.filter(resolution => resolution.actor === 'enemy').length, 2);
  assert.equal(controller.snapshot.hp.player.current, 17);
  const finalState = controller.snapshot;
  const finalRun = controller.runSnapshot;
  await controller.restart();
  for (const command of commands) await controller.drop(command);
  assert.deepEqual(controller.snapshot, finalState);
  assert.deepEqual(controller.runSnapshot, finalRun);
});

test('simultaneous board-skill knockout loses the run without a carry or next enemy', async () => {
  const config: BattleConfig = {
    ...defaultConfig, characterId: 'blue', enemyId: 'marujiro',
    board: { width: 2, height: 1, gravity: 'down', terrain: [], invalidCells: [] },
    initialBoxes: [box('own', 0, 0, 'player'), box('enemy', 0, 1, 'enemy')],
    combatants: {
      player: { ...defaultConfig.combatants.player, initialHp: 2 },
      enemy: { ...defaultConfig.combatants.enemy, initialHp: 2 },
    },
  };
  const mock = viewHarness();
  const controller = new BattleController(config, mock.view, { run: {} });
  await controller.boardSkill('pain-shared', 0);
  assert.equal(controller.snapshot.hp.player.current, 0);
  assert.equal(controller.snapshot.hp.enemy.current, 0);
  assert.equal(controller.snapshot.result?.winner, 'enemy');
  assert.equal(controller.runSnapshot?.status, 'lost');
  assert.equal(controller.runSnapshot?.stage, 1);
  assert.equal(controller.runSnapshot?.defeatedCount, 0);
  assert.equal(mock.resolutions.length, 1);
  assert.equal(mock.transitions.length, 0);
});

test('carry follows current ownership, including boxes converted from the enemy', () => {
  const state = createBattle({
    ...defaultConfig,
    initialBoxes: [
      box('originally-enemy-now-player', 2, 0, 'player'),
      box('originally-player-now-enemy', 2, 1, 'enemy'),
      box('lower-own', 3, 2, 'player'),
    ],
  });
  assert.deepEqual(carryTopPlayerRow(state), [box('originally-enemy-now-player', 7, 0, 'player')]);
});
