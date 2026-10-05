import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, battleFixtures, carryTransformationState, createBattle, createCharacterBattleConfig, defaultConfig, gaugeDefinition, needsTurnStart, restartBattle, getDropOptions } from '../src/core/index.ts';
import type { BattleConfig, BattleState, Box, CharacterId } from '../src/core/index.ts';
import { gainGauge } from '../src/core/gauge.ts';
import { applyHealingEffect } from '../src/core/effectDispatcher.ts';
import { resolveActiveDrop } from '../src/core/activeDrop.ts';
import { sampleUniformIndex } from '../src/core/random.ts';
const box = (row: number, col: number, owner: Box['owner'] = 'player'): Box => ({ id: `b:${row}:${col}`, row, col, owner, type: 'normal', status: 'normal' });
const config = (character: CharacterId, patch: Partial<BattleConfig> = {}): BattleConfig => ({ ...defaultConfig, characterId: character, ...patch });
const six = (character: CharacterId, gauge: number, enemyHp = 100) => createBattle(config(character, { initialGauge: gauge,
  board: { width: 3, height: 8, gravity: 'down', terrain: [], invalidCells: [] }, initialBoxes: [3, 4, 5, 6, 7].map(row => box(row, 1)),
  combatants: { ...defaultConfig.combatants, enemy: { ...defaultConfig.combatants.enemy, initialHp: enemyHp, maxHp: 100 } } }));
