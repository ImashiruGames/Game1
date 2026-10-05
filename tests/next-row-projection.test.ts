import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, calculateLinks, createBattle, needsTurnStart, settleBoxes } from '../src/next/core/index.ts';
import type { BattleConfig, BattleState, Box, Cell } from '../src/next/core/types.ts';
import { prepareTrialSetup, trialFixture } from '../src/next/config.ts';
import { projectRowRemoval } from '../src/next/ui/rowProjection.ts';
import { rowProjectionReviewCases, rowProjectionReviewFixture } from '../src/next/ui/rowProjectionReviewFixture.ts';
import type { RowProjectionReviewCase } from '../src/next/ui/rowProjectionReviewFixture.ts';

const box = (id: string, row: number, col: number, owner: Box['owner']): Box => ({ id, row, col, owner, type: 'normal', status: 'normal' });
const remove = (row: number) => ({ type: 'board-skill', skillId: 'pain-shared', row }) as const;
const position = (boxes: readonly Box[], id: string): Cell => {
  const found = boxes.find(candidate => candidate.id === id)!;
  return { row: found.row, col: found.col };
};
const setupState = (overrides: Partial<BattleConfig> = {}): BattleState => createBattle({
  ...trialFixture('normal', 'blue', 'marujiro', 1, 'manual'), ...overrides,
});

test('row projection preserves all owners and stack order with explicit removed IDs and original-to-final cells', () => {
  const state = setupState({ initialBoxes: [
    box('player-top', 5, 0, 'player'), box('player-lower', 6, 0, 'neutral'), box('remove-player', 7, 0, 'player'),
    box('enemy-top', 6, 1, 'enemy'), box('remove-enemy', 7, 1, 'enemy'),
    box('neutral-top', 6, 2, 'neutral'), box('remove-neutral', 7, 2, 'neutral'),
  ] });
  const view = projectRowRemoval(state, 7)!;
  assert.strictEqual(view.sourceState, state);
  assert.equal(view.row, 7); assert.equal(view.isEmptyRow, false); assert.equal(view.result, null);
  assert.deepEqual(view.removedBoxIds, ['remove-player', 'remove-enemy', 'remove-neutral']);
  assert.deepEqual(view.boxes, [box('player-top', 6, 0, 'player'), box('player-lower', 7, 0, 'neutral'), box('enemy-top', 7, 1, 'enemy'), box('neutral-top', 7, 2, 'neutral')]);
  assert.deepEqual(view.moves, [
    { boxId: 'player-top', from: { row: 5, col: 0 }, to: { row: 6, col: 0 } },
    { boxId: 'player-lower', from: { row: 6, col: 0 }, to: { row: 7, col: 0 } },
    { boxId: 'enemy-top', from: { row: 6, col: 1 }, to: { row: 7, col: 1 } },
    { boxId: 'neutral-top', from: { row: 6, col: 2 }, to: { row: 7, col: 2 } },
  ]);
  assert.deepEqual(view.boxes, applyAction(state, remove(7)).state.boxes);
});

test('terrain and invalid cells keep settling inside each vertical segment and retain stationary boxes', () => {
  const state = createBattle(rowProjectionReviewFixture('barriers').config), view = projectRowRemoval(state, 3)!;
  assert.deepEqual(settleBoxes(state.config.board, state.boxes), state.boxes, 'QA source starts settled');
  assert.deepEqual(view.removedBoxIds, ['row-review:terrain-removed', 'row-review:invalid-removed', 'row-review:open-removed']);
  assert.deepEqual(view.moves, [
    { boxId: 'row-review:terrain-player', from: { row: 2, col: 0 }, to: { row: 3, col: 0 } },
    { boxId: 'row-review:invalid-enemy', from: { row: 2, col: 1 }, to: { row: 3, col: 1 } },
    { boxId: 'row-review:open-neutral', from: { row: 2, col: 2 }, to: { row: 3, col: 2 } },
  ]);
  for (const id of ['row-review:terrain-bottom', 'row-review:invalid-bottom', ...[4, 5, 6, 7].map(row => `row-review:open-support-${row}`)]) {
    assert.deepEqual(position(view.boxes, id), position(state.boxes, id));
  }
  assert.equal(view.boxes.length, 9);
  assert.deepEqual(view.boxes, applyAction(state, remove(3)).state.boxes);
});

