import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, battleFixtures, createBattle, createCharacterBattleConfig, defaultConfig, enemyDefinitions, enemyRoster,
  findPlusShapes, getAvailableBoardSkills, getEnemyIntent, getPlayerSkills, getRowSkillPreview, restartBattle, settleBoxes,
  type AttackEvent, type BattleAction, type BattleConfig, type BattleState, type BoardDefinition, type Box, type Cell,
  type EnemyId, type Owner, type PlayerSkillLoadout } from '../src/core/index.ts';
import { sampleUniformIndex } from '../src/core/random.ts';

const board = (width: number, height: number, terrain: Cell[] = []): BoardDefinition =>
  ({ width, height, gravity: 'down', terrain, invalidCells: [] });
const box = (row: number, col: number, owner: Owner = 'player'): Box =>
  ({ id: `box:${row}:${col}`, row, col, owner, type: 'normal', status: 'normal' });
const config = (patch: Partial<BattleConfig> = {}): BattleConfig => ({ ...defaultConfig, ...patch });
const drop = (state: BattleState, col: number, row = 0) => applyAction(state, { type: 'drop', candidateId: `ceiling:${col}:${row}` });
const skill = (state: BattleState, skillId: 'pain-shared' | 'ember', row?: number) => applyAction(state, { type: 'board-skill', skillId, row });
const hits = (result: ReturnType<typeof applyAction>) => result.resolution!.events.filter((event): event is AttackEvent => event.type === 'attack');
const noSkills: PlayerSkillLoadout = { boardSkills: [], shapeSkills: [], linkSkills: [] };
const allSkills: PlayerSkillLoadout = { boardSkills: ['pain-shared', 'ember'], shapeSkills: ['health'], linkSkills: ['grow-fire'] };
const hpConfig = (player: number, enemy = 100, maxPlayer = 100): BattleConfig['combatants'] => ({
  player: { maxHp: maxPlayer, initialHp: player, attacks: { 3: 4, 4: 7, 5: 11 } },
  enemy: { maxHp: 100, initialHp: enemy, attacks: { 3: 2, 4: 4, 5: 6 } },
});

test('named profiles apply approved HP/attack values and preserve caller-independent player settings', () => {
  const expected = {
    marujiro: [60, 2, 4, 6], hikikizan: [30, 3, 10, 15], nigirin: [30, 2, 4, 6], merarun: [30, 3, 6, 9],
  };
  assert.deepEqual(enemyRoster, ['marujiro', 'hikikizan', 'nigirin', 'merarun']);
  for (const enemyId of enemyRoster) {
    const base = config({ playerSkills: noSkills, seed: 20, initialBoxes: [box(7, 1)], combatants: hpConfig(17) });
    const result = createCharacterBattleConfig('red', enemyId, base);
    const enemy = result.combatants.enemy;
    assert.deepEqual([enemy.maxHp, enemy.attacks[3], enemy.attacks[4], enemy.attacks[5]], expected[enemyId]);
    assert.equal(enemy.initialHp, enemy.maxHp);
    assert.deepEqual(result.combatants.player, base.combatants.player);
    assert.deepEqual(result.playerSkills, noSkills);
    assert.equal(result.seed, 20);
    assert.deepEqual(result.initialBoxes, base.initialBoxes);
    assert.notStrictEqual(result.initialBoxes, base.initialBoxes);
    assert.ok(Object.isFrozen(result.combatants.enemy.attacks));
    assert.equal(createBattle(result).link3Growth, 0);
  }
  assert.equal(enemyDefinitions.nigirin.healEveryOwnTurns, 5);
  assert.equal(enemyDefinitions.nigirin.healAmount, 10);
});