const drop = (state: BattleState, col = 1) => applyAction(state, { type: 'drop', candidateId: `ceiling:${col}:0` });
const start = (state: BattleState) => applyAction(state, { type: 'start-turn' });
const ember = (state: BattleState) => applyAction(state, { type: 'board-skill', skillId: 'ember' });
function activeRed(patch: Partial<BattleConfig> = {}) { return createBattle(config('red', { initialTransformation: { character: 'red', scope: 'run', remainingStarts: 2 }, ...patch })); }
for (const [character, cost, cap] of [['blue', 80, 120], ['red', 100, 150]] as const) {
  test(`${character} uses exact cost/cap with flat gains and preserved overflow`, () => {
    assert.deepEqual(gaugeDefinition(character), { cost, cap });
    assert.equal(gainGauge(createBattle(config(character, { initialGauge: cap - 2 })), 8, 'link').state.gauge, cap);
    const result = drop(six(character, cost));
    assert.equal(result.state.gauge, 25);
    assert.equal(result.state.transformation?.character, character);
    assert.equal(result.resolution!.events.filter(event => event.type === 'transformation').length, 1);
  });
  test(`${character} current link gain qualifies, but turn-end +1 cannot qualify retroactively`, () => {
    const ready = drop(six(character, cost - 24));
    assert.equal(ready.state.transformation?.character, character); assert.equal(ready.state.gauge, 1);
    const short = drop(six(character, cost - 25));
    assert.equal(short.state.transformation, null); assert.equal(short.state.gauge, cost);
  });
  test(`${character} winning insertion keeps gauge and never activates or spends a cost`, () => {
    const result = drop(six(character, cost - 24, 1));
    assert.equal(result.state.result?.winner, 'player'); assert.equal(result.state.transformation, null); assert.equal(result.state.gauge, cost + 1);
    assert.equal(result.resolution!.events.some(event => event.type === 'transformation'), false);
  });
}
test('six-box eligibility needs an active origin and raw six count, not capped attack tier', () => {
  const state = six('blue', 80);
  assert.equal(drop(state, 0).state.transformation, null);
  assert.equal(drop({ ...state, boxes: state.boxes.slice(1) }).state.transformation, null);
  assert.equal(applyAction(state, { type: 'board-skill', skillId: 'pain-shared', row: 0 }).state.transformation, null);
});
test('each attacking axis charges raw count×4 once despite Grow Fire replacement', () => {
  const result = drop(createBattle(createCharacterBattleConfig('red', 'marujiro', battleFixtures.find(f => f.id === 'grow-fire')!)));
  assert.equal(result.state.gauge, 25);
  assert.deepEqual(result.resolution!.events.filter(event => event.type === 'gauge').map(event => [event.source, event.amount]), [['link', 12], ['link', 12], ['turn', 1]]);
});
test('damage charge counts actual lost HP including self-cost, never overkill', () => {
  for (const hp of [1, 2, 3, 10]) {
    const result = ember(createBattle(config('red', { combatants: { ...defaultConfig.combatants, player: { ...defaultConfig.combatants.player, initialHp: hp } } })));
    assert.equal(result.state.gauge, Math.min(3, hp) + 1);
    assert.equal(result.resolution!.events.filter(event => event.type === 'gauge' && event.source === 'damage').reduce((sum, event) => sum + (event.type === 'gauge' ? event.amount : 0), 0), Math.min(3, hp));
  }
});
test('Blue reflects nominal healing even at full HP, before later links', () => {
  const fixture = battleFixtures.find(f => f.id === 'health-plus')!;
  for (const hp of [10, 27, 30]) {
    const state = createBattle(createCharacterBattleConfig('blue', 'marujiro', { ...fixture, initialTransformation: { character: 'blue', scope: 'stage' }, combatants: { ...fixture.combatants, player: { ...fixture.combatants.player, initialHp: hp } } }));
    const result = drop(state, 0); const events = result.resolution!.events;
    const heal = events.find(event => event.type === 'heal')!; const reflection = events.find(event => event.type === 'damage')!;
    assert.equal(heal.amount, Math.min(15, 30 - hp)); assert.equal(reflection.damage, 15); assert.equal(reflection.source, 'blue-transformation');
    assert.ok(events.indexOf(heal) < events.indexOf(reflection)); assert.ok(events.indexOf(reflection) < events.findIndex(event => event.type === 'attack'));
    assert.equal(result.state.hp.enemy.current, 41);
  }
});
test('healing reaction is inactive before transformation and ignores enemy healing', () => {
  const normal = createBattle(config('blue'));
  assert.equal(applyHealingEffect(normal, 'player', 15, 'health').events.length, 1);
  assert.equal(applyHealingEffect({ ...normal, transformation: { character: 'blue', scope: 'stage' } }, 'enemy', 10, 'nigirin').events.length, 1);
});
test('transformation follows every attack and cannot boost the heal that activated it', () => {
  const base = six('blue', 80);
  const state = { ...base, boxes: [...base.boxes, box(2, 0), box(2, 2), box(3, 0), box(3, 2), box(4, 0), box(4, 2), box(5, 0), box(5, 2), box(6, 0), box(6, 2), box(7, 0), box(7, 2)] };
  // Explicit pure resolver accepts a legal origin; the fixture forms a six-plus vertical and a plus.
  const result = drop(state); const events = result.resolution!.events;
  assert.ok(events.some(event => event.type === 'heal'));
  assert.equal(events.some(event => event.type === 'damage' && event.source === 'blue-transformation'), false);
  assert.ok(events.findIndex(event => event.type === 'transformation') > events.map(event => event.type).lastIndexOf('attack'));
});
test('Red start hook uniformly inserts once without spending the ordinary action', () => {
  const state = activeRed(); const legal = getDropOptions(state).filter(option => option.available); const expected = sampleUniformIndex(state.rngState, legal.length);
  const result = start(state);
  assert.equal(result.accepted, true); assert.equal(result.state.turn, state.turn); assert.equal(result.state.actor, 'player'); assert.equal(result.state.enemyTurnCount, 0);
  assert.equal(result.state.transformation?.character === 'red' && result.state.transformation.remainingStarts, 1);
  assert.equal(result.resolution!.events.find(event => event.type === 'drop')!.candidateId, legal[expected.index]!.id);
  assert.equal(result.state.rngState, expected.rngState); assert.equal(result.state.gauge, 0); assert.equal(needsTurnStart(result.state), false);
  assert.equal(start(result.state).reason, 'turn-start-unavailable'); assert.equal(drop(state).reason, 'turn-start-required'); assert.equal(ember(result.state).accepted, true);
});
test('Red remains active through second ordinary action and expires at its end', () => {
  let state = start(activeRed()).state; state = ember(state).state; assert.equal(state.transformation?.character, 'red');
  state = applyAction(state, { type: 'enemy' }).state; state = start(state).state;
  assert.equal(state.transformation?.character === 'red' && state.transformation.remainingStarts, 0);
  const done = ember(state); assert.equal(done.state.transformation, null); assert.equal(done.resolution!.events.filter(event => event.type === 'transformation-ended').length, 1);
});
test('blocked bonus consumes one start but no RNG, HP, turn, or ordinary action', () => {
  const state = activeRed({ board: { width: 1, height: 1, gravity: 'down', terrain: [], invalidCells: [] }, initialBoxes: [box(0, 0)] }); const result = start(state);
  assert.equal(result.state.rngState, state.rngState); assert.deepEqual(result.state.hp, state.hp); assert.equal(result.state.turn, 1);
  assert.deepEqual(result.resolution!.events, [{ type: 'turn-start', remainingStarts: 1, skipped: true }]); assert.equal(ember(result.state).accepted, true);
});
test('bonus resolver triggers active links and growth but never re-transforms while active', () => {
  const state = { ...six('red', 150), transformation: { character: 'red', scope: 'run', remainingStarts: 2 } as const };
  const result = resolveActiveDrop(state, getDropOptions(state).find(option => option.id === 'ceiling:1:0')!);
  assert.equal(result.events.find(event => event.type === 'attack')!.damage, 7); assert.equal(result.state.link3Growth, 1); assert.equal(result.state.gauge, 150);
  assert.equal(result.events.some(event => event.type === 'transformation'), false);
});
test('free-drop victory keeps turn and never runs an enemy or end-turn charge', () => {
  const state = activeRed({ board: { width: 1, height: 3, gravity: 'down', terrain: [], invalidCells: [] }, initialBoxes: [box(1, 0), box(2, 0)], combatants: { ...defaultConfig.combatants, enemy: { ...defaultConfig.combatants.enemy, initialHp: 1 } } });
  const result = start(state); assert.equal(result.state.result?.winner, 'player'); assert.equal(result.state.turn, 1); assert.equal(result.state.gauge, 12); assert.equal(ember(result.state).reason, 'battle-ended'); assert.equal(result.state.enemyTurnCount, 0);
});
test('stage carry preserves gauge and Red duration, ends Blue, and restart uses original seeds', () => {
  const next = createBattle(config('red')); const previous = { ...activeRed(), gauge: 121, transformation: { character: 'red', scope: 'run', remainingStarts: 1 } as const, playerTurnStarted: true };
  const carried = carryTransformationState(next, previous); assert.equal(carried.gauge, 121); assert.equal(carried.transformation?.character === 'red' && carried.transformation.remainingStarts, 1); assert.equal(needsTurnStart(carried), true); assert.deepEqual(restartBattle(carried), next);
  const blue = carryTransformationState(createBattle(config('blue')), { ...createBattle(config('blue')), gauge: 95, transformation: { character: 'blue', scope: 'stage' } }); assert.equal(blue.gauge, 95); assert.equal(blue.transformation, null);
});
test('invalid gauge and effect seeds are rejected', () => {
  for (const initialGauge of [-1, 121, NaN, 1.5]) assert.throws(() => createBattle(config('blue', { initialGauge })));
  assert.throws(() => createBattle(config('red', { initialTransformation: { character: 'blue', scope: 'stage' } })));
  assert.throws(() => createBattle(config('red', { initialTransformation: { character: 'red', scope: 'run', remainingStarts: 3 } })));
});