test('enemy vertical geometry reconnects through passive settling without an attack or future enemy action', () => {
  const state = createBattle(rowProjectionReviewFixture('reconnect').config), view = projectRowRemoval(state, 6)!;
  const link = (boxes: readonly Box[]) => calculateLinks(state.config.board, boxes, 'row-review:reconnect-upper').find(item => item.axis === 'vertical')!;
  assert.equal(link(state.boxes).count, 2); assert.equal(link(view.boxes).count, 3);
  assert.deepEqual(view.boxes, [box('row-review:reconnect-upper', 5, 3, 'enemy'), box('row-review:reconnect-middle', 6, 3, 'enemy'), box('row-review:reconnect-bottom', 7, 3, 'enemy')]);
  const committed = applyAction(state, remove(6));
  assert.deepEqual(committed.state.hp, state.hp);
  assert.deepEqual(committed.resolution!.links, []); assert.equal(committed.resolution!.originBoxId, null); assert.equal(committed.resolution!.enemyPlannedAction, null);
  assert.equal(committed.resolution!.events.some(event => event.type === 'attack' || event.type === 'drop' || event.type === 'heal' || event.type === 'enemy-wait'), false);
  assert.equal(committed.state.enemyTurnCount, state.enemyTurnCount); assert.equal(committed.state.enemyPatternIndex, state.enemyPatternIndex);
  assert.equal(committed.state.rngState, state.rngState); assert.equal(committed.state.nextBoxId, state.nextBoxId);
  assert.equal(committed.state.actor, 'enemy'); assert.deepEqual(view.boxes, committed.state.boxes);
});

test('passive fall can break an existing enemy horizontal three without firing its old or new geometry', () => {
  const base = trialFixture('normal', 'blue', 'marujiro', 1, 'manual');
  const state = setupState({ board: { ...base.board, terrain: [{ row: 6, col: 0 }] }, initialBoxes: [
    box('left', 5, 0, 'enemy'), box('middle', 5, 1, 'enemy'), box('right', 5, 2, 'enemy'),
    box('remove-middle', 6, 1, 'neutral'), box('remove-right', 6, 2, 'neutral'),
    box('base-middle', 7, 1, 'neutral'), box('base-right', 7, 2, 'neutral'),
  ] });
  const view = projectRowRemoval(state, 6)!;
  assert.equal(calculateLinks(state.config.board, state.boxes, 'left').find(link => link.axis === 'horizontal')!.count, 3);
  assert.deepEqual(position(view.boxes, 'left'), { row: 5, col: 0 });
  assert.deepEqual(position(view.boxes, 'middle'), { row: 6, col: 1 });
  assert.deepEqual(position(view.boxes, 'right'), { row: 6, col: 2 });
  for (const id of ['left', 'middle', 'right']) assert.equal(calculateLinks(state.config.board, view.boxes, id).some(link => link.tier !== null), false);
  const committed = applyAction(state, remove(6));
  assert.deepEqual(committed.state.hp, state.hp); assert.deepEqual(committed.resolution!.links, []);
  assert.equal(committed.resolution!.events.some(event => event.type === 'attack'), false);
});

test('in-bounds empty rows stay legal and display unchanged settled boxes while real confirmation uses a turn', () => {
  const state = setupState({ initialBoxes: [box('base', 7, 0, 'enemy')] }), view = projectRowRemoval(state, 0)!;
  assert.equal(view.row, 0); assert.equal(view.isEmptyRow, true);
  assert.deepEqual(view.removedBoxIds, []); assert.deepEqual(view.moves, []); assert.deepEqual(view.boxes, state.boxes);
  const committed = applyAction(state, remove(0));
  assert.ok(committed.accepted); assert.equal(committed.state.turn, state.turn + 1); assert.equal(committed.state.actor, 'enemy');
  assert.equal(state.turn, 1); assert.equal(state.actor, 'player');
});

test('terminal simultaneous self/enemy damage still settles the exact final boxes and reports the core loss', () => {
  const base = trialFixture('normal', 'blue', 'marujiro', 1, 'manual');
  const state = setupState({ initialBoxes: [box('falls', 6, 0, 'neutral'), box('self-hit', 7, 0, 'enemy'), box('enemy-hit', 7, 1, 'player')],
    combatants: { player: { ...base.combatants.player, initialHp: 1 }, enemy: { ...base.combatants.enemy, initialHp: 1 } },
  });
  const view = projectRowRemoval(state, 7)!, committed = applyAction(state, remove(7));
  assert.equal(committed.state.hp.player.current, -1); assert.equal(committed.state.hp.enemy.current, -1);
  assert.deepEqual(view.result, { winner: 'enemy', reason: 'hp-zero' });
  assert.deepEqual(view.boxes, [box('falls', 7, 0, 'neutral')]); assert.deepEqual(view.boxes, committed.state.boxes);
  assert.deepEqual(view.moves, [{ boxId: 'falls', from: { row: 6, col: 0 }, to: { row: 7, col: 0 } }]);
  assert.equal(committed.state.turn, state.turn); assert.equal(committed.state.enemyTurnCount, 0);
});