test('skills are opt-in; character defaults and an explicit empty override remain distinct', () => {
  for (const fixture of battleFixtures.filter(fixture => !fixture.characterId)) assert.deepEqual(getPlayerSkills(fixture), noSkills);
  assert.deepEqual(getAvailableBoardSkills(createBattle()), []);
  assert.deepEqual(getAvailableBoardSkills(createBattle(config({ characterId: 'blue' }))), ['pain-shared']);
  assert.deepEqual(getAvailableBoardSkills(createBattle(config({ characterId: 'red' }))), ['ember']);
  assert.deepEqual(getAvailableBoardSkills(createBattle(config({ characterId: 'red', playerSkills: noSkills }))), []);
  assert.deepEqual(getAvailableBoardSkills(createBattle(config({ playerSkills: allSkills }))), ['pain-shared', 'ember']);
});

test('skill availability is independent of drops and target counts, but respects actor and terminal state', () => {
  const empty = createBattle(config({ characterId: 'blue', board: board(1, 1) }));
  const full = createBattle(config({ characterId: 'blue', board: board(1, 1), initialBoxes: [box(0, 0)] }));
  assert.deepEqual(getAvailableBoardSkills(empty), ['pain-shared']);
  assert.deepEqual(getAvailableBoardSkills(full), ['pain-shared']);
  assert.deepEqual(getAvailableBoardSkills({ ...empty, actor: 'enemy' }), []);
  assert.deepEqual(getAvailableBoardSkills({ ...empty, result: { winner: 'player', reason: 'hp-zero' } }), []);
  assert.equal(applyAction(full, { type: 'skip' }).reason, 'board-skill-available');
  assert.equal(applyAction(empty, { type: 'skip' }).reason, 'legal-drop-exists');
});

test('invalid skill inputs reject atomically without turn, HP, random, or board changes', () => {
  const start = createBattle(config({ characterId: 'blue', initialBoxes: [box(7, 0)] }));
  for (const row of [undefined, -1, 8, 0.5, NaN, Infinity]) {
    const result = skill(start, 'pain-shared', row);
    assert.equal(result.reason, 'invalid-row');
    assert.strictEqual(result.state, start);
    assert.equal(result.resolution, null);
  }
  assert.equal(skill(start, 'ember').reason, 'skill-unavailable');
  assert.equal(skill(createBattle(), 'pain-shared', 0).reason, 'skill-unavailable');
  assert.equal(applyAction(start, { type: 'board-skill', skillId: 'unknown' } as unknown as BattleAction).reason, 'unknown-skill');
  assert.equal(skill({ ...start, actor: 'enemy' }, 'pain-shared', 7).reason, 'wrong-actor');
  assert.equal(skill({ ...start, result: { winner: 'enemy', reason: 'hp-zero' } }, 'pain-shared', 7).reason, 'battle-ended');
});

test('Pain Shared previews pre-delete counts, deletes the complete row, applies both damage amounts, and settles once', () => {
  const initialBoxes = [box(0, 0), box(0, 1, 'enemy'), box(1, 0), box(1, 1), box(1, 2, 'enemy'), box(1, 3, 'neutral'),
    ...Array.from({ length: 4 }, (_, col) => box(2, col, 'neutral'))];
  const state = createBattle(config({ characterId: 'blue', board: board(4, 3), initialBoxes }));
  const before = structuredClone(state);
  const preview = getRowSkillPreview(state, 1);
  assert.deepEqual(preview, { valid: true, row: 1, boxIds: ['box:1:0', 'box:1:1', 'box:1:2', 'box:1:3'],
    playerCount: 2, enemyCount: 1, neutralCount: 1, playerDamage: 2, enemyDamage: 4 });
  const result = skill(state, 'pain-shared', 1);
  assert.equal(result.accepted, true);
  assert.equal(result.state.hp.player.current, 28);
  assert.equal(result.state.hp.enemy.current, 26);
  assert.equal(result.state.boxes.length, initialBoxes.length - 4);
  assert.equal(result.state.boxes.find(item => item.id === 'box:0:0')!.row, 1);
  assert.deepEqual(result.state.boxes, settleBoxes(state.config.board, initialBoxes.filter(item => item.row !== 1)));
  assert.deepEqual(result.resolution!.events.filter(event => event.type !== 'gauge').map(event => event.type), ['board-skill', 'row-cleared', 'damage', 'damage']);
  assert.equal(result.resolution!.originBoxId, null);
  assert.deepEqual(result.resolution!.links, []);
  assert.equal(result.state.actor, 'enemy');
  assert.equal(result.state.turn, 2);
  assert.equal(result.state.rngState, state.rngState);
  assert.equal(result.state.nextBoxId, state.nextBoxId);
  assert.deepEqual(state, before);
  assert.ok(Object.isFrozen(preview.boxIds));
  assert.ok(Object.isFrozen(result.state.boxes));
});