test('two simultaneous six-link axes can activate only once and preserve capped overflow', () => {
  const boxes: Box[] = [];
  for (let col = 0; col < 6; col += 1) {
    if (col !== 3) boxes.push(box(1, col));
    for (let row = 2; row < 7; row += 1) boxes.push(box(row, col, col === 3 ? 'player' : 'neutral'));
  }
  const state = createBattle(config('blue', { initialGauge: 72, board: { width: 6, height: 7, gravity: 'down', terrain: [], invalidCells: [] }, initialBoxes: boxes,
    combatants: { ...defaultConfig.combatants, enemy: { ...defaultConfig.combatants.enemy, initialHp: 100, maxHp: 100 } } }));
  const result = drop(state, 3);
  assert.equal(result.resolution!.links.filter(link => link.count >= 6).length, 2);
  assert.equal(result.resolution!.events.filter(event => event.type === 'transformation').length, 1);
  assert.equal(result.state.gauge, 41);
});
test('last Red ordinary action cannot reactivate before its end-of-turn expiry', () => {
  const state = { ...six('red', 150), playerTurnStarted: true, transformation: { character: 'red', scope: 'run', remainingStarts: 0 } as const };
  const result = drop(state);
  assert.equal(result.state.transformation, null); assert.equal(result.state.gauge, 150);
  assert.equal(result.resolution!.events.some(event => event.type === 'transformation'), false);
  assert.equal(result.resolution!.events.filter(event => event.type === 'transformation-ended').length, 1);
});
test('enemy cross-axis overkill charges only HP actually lost across all hits', () => {
  const fixture = battleFixtures.find(f => f.id === 'cross-attack')!;
  const state = createBattle(config('blue', { ...fixture, firstActor: 'enemy',
    initialBoxes: fixture.initialBoxes.map(item => ({ ...item, owner: item.owner === 'player' ? 'enemy' : item.owner })),
    combatants: { ...fixture.combatants, player: { ...fixture.combatants.player, initialHp: 1 }, enemy: { ...fixture.combatants.enemy, initialHp: 30 } } }));
  const result = applyAction(state, { type: 'enemy' });
  assert.equal(result.resolution!.events.filter(event => event.type === 'attack').length, 2);
  assert.equal(result.state.gauge, 1); assert.equal(result.state.result?.winner, 'enemy');
});
test('zero remaining Red starts never carry, and every carry snapshot is deeply frozen', () => {
  const previous = { ...activeRed(), transformation: { character: 'red', scope: 'run', remainingStarts: 0 } as const };
  const next = carryTransformationState(createBattle(config('red')), previous);
  assert.equal(next.transformation, null); assert.ok(Object.isFrozen(next)); assert.ok(Object.isFrozen(next.hp));
});