test('enemy, ended, unavailable skill and invalid rows have no projection', () => {
  const state = setupState();
  for (const row of [-1, state.config.board.height, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.equal(projectRowRemoval(state, row), null);
  for (const blocked of [
    { ...state, actor: 'enemy' as const }, { ...state, result: { winner: 'player' as const, reason: 'hp-zero' as const } },
    setupState({ playerSkills: { boardSkills: [], shapeSkills: [], linkSkills: [] } }),
    createBattle(trialFixture('normal', 'red', 'marujiro', 1, 'manual')),
  ]) assert.equal(projectRowRemoval(blocked, 0), null);
});

test('required turn-start is rejected without executing the bonus or consuming RNG', () => {
  const state = createBattle({ ...trialFixture('normal', 'red', 'marujiro', 1, 'manual'),
    playerSkills: { boardSkills: ['pain-shared'], shapeSkills: [], linkSkills: [] },
    initialTransformation: { character: 'red', scope: 'run', remainingStarts: 2 },
  });
  const before = JSON.stringify(state);
  assert.ok(needsTurnStart(state)); assert.equal(applyAction(state, remove(7)).reason, 'turn-start-required');
  assert.equal(projectRowRemoval(state, 7), null); assert.equal(JSON.stringify(state), before);
});

test('repeated row changes and abandoned projections leave state, build, RNG and later real actions exactly unchanged', () => {
  for (const kind of ['barriers', 'reconnect'] as const) {
    const state = createBattle(rowProjectionReviewFixture(kind).config), before = JSON.stringify(state), sourceBoxes = state.boxes, sourceBuild = state.build;
    const row = kind === 'barriers' ? 3 : 6, baseline = applyAction(state, remove(row));
    const baselineEnemy = applyAction(baseline.state, { type: 'enemy' });
    for (let index = 0; index < 24; index++) {
      const view = projectRowRemoval(state, index % state.config.board.height)!;
      assert.strictEqual(view.sourceState, state); assert.equal(view.row, index % state.config.board.height);
      assert.ok(Object.isFrozen(view)); assert.ok(Object.isFrozen(view.boxes)); assert.ok(Object.isFrozen(view.removedBoxIds)); assert.ok(Object.isFrozen(view.moves));
      for (const move of view.moves) { assert.ok(Object.isFrozen(move)); assert.ok(Object.isFrozen(move.from)); assert.ok(Object.isFrozen(move.to)); }
    }
    assert.equal(JSON.stringify(state), before); assert.strictEqual(state.boxes, sourceBoxes); assert.strictEqual(state.build, sourceBuild);
    assert.deepEqual(projectRowRemoval(state, row)!.boxes, baseline.state.boxes);
    assert.deepEqual(applyAction(state, remove(row)), baseline);
    assert.deepEqual(applyAction(applyAction(state, remove(row)).state, { type: 'enemy' }), baselineEnemy);
    assert.equal(projectRowRemoval(baseline.state, row), null, 'a stale player projection cannot be regenerated from the enemy snapshot');
    const restarted = createBattle(state.config);
    assert.notStrictEqual(projectRowRemoval(restarted, row)!.sourceState, state, 'caller can invalidate by snapshot identity');
  }
});

test('optional review setup stays Blue/stage1/seed1 with normal combat numbers and never changes normal setup', () => {
  const normalArgs = { character: 'blue', firstEnemy: 'marujiro', seed: 1, mode: 'manual', stage: 1, fixture: 'normal', route: 'boss-loop' } as const;
  const normal = prepareTrialSetup(normalArgs), before = JSON.stringify(normal);
  assert.equal(rowProjectionReviewCases.length, 2);
  for (const item of rowProjectionReviewCases) {
    const setup = rowProjectionReviewFixture(item.id), state = createBattle(setup.config);
    assert.match(item.button, /^検証用：/); assert.equal(setup.options.run!.startStage, 1); assert.equal(state.config.seed, 1);
    assert.equal(state.config.characterId, 'blue'); assert.equal(state.config.board.width, 6); assert.equal(state.config.board.height, 8);
    assert.deepEqual(setup.config.combatants, normal.config.combatants); assert.deepEqual(setup.config.tuning, normal.config.tuning);
    assert.deepEqual(setup.options, normal.options); assert.deepEqual(setup, rowProjectionReviewFixture(item.id));
    assert.deepEqual(settleBoxes(state.config.board, state.boxes), state.boxes);
    assert.ok(projectRowRemoval(state, item.row));
  }
  assert.equal(JSON.stringify(normal), before); assert.deepEqual(prepareTrialSetup(normalArgs), normal);
  assert.throws(() => rowProjectionReviewFixture('normal' as RowProjectionReviewCase), /Unknown/);
});