test('neutral-only and empty rows are valid, cause no damage, and still spend the turn', () => {
  const start = createBattle(config({ characterId: 'blue', board: board(2, 2), initialBoxes: [box(1, 0, 'neutral')] }));
  assert.deepEqual(getRowSkillPreview(start, 0), { valid: true, row: 0, boxIds: [], playerCount: 0, enemyCount: 0,
    neutralCount: 0, playerDamage: 0, enemyDamage: 0 });
  assert.equal(getRowSkillPreview(start, 2).valid, false);
  const empty = skill(start, 'pain-shared', 0);
  assert.equal(empty.accepted, true); assert.equal(empty.state.turn, 2);
  assert.deepEqual(empty.state.hp, start.hp);
  assert.deepEqual(empty.state.boxes, start.boxes);
  const neutral = skill(start, 'pain-shared', 1);
  assert.equal(neutral.state.boxes.length, 0);
  assert.deepEqual(neutral.state.hp, start.hp);
  assert.equal(skill(neutral.state, 'pain-shared', 0).reason, 'wrong-actor');
  const enemy = applyAction(neutral.state, { type: 'enemy' });
  const again = skill(enemy.state, 'pain-shared', 1);
  assert.equal(again.accepted, true);
  assert.equal(again.state.actor, 'enemy');
});

test('Pain Shared resolves both lethal hits simultaneously, with PvE loss on a double KO', () => {
  const start = createBattle(config({ characterId: 'blue', board: board(2, 2), initialBoxes: [box(0, 0, 'neutral'), box(1, 0), box(1, 1, 'enemy')],
    combatants: hpConfig(2, 2) }));
  const result = skill(start, 'pain-shared', 1);
  assert.equal(result.state.hp.player.current, 0); assert.equal(result.state.hp.enemy.current, 0);
  assert.deepEqual(result.state.result, { winner: 'enemy', reason: 'hp-zero' });
  assert.equal(result.state.boxes[0]!.row, 1, 'passive cleanup still happens after simultaneous KO');
  assert.equal(result.state.turn, 1);
  assert.equal(result.resolution!.events.filter(event => event.type === 'damage').length, 2);
  assert.equal(result.resolution!.events.filter(event => event.type === 'battle-end').length, 1);
  const victory = skill(createBattle({ ...start.config, combatants: hpConfig(3, 2) }), 'pain-shared', 1);
  assert.equal(victory.state.result!.winner, 'player');
});

test('row-clear passive settling creates links without any attack, shape heal, or growth', () => {
  const start = createBattle(config({ playerSkills: allSkills, board: board(3, 4), combatants: hpConfig(10),
    initialBoxes: [box(0, 0), box(1, 1), box(2, 2), ...[0, 1, 2].map(col => box(3, col, 'neutral'))] }));
  const result = skill(start, 'pain-shared', 3);
  assert.deepEqual(result.state.boxes.map(item => item.row), [3, 3, 3]);
  assert.equal(hits(result).length, 0);
  assert.equal(result.state.hp.player.current, 10);
  assert.equal(result.state.hp.enemy.current, 100);
  assert.equal(result.state.link3Growth, 0);
  assert.ok(result.resolution!.events.every(event => event.type !== 'heal' && event.type !== 'link-growth'));
});

for (const initialHp of [1, 2, 3]) {
  test(`Ember pays 3 first and stops all conversion/random draws on self-KO from HP ${initialHp}`, () => {
    const start = createBattle(config({ characterId: 'red', board: board(3, 1),
      initialBoxes: [box(0, 0, 'enemy'), box(0, 1, 'enemy')], combatants: hpConfig(initialHp) }));
    const result = skill(start, 'ember');
    assert.equal(result.state.hp.player.current, initialHp - 3);
    assert.deepEqual(result.state.result, { winner: 'enemy', reason: 'hp-zero' });
    assert.deepEqual(result.state.boxes, start.boxes);
    assert.equal(result.state.rngState, start.rngState);
    assert.equal(result.state.hp.enemy.current, start.hp.enemy.current);
    assert.deepEqual(result.resolution!.events.filter(event => event.type !== 'gauge').map(event => event.type), ['board-skill', 'damage', 'battle-end']);
  });
}

test('Ember with zero enemies is a valid 3-HP action with no random draw or hidden drop', () => {
  const start = createBattle(config({ characterId: 'red', initialBoxes: [box(7, 0), box(7, 1, 'neutral')] }));
  const result = skill(start, 'ember');
  assert.equal(result.accepted, true); assert.equal(result.state.hp.player.current, 27);
  assert.deepEqual(result.state.boxes, start.boxes); assert.equal(result.state.rngState, start.rngState);
  assert.equal(result.state.actor, 'enemy'); assert.equal(result.state.turn, 2);
  assert.deepEqual(result.resolution!.events.find(event => event.type === 'boxes-converted')?.boxIds, []);
  assert.equal(result.resolution!.originBoxId, null); assert.deepEqual(result.resolution!.links, []);
  assert.equal(result.state.nextBoxId, start.nextBoxId);
});

for (const count of [1, 2, 4]) {
  test(`Ember converts up to two of ${count} enemy boxes without replacement and preserves other ownership`, () => {
    const start = createBattle(config({ characterId: 'red', seed: 100, board: board(count + 2, 1),
      initialBoxes: [...Array.from({ length: count }, (_, col) => box(0, col, 'enemy')), box(0, count, 'neutral'), box(0, count + 1)] }));
    const result = skill(start, 'ember');
    const converted = result.resolution!.events.find(event => event.type === 'boxes-converted')!;
    assert.equal(converted.boxIds.length, Math.min(2, count));
    assert.equal(new Set(converted.boxIds).size, converted.boxIds.length);
    const pool = start.boxes.filter(item => item.owner === 'enemy');
    const expected: string[] = []; let rngState = start.rngState;
    for (let n = 0; n < Math.min(2, count); n += 1) {
      const draw = sampleUniformIndex(rngState, pool.length); rngState = draw.rngState;
      expected.push(pool.splice(draw.index, 1)[0]!.id);
    }
    assert.deepEqual(converted.boxIds, expected); assert.equal(result.state.rngState, rngState);
    assert.equal(result.state.boxes.find(item => item.id === `box:0:${count}`)!.owner, 'neutral');
    assert.equal(result.state.boxes.find(item => item.id === `box:0:${count + 1}`)!.owner, 'player');
    assert.equal(result.state.hp.player.current, 27);
    assert.deepEqual(skill(start, 'ember'), result);
  });
}

test('uniform Ember selection reaches every distinct enemy pair and cannot convert a box twice', () => {
  const seen = new Set<string>();
  for (let n = 0; n < 512; n += 1) {
    const start = createBattle(config({ characterId: 'red', board: board(4, 1), seed: Math.imul(n, 0x9e3779b1) >>> 0,
      initialBoxes: Array.from({ length: 4 }, (_, col) => box(0, col, 'enemy')) }));
    const event = skill(start, 'ember').resolution!.events.find(item => item.type === 'boxes-converted')!;
    assert.equal(new Set(event.boxIds).size, 2);
    seen.add([...event.boxIds].sort().join(','));
  }
  assert.equal(seen.size, 6);
});

const plusCells: Cell[] = [{ row: 1, col: 1 }, { row: 0, col: 1 }, { row: 2, col: 1 }, { row: 1, col: 0 }, { row: 1, col: 2 }];
for (const origin of plusCells) {
  test(`five-cell Health detection accepts new origin at plus part ${origin.row},${origin.col}`, () => {
    const boxes = plusCells.map(cell => box(cell.row, cell.col));
    const shapes = findPlusShapes(board(3, 3), boxes, `box:${origin.row}:${origin.col}`);
    assert.equal(shapes.length, 1);
    assert.deepEqual(shapes[0]!.center, { row: 1, col: 1 });
    assert.equal(shapes[0]!.boxIds.length, 5);
    assert.ok(Object.isFrozen(shapes[0]!.boxIds));
  });
}

test('Health requires all five own boxes including the active origin, never a remote or broken plus', () => {
  const own = plusCells.map(cell => box(cell.row, cell.col));
  assert.deepEqual(findPlusShapes(board(3, 3), own, 'missing'), []);
  for (let n = 0; n < own.length; n += 1) {
    for (const owner of ['enemy', 'neutral'] as const) {
      const mixed = own.map((item, index) => index === n ? { ...item, owner } : item);
      assert.deepEqual(findPlusShapes(board(3, 3), mixed, 'box:1:1'), []);
    }
    assert.deepEqual(findPlusShapes(board(3, 3), own.filter((_, index) => index !== n), 'box:1:1'), []);
  }
  assert.deepEqual(findPlusShapes(board(3, 3, [{ row: 0, col: 1 }]), own, 'box:1:1'), []);
  assert.deepEqual(findPlusShapes(board(4, 3), [...own, box(2, 3)], 'box:2:3'), []);
});

test('Health resolves before all four link axes and never suppresses ordinary attacks', () => {
  const initialBoxes = [0, 1, 2, 3].flatMap(row => [box(row, 1), box(row, 3)]);
  initialBoxes.push(box(2, 2), box(3, 2));
  const state = createBattle(config({ characterId: 'blue', board: board(5, 4), initialBoxes, combatants: hpConfig(1) }));
  const result = drop(state, 2);
  assert.equal(result.state.hp.player.current, 16);
  assert.deepEqual(result.resolution!.events.filter(event => event.type !== 'gauge').map(event => event.type), ['drop', 'heal', 'attack', 'attack', 'attack', 'attack']);
  assert.deepEqual(hits(result).map(event => event.axis), ['vertical', 'horizontal', 'diagonal-down', 'diagonal-up']);
  assert.deepEqual(hits(result).map(event => event.damage), [4, 4, 4, 4]);
  assert.equal(result.state.boxes.length, initialBoxes.length + 1);
});

for (const side of [0, 2]) {
  test(`Health accepts a dropped ${side === 0 ? 'left' : 'right'} arm and caps healing at maximum HP`, () => {
    const initialBoxes = plusCells.filter(cell => !(cell.row === 1 && cell.col === side)).map(cell => box(cell.row, cell.col));
    initialBoxes.push(box(2, 0, 'neutral'), box(2, 2, 'neutral'));
    const state = createBattle(config({ characterId: 'blue', board: board(3, 3), initialBoxes, combatants: hpConfig(25, 100, 30) }));
    const result = drop(state, side);
    const event = result.resolution!.events.find(item => item.type === 'heal')!;
    assert.equal(event.requestedAmount, 15); assert.equal(event.amount, 5);
    assert.equal(result.state.hp.player.current, 30);
    assert.equal(hits(result)[0]!.axis, 'horizontal');
    assert.equal(hits(result)[0]!.damage, 4);
  });
}

test('multiple plus shapes from one origin heal only once and leave all link attacks intact', () => {
  const initialBoxes = [box(0, 1), box(0, 3), ...[0, 1, 3, 4].map(col => box(1, col)),
    ...[0, 1, 2, 3, 4].map(col => box(2, col, col === 1 || col === 3 ? 'player' : 'neutral'))];
  const state = createBattle(config({ characterId: 'blue', board: board(5, 3), initialBoxes, combatants: hpConfig(1) }));
  const result = drop(state, 2);
  assert.equal(findPlusShapes(state.config.board, result.state.boxes, result.resolution!.originBoxId!).length, 2);
  assert.equal(result.state.hp.player.current, 16);
  assert.equal(result.resolution!.events.filter(event => event.type === 'heal').length, 1);
  assert.deepEqual(hits(result).map(event => event.axis), ['horizontal', 'diagonal-down', 'diagonal-up']);
  assert.deepEqual(hits(result).map(event => event.damage), [11, 4, 4]);
});

test('ownership conversion completing a plus and links does not trigger passive heal, attack, or growth', () => {
  const initialBoxes = plusCells.map(cell => box(cell.row, cell.col, cell.row === 1 && cell.col !== 1 ? 'enemy' : 'player'));
  initialBoxes.push(box(2, 0, 'neutral'), box(2, 2, 'neutral'));
  const state = createBattle(config({ playerSkills: allSkills, board: board(3, 3), initialBoxes, combatants: hpConfig(20) }));
  const result = skill(state, 'ember');
  assert.equal(findPlusShapes(state.config.board, result.state.boxes, 'box:1:1').length, 1);
  assert.equal(result.state.hp.player.current, 17);
  assert.equal(result.state.hp.enemy.current, 100);
  assert.equal(result.state.link3Growth, 0);
  assert.deepEqual(result.resolution!.events.filter(event => event.type !== 'gauge').map(event => event.type), ['board-skill', 'damage', 'boxes-converted']);
});

for (const count of [3, 4, 5, 6]) {
  test(`Grow Fire replaces vertical ${count}-link with current 3-link power+3, then grows exactly once`, () => {
    const state = createBattle(config({ characterId: 'red', board: board(1, count),
      initialBoxes: Array.from({ length: count - 1 }, (_, index) => box(index + 1, 0)), combatants: hpConfig(30) }));
    const result = drop({ ...state, link3Growth: 2 }, 0);
    assert.equal(hits(result).length, 1);
    assert.equal(hits(result)[0]!.skillId, 'grow-fire');
    assert.equal(hits(result)[0]!.damage, 9);
    assert.equal(hits(result)[0]!.tier, Math.min(count, 5));
    assert.equal(result.state.link3Growth, 3);
    assert.deepEqual(result.resolution!.events.filter(event => event.type !== 'gauge').map(event => event.type), ['drop', 'attack', 'link-growth']);
    assert.deepEqual(restartBattle(result.state), state);
  });
}

test('Grow Fire ignores nonvertical links and short vertical links', () => {
  const horizontal = drop(createBattle(config({ characterId: 'red', board: board(3, 1), initialBoxes: [box(0, 0), box(0, 1)] })), 2);
  assert.equal(hits(horizontal)[0]!.damage, 4); assert.equal(hits(horizontal)[0]!.skillId, undefined);
  assert.equal(horizontal.state.link3Growth, 0);
  const short = drop(createBattle(config({ characterId: 'red', board: board(1, 2), initialBoxes: [box(1, 0)] })), 0);
  assert.equal(hits(short).length, 0); assert.equal(short.state.link3Growth, 0);
});

test('Grow Fire growth affects subsequent 3-link axes immediately, without suppressing them after enemy KO', () => {
  const initialBoxes = [0, 1, 2, 3].flatMap(row => [box(row, 1), box(row, 3)]);
  initialBoxes.push(box(2, 2), box(3, 2));
  const state = createBattle(config({ playerSkills: allSkills, board: board(5, 4), initialBoxes, combatants: hpConfig(1, 1) }));
  const result = drop(state, 2);
  assert.equal(result.state.hp.player.current, 16);
  assert.deepEqual(hits(result).map(event => event.damage), [7, 5, 5, 5]);
  assert.deepEqual(hits(result).map(event => event.skillId), ['grow-fire', undefined, undefined, undefined]);
  assert.equal(result.state.link3Growth, 1);
  assert.deepEqual(result.resolution!.events.filter(event => event.type !== 'gauge').map(event => event.type), ['drop', 'heal', 'attack', 'link-growth', 'attack', 'attack', 'attack', 'battle-end']);
});

test('growth persists through turns and later Grow Fire attacks but never buffs enemy or ordinary 4-links', () => {
  const state = createBattle(config({ characterId: 'red', board: board(1, 8), initialBoxes: [box(5, 0), box(6, 0), box(7, 0)], combatants: hpConfig(30) }));
  const first = drop(state, 0); const second = drop({ ...first.state, actor: 'player' }, 0);
  assert.equal(hits(first)[0]!.damage, 7); assert.equal(hits(second)[0]!.damage, 8);
  assert.equal(second.state.link3Growth, 2);
  const four = createBattle(config({ characterId: 'red', board: board(4, 1), initialBoxes: [box(0, 0), box(0, 1), box(0, 2)] }));
  assert.equal(hits(drop({ ...four, link3Growth: 8 }, 3))[0]!.damage, 7);
  const enemy = createBattle(config({ characterId: 'red', firstActor: 'enemy', board: board(3, 1), initialBoxes: [box(0, 0, 'enemy'), box(0, 1, 'enemy')] }));
  const enemyResult = applyAction({ ...enemy, link3Growth: 8 }, { type: 'enemy' });
  assert.equal(hits(enemyResult)[0]!.damage, 3);
  assert.equal(hits(enemyResult)[0]!.skillId, undefined);
  assert.equal(enemyResult.state.link3Growth, 8);
});

for (const enemyId of ['marujiro', 'hikikizan', 'nigirin'] as EnemyId[]) {
  for (const count of [3, 4, 5, 6]) {
    test(`${enemyId} normal ${count}-link uses its approved capped damage table`, () => {
      const definition = createCharacterBattleConfig('blue', enemyId, config({ firstActor: 'enemy', board: board(count, 1),
        initialBoxes: Array.from({ length: count - 1 }, (_, col) => box(0, col, 'enemy')), combatants: hpConfig(100) }));
      const result = applyAction(createBattle(definition), { type: 'enemy' });
      assert.equal(hits(result)[0]!.damage, enemyDefinitions[enemyId].attacks[Math.min(count, 5) as 3 | 4 | 5]);
      assert.equal(result.state.enemyTurnCount, 1);
    });
  }
}

test('Nigirin heals on own turns 5 and 10, never every fifth global turn or alongside a drop', () => {
  const definition = createCharacterBattleConfig('blue', 'nigirin', config({ board: board(1, 30), combatants: hpConfig(100) }));
  let state = createBattle({ ...definition, combatants: { ...definition.combatants,
    enemy: { ...definition.combatants.enemy, initialHp: 17 } } });
  const planned: string[] = []; const healed: number[] = [];
  let expectedRng = state.rngState;
  for (let ownTurn = 1; ownTurn <= 10; ownTurn += 1) {
    state = skill(state, 'pain-shared', 0).state;
    assert.equal(state.turn, ownTurn * 2);
    assert.equal(getEnemyIntent(state).type, ownTurn % 5 === 0 ? 'heal' : 'drop');
    const result = applyAction(state, { type: 'enemy' });
    planned.push(result.resolution!.enemyPlannedAction!);
    assert.equal(result.state.enemyTurnCount, ownTurn);
    if (ownTurn % 5 === 0) {
      assert.deepEqual(result.resolution!.events.filter(event => event.type !== 'gauge').map(event => event.type), ['heal']);
      healed.push(result.resolution!.events.find(event => event.type === 'heal')!.amount);
      assert.equal(result.state.rngState, state.rngState);
    } else expectedRng = sampleUniformIndex(expectedRng, 1).rngState;
    state = result.state;
  }
  assert.deepEqual(planned, ['drop', 'drop', 'drop', 'drop', 'heal', 'drop', 'drop', 'drop', 'drop', 'heal']);
  assert.deepEqual(healed, [10, 3]);
  assert.equal(state.boxes.length, 8); assert.equal(state.nextBoxId, 9);
  assert.equal(state.hp.enemy.current, 30); assert.equal(state.rngState, expectedRng);
  assert.equal(restartBattle(state).enemyTurnCount, 0);
});

for (const initialHp of [17, 30]) {
  test(`scheduled Nigirin heal at HP ${initialHp} takes priority over a full-board instant kill`, () => {
    const definition = createCharacterBattleConfig('blue', 'nigirin', config({ board: board(1, 1), firstActor: 'enemy', initialBoxes: [box(0, 0, 'neutral')] }));
    const start = createBattle({ ...definition, combatants: { ...definition.combatants, enemy: { ...definition.combatants.enemy, initialHp } } });
    const result = applyAction({ ...start, turn: 99, enemyTurnCount: 4 }, { type: 'enemy' });
    assert.deepEqual(result.resolution!.events.filter(event => event.type !== 'gauge').map(event => event.type), ['heal']);
    assert.equal(result.state.hp.enemy.current, Math.min(30, initialHp + 10));
    assert.equal(result.state.hp.player.current, 30); assert.equal(result.state.result, null);
    assert.equal(result.state.rngState, start.rngState); assert.deepEqual(result.state.boxes, start.boxes);
    assert.equal(result.state.actor, 'player'); assert.equal(result.state.enemyTurnCount, 5);
    const next = applyAction({ ...result.state, actor: 'enemy' }, { type: 'enemy' });
    assert.equal(next.resolution!.enemyPlannedAction, 'drop');
    assert.equal(next.state.result!.reason, 'enemy-blocked');
    assert.equal(next.state.enemyTurnCount, 6);
  });
}

test('explicit healing patterns also avoid full-board substitution and cap HP', () => {
  const start = createBattle(config({ firstActor: 'enemy', board: board(1, 1), initialBoxes: [box(0, 0, 'neutral')],
    enemyPattern: [{ type: 'heal', amount: 10 }, { type: 'drop' }] }));
  assert.deepEqual(getEnemyIntent(start), { type: 'heal', amount: 10 });
  const result = applyAction(start, { type: 'enemy' });
  assert.equal(result.state.hp.enemy.current, 30);
  assert.equal(result.resolution!.events[0]!.type, 'heal');
  assert.equal(result.state.enemyPatternIndex, 1);
  assert.equal(result.state.result, null);
});

test('invalid loadouts, IDs, and heal patterns reject before creating a battle', () => {
  for (const patch of [
    { characterId: 'green' }, { enemyId: 'unknown' },
    { playerSkills: { ...noSkills, boardSkills: ['pain-shared', 'pain-shared'] } },
    { playerSkills: { ...noSkills, boardSkills: ['other'] } },
    { playerSkills: { ...noSkills, shapeSkills: ['other'] } },
    { playerSkills: { ...noSkills, linkSkills: ['other'] } },
    { enemyPattern: [{ type: 'heal', amount: -1 }] }, { enemyPattern: [{ type: 'heal', amount: NaN }] },
  ]) assert.throws(() => createBattle(config(patch as unknown as Partial<BattleConfig>)), /Battle config:/);
});

test('ready-to-trigger skill fixtures are gravity-stable and work when the UI applies their character profile', () => {
  const health = battleFixtures.find(fixture => fixture.id === 'health-plus')!;
  assert.deepEqual(settleBoxes(health.board, health.initialBoxes), health.initialBoxes);
  const blue = drop(createBattle(createCharacterBattleConfig('blue', 'marujiro', health)), 0);
  assert.equal(blue.state.hp.player.current, 25);
  assert.equal(blue.resolution!.events.find(event => event.type === 'heal')!.amount, 15);
  assert.deepEqual(hits(blue).map(event => event.axis), ['horizontal']);
  const growth = battleFixtures.find(fixture => fixture.id === 'grow-fire')!;
  assert.deepEqual(settleBoxes(growth.board, growth.initialBoxes), growth.initialBoxes);
  const red = drop(createBattle(createCharacterBattleConfig('red', 'marujiro', growth)), 1);
  assert.equal(red.state.link3Growth, 1);
  assert.deepEqual(hits(red).map(event => event.damage), [7, 5]);
});
