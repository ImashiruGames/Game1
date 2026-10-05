import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, battleFixtures, calculateLinks, createBattle, defaultConfig, generateDropCandidates,
  getDropOptions, restartBattle, settleBoxes, type Actor, type AttackEvent, type BattleAction, type BattleConfig,
  type BattleState, type BoardDefinition, type Box, type Cell, type Owner } from '../src/core/index.ts';
import { nextRandomUint32, sampleUniformIndex } from '../src/core/random.ts';

const board = (width: number, height: number, terrain: Cell[] = [], invalidCells: Cell[] = []): BoardDefinition =>
  ({ width, height, terrain, invalidCells, gravity: 'down' });
const box = (row: number, col: number, owner: Owner = 'player', id = `box:${row}:${col}`): Box =>
  ({ id, row, col, owner, type: 'normal', status: 'normal' });
const config = (patch: Partial<BattleConfig> = {}): BattleConfig => ({ ...defaultConfig, ...patch });
const fixture = (id: string): BattleConfig => battleFixtures.find((item) => item.id === id)!;
const attacks = (result: ReturnType<typeof applyAction>): AttackEvent[] =>
  result.resolution!.events.filter((event): event is AttackEvent => event.type === 'attack');
const drop = (state: BattleState, col: number, row = 0) => applyAction(state, { type: 'drop', candidateId: `ceiling:${col}:${row}` });

// 日本語: 契約をCoreだけで検証し、演出速度から切り離す。
// English: Test the contract directly in the core, independently of animation timing.
test('all fixtures are valid, deterministic, and gravity-stable', () => {
  assert.equal(new Set(battleFixtures.map((item) => item.id)).size, battleFixtures.length);
  for (const definition of battleFixtures) {
    const first = createBattle(definition);
    assert.deepEqual(first, createBattle(definition));
    assert.deepEqual(first.boxes, settleBoxes(definition.board, definition.initialBoxes));
    assert.equal(first.actor, definition.firstActor);
    assert.equal(first.turn, 1);
    assert.equal(first.result, null);
  }
});
test('empty 6×8 board has six top-edge candidates and downward-only paths', () => {
  const options = getDropOptions(createBattle());
  assert.equal(options.length, 6);
  assert.equal(new Set(options.map((option) => option.id)).size, 6);
  options.forEach((option, col) => {
    assert.deepEqual(option.edge, { row: 0, col, side: 'top' });
    assert.deepEqual(option.spawn, { row: 0, col });
    assert.deepEqual(option.landing, { row: 7, col });
    assert.deepEqual(option.path, Array.from({ length: 8 }, (_, row) => ({ row, col })));
    assert.equal(option.available, true);
  });
});
test('stacked floating terrain creates distinct top and internal ceiling segments', () => {
  const candidates = generateDropCandidates(board(3, 8, [{ row: 2, col: 1 }, { row: 5, col: 1 }]));
  assert.equal(candidates.length, 5);
  assert.deepEqual(candidates.filter((candidate) => candidate.spawn.col === 1).map((candidate) =>
    [candidate.spawn.row, candidate.segmentEndRow]), [[0, 1], [3, 4], [6, 7]]);
  assert.deepEqual(candidates.find((candidate) => candidate.id === 'ceiling:1:3')!.edge, { row: 3, col: 1, side: 'top' });
});
test('invalid cells split segments, including one-cell internal segments', () => {
  const candidates = generateDropCandidates(board(1, 6, [], [{ row: 0, col: 0 }, { row: 2, col: 0 }, { row: 4, col: 0 }]));
  assert.deepEqual(candidates.map((candidate) => [candidate.spawn.row, candidate.segmentEndRow]), [[1, 1], [3, 3], [5, 5]]);
});
test('a column entirely made of terrain has no candidate', () => {
  assert.deepEqual(generateDropCandidates(board(1, 2, [{ row: 0, col: 0 }, { row: 1, col: 0 }])), []);
});
test('boxes never create ceilings; blocked spawn is retained and never tunnels into a gap', () => {
  // 日本語: 合成した穴で通り抜けを検証。English: A synthetic gap specifically tests no tunneling.
  const state = createBattle(config({ board: board(1, 4), initialBoxes: [box(0, 0)] }));
  const options = getDropOptions(state);
  assert.equal(options.length, 1);
  assert.equal(options[0]!.available, false);
  assert.equal(options[0]!.landing, null);
  assert.deepEqual(options[0]!.path, []);
  const result = drop(state, 0);
  assert.equal(result.accepted, false);
  assert.equal(result.reason, 'blocked-spawn');
  assert.strictEqual(result.state, state);
});
test('empty spawn directly above a box is a valid landing', () => {
  const state = createBattle(config({ board: board(1, 3), initialBoxes: [box(1, 0), box(2, 0)] }));
  assert.deepEqual(getDropOptions(state)[0]!.landing, { row: 0, col: 0 });
  const result = drop(state, 0);
  assert.equal(result.accepted, true);
  assert.deepEqual(result.state.boxes.at(-1), box(0, 0, 'player', 'drop:1'));
});
test('falling stops at first box even when another gap exists below', () => {
  const state = createBattle(config({ board: board(1, 5), initialBoxes: [box(2, 0, 'enemy')] }));
  assert.deepEqual(getDropOptions(state)[0]!.path, [{ row: 0, col: 0 }, { row: 1, col: 0 }]);
});
test('an internal drop remains within its terrain-bounded segment', () => {
  const result = drop(createBattle(config({ board: board(1, 8, [{ row: 2, col: 0 }, { row: 5, col: 0 }]) })), 0, 3);
  const event = result.resolution!.events[0]!;
  assert.equal(event.type, 'drop');
  if (event.type !== 'drop') throw new Error('Expected drop');
  assert.deepEqual(event.path, [{ row: 3, col: 0 }, { row: 4, col: 0 }]);
  assert.deepEqual(event.landing, { row: 4, col: 0 });
  assert.equal(result.state.boxes.length, 1);
});
test('one command adds one box and one drop event, then rejects repeated player input', () => {
  const start = createBattle();
  const result = drop(start, 2);
  assert.equal(result.state.boxes.length, 1);
  assert.equal(result.resolution!.events.filter((event) => event.type === 'drop').length, 1);
  assert.equal(result.state.actor, 'enemy');
  assert.equal(result.state.turn, 2);
  assert.equal(result.state.rngState, start.rngState);
  assert.equal(start.boxes.length, 0);
  assert.strictEqual(drop(result.state, 2).state, result.state);
  assert.equal(drop(result.state, 2).accepted, false);
});
for (const count of [1, 2, 3, 4, 5, 6, 8]) {
  test(`${count}-link makes only its maximum tier attack, capped at 5`, () => {
    const initialBoxes = Array.from({ length: count - 1 }, (_, col) => box(0, col));
    const result = drop(createBattle(config({ board: board(count, 1), initialBoxes })), count - 1);
    const hits = attacks(result);
    if (count < 3) assert.equal(hits.length, 0);
    else {
      assert.equal(hits.length, 1);
      assert.equal(hits[0]!.linkCount, count);
      assert.equal(hits[0]!.tier, Math.min(count, 5));
      assert.equal(hits[0]!.damage, defaultConfig.combatants.player.attacks[Math.min(count, 5) as 3 | 4 | 5]);
    }
    assert.equal(result.state.boxes.length, count);
  });
}
test('origin counts both directions once on each of all four ordered axes', () => {
  const positions = new Map<string, Box>();
  const add = (row: number, col: number) => positions.set(`${row},${col}`, box(row, col));
  for (let n = 0; n < 5; n += 1) { add(n, 2); add(2, n); add(n, n); add(4 - n, n); }
  const links = calculateLinks(board(5, 5), [...positions.values()], 'box:2:2');
  assert.deepEqual(links.map((link) => link.axis), ['vertical', 'horizontal', 'diagonal-down', 'diagonal-up']);
  for (const link of links) {
    assert.equal(link.count, 5); assert.equal(link.tier, 5);
    assert.equal(link.boxIds.filter((id) => id === 'box:2:2').length, 1);
    assert.equal(new Set(link.boxIds).size, 5);
  }
});
test('different owner, neutral owner, and empty cell break continuity', () => {
  const boxes = [box(0, 0), box(0, 1), box(0, 2, 'enemy'), box(0, 3), box(0, 4), box(0, 5, 'neutral'), box(0, 7)];
  assert.deepEqual(calculateLinks(board(8, 1), boxes, 'box:0:3')[1]!.boxIds, ['box:0:3', 'box:0:4']);
  assert.equal(calculateLinks(board(8, 1), boxes, 'box:0:7')[1]!.count, 1);
});
test('terrain and invalid cells break links; nonexistent origin produces no links', () => {
  const boxes = Array.from({ length: 5 }, (_, col) => box(0, col));
  assert.equal(calculateLinks(board(5, 1, [{ row: 0, col: 2 }]), boxes, 'box:0:0')[1]!.count, 2);
  assert.equal(calculateLinks(board(5, 1, [], [{ row: 0, col: 2 }]), boxes, 'box:0:0')[1]!.count, 2);
  assert.deepEqual(calculateLinks(board(5, 1), boxes, 'missing-origin'), []);
});
test('pre-existing remote line cannot attack from an unrelated origin', () => {
  const result = drop(createBattle(config({ board: board(6, 1), initialBoxes: [box(0, 0), box(0, 1), box(0, 2)] })), 5);
  assert.equal(attacks(result).length, 0);
  assert.ok(result.resolution!.links.every((link) => link.count === 1));
});
test('vertical then horizontal attacks continue at defender HP0 and retain every box', () => {
  const start = createBattle(fixture('cross-attack'));
  const result = drop(start, 1);
  assert.deepEqual(attacks(result).map((hit) => hit.axis), ['vertical', 'horizontal']);
  assert.deepEqual(attacks(result).map((hit) => [hit.damage, hit.hpBefore, hit.hpAfter, hit.overkill]), [[4, 4, 0, 0], [4, 0, -4, 4]]);
  assert.deepEqual(result.resolution!.events.map((event) => event.type), ['drop', 'attack', 'attack', 'battle-end']);
  assert.equal(result.state.boxes.length, start.boxes.length + 1);
  for (const oldBox of start.boxes) assert.deepEqual(result.state.boxes.find((item) => item.id === oldBox.id), oldBox);
  assert.deepEqual(result.state.result, { winner: 'player', reason: 'hp-zero' });
  assert.equal(result.state.actor, 'player'); assert.equal(result.state.turn, start.turn);
});
test('both diagonal attacks follow horizontal in their specified order', () => {
  const initialBoxes = [box(0, 0), box(0, 2), box(1, 0), box(1, 2), box(2, 0), box(2, 1), box(2, 2)];
  const result = drop(createBattle(config({ board: board(3, 3, [{ row: 0, col: 1 }]), initialBoxes })), 1, 1);
  assert.deepEqual(attacks(result).map((hit) => hit.axis), ['horizontal', 'diagonal-down', 'diagonal-up']);
});
test('retained boxes are reused by later origins', () => {
  const first = drop(createBattle(config({ board: board(4, 1), initialBoxes: [box(0, 0), box(0, 1)] })), 2);
  assert.equal(attacks(first)[0]!.tier, 3);
  const second = drop({ ...first.state, actor: 'player' }, 3);
  assert.equal(attacks(second)[0]!.tier, 4);
  assert.equal(second.state.boxes.length, 4);
  assert.equal(second.state.hp.enemy.current, 19);
});
test('enemy uses only legal candidates and its own attack table', () => {
  const start = createBattle(fixture('enemy-attack'));
  const result = applyAction(start, { type: 'enemy' });
  assert.equal(result.accepted, true);
  assert.equal(attacks(result).length, 1); assert.equal(attacks(result)[0]!.damage, 3);
  assert.equal(result.state.hp.player.current, 27); assert.equal(result.state.hp.enemy.current, 30);
  assert.equal(result.resolution!.enemyPlannedAction, 'drop');
  assert.equal(result.state.boxes.at(-1)!.owner, 'enemy');
  assert.notEqual(result.state.rngState, start.rngState);
});
test('normal enemy attack resolves defeat and overkill', () => {
  const definition = fixture('enemy-attack');
  const result = applyAction(createBattle({ ...definition, combatants: { ...definition.combatants,
    player: { ...definition.combatants.player, initialHp: 2 } } }), { type: 'enemy' });
  assert.equal(result.state.hp.player.current, -1);
  assert.deepEqual(result.state.result, { winner: 'enemy', reason: 'hp-zero' });
  assert.equal(attacks(result)[0]!.overkill, 1);
  assert.equal(result.resolution!.events.filter((event) => event.type === 'battle-end').length, 1);
});
for (const length of [3, 6]) {
  test(`passive settling creates a ${length}-link without attack events or input mutation`, () => {
    const definition = board(length, 4);
    const boxes = Array.from({ length }, (_, col) => box(col % 3, col));
    const before = structuredClone(boxes);
    const result = settleBoxes(definition, boxes);
    assert.deepEqual(boxes, before);
    assert.deepEqual(result.map((item) => item.row), Array(length).fill(3));
    assert.equal(calculateLinks(definition, result, result[0]!.id)[1]!.count, length);
    assert.ok(result.every((item) => item.type === 'normal'));
    assert.deepEqual(settleBoxes(definition, result), result);
  });
}
test('passive settling preserves stack order and terrain/invalid barriers', () => {
  const definition = board(2, 7, [{ row: 3, col: 0 }], [{ row: 3, col: 1 }]);
  const boxes = [box(0, 0, 'player'), box(1, 0, 'enemy'), box(4, 0, 'neutral'), box(0, 1), box(4, 1)];
  const result = settleBoxes(definition, boxes);
  assert.deepEqual(result.map((item) => [item.row, item.col, item.owner]), [[1, 0, 'player'], [2, 0, 'enemy'], [6, 0, 'neutral'], [2, 1, 'player'], [6, 1, 'player']]);
  assert.deepEqual(result.map((item) => item.id), boxes.map((item) => item.id));
});
test('active cleanup never triggers an attack from a newly settled remote line', () => {
  const result = drop(createBattle(config({ board: board(5, 4), initialBoxes: [box(0, 0), box(1, 1), box(2, 2)] })), 4);
  assert.equal(attacks(result).length, 0); assert.equal(result.state.hp.enemy.current, 30);
  assert.deepEqual(result.state.boxes.map((item) => item.row), [3, 3, 3, 3]);
});
test('blocked player skips, then enemy replaces drop with one instant kill and no RNG advance', () => {
  const start = createBattle(fixture('blocked-player'));
  assert.equal(getDropOptions(start).filter((option) => option.available).length, 0);
  assert.equal(start.result, null);
  const skipped = applyAction(start, { type: 'skip' });
  assert.equal(skipped.accepted, true); assert.equal(skipped.state.result, null);
  assert.equal(skipped.state.hp.player.current, 30); assert.equal(skipped.state.actor, 'enemy');
  assert.deepEqual(skipped.resolution!.events, [{ type: 'skip', actor: 'player', reason: 'no-legal-drop' }]);
  const killed = applyAction(skipped.state, { type: 'enemy' });
  assert.equal(killed.accepted, true);
  assert.deepEqual(killed.resolution!.events.map((event) => event.type), ['blocked', 'instant-kill', 'battle-end']);
  assert.equal(killed.state.hp.player.current, 0); assert.equal(killed.state.rngState, start.rngState);
  assert.deepEqual(killed.state.boxes, start.boxes);
  assert.equal(killed.resolution!.originBoxId, null); assert.deepEqual(killed.resolution!.links, []);
  assert.deepEqual(killed.state.result, { winner: 'enemy', reason: 'enemy-blocked' });
});
test('blocked enemy kills arbitrary positive HP exactly, not with fixed large damage', () => {
  const definition = fixture('blocked-player');
  const hp = 1_000_000_000;
  const start = createBattle({ ...definition, firstActor: 'enemy', combatants: { ...definition.combatants,
    player: { ...definition.combatants.player, initialHp: hp, maxHp: hp } } });
  const result = applyAction(start, { type: 'enemy' });
  const hit = result.resolution!.events.find((event) => event.type === 'instant-kill')!;
  if (hit.type !== 'instant-kill') throw new Error('Expected instant kill');
  assert.equal(hit.damage, hp); assert.equal(result.state.hp.player.current, 0);
});
test('last legal drop wins before any enemy turn or blocked-board loss', () => {
  const start = createBattle(fixture('last-drop-win'));
  assert.equal(getDropOptions(start).filter((option) => option.available).length, 1);
  const won = drop(start, 1);
  assert.equal(won.state.result!.winner, 'player');
  assert.equal(getDropOptions(won.state).filter((option) => option.available).length, 0);
  assert.equal(won.state.hp.player.current, 30); assert.equal(won.state.rngState, start.rngState);
  assert.ok(won.resolution!.events.every((event) => event.type !== 'instant-kill' && event.type !== 'blocked'));
  const enemy = applyAction(won.state, { type: 'enemy' });
  assert.equal(enemy.accepted, false); assert.equal(enemy.reason, 'battle-ended'); assert.strictEqual(enemy.state, won.state);
});
test('terminal state locks input; explicit restart resets all fields and seed', () => {
  const initial = createBattle(fixture('cross-attack'));
  const terminal = drop(initial, 1).state;
  for (const action of [{ type: 'enemy' }, { type: 'skip' }, { type: 'drop', candidateId: 'ceiling:1:0' }] as const) {
    const rejected = applyAction(terminal, action);
    assert.equal(rejected.accepted, false); assert.strictEqual(rejected.state, terminal); assert.equal(rejected.resolution, null);
  }
  assert.deepEqual(restartBattle(terminal), initial); assert.notStrictEqual(restartBattle(terminal), initial);
});
test('invalid input consumes no turn, random state, ID, or resolution', () => {
  const state = createBattle(); const before = structuredClone(state);
  for (const [action, reason] of [
    [{ type: 'drop', candidateId: 'not-a-ceiling' }, 'unknown-candidate'],
    [{ type: 'enemy' }, 'wrong-actor'], [{ type: 'skip' }, 'legal-drop-exists'],
    [{ type: 'future-unimplemented' }, 'unknown-action'],
  ] as const) {
    const result = applyAction(state, action as BattleAction);
    assert.equal(result.accepted, false); assert.equal(result.reason, reason);
    assert.strictEqual(result.state, state); assert.equal(result.resolution, null); assert.deepEqual(state, before);
  }
});
test('generated box IDs avoid configured IDs', () => {
  const state = createBattle(config({ initialBoxes: [box(7, 0, 'neutral', 'drop:1'), box(7, 1, 'neutral', 'drop:2')] }));
  const result = drop(state, 2);
  assert.equal(result.state.boxes.at(-1)!.id, 'drop:3'); assert.equal(result.state.nextBoxId, 4);
});
test('configuration and returned state are immutable caller-independent snapshots', () => {
  const input = structuredClone(defaultConfig); const start = createBattle(input);
  (input.board as { width: number }).width = 2;
  (input.combatants.player as { initialHp: number }).initialHp = 1;
  assert.equal(start.config.board.width, 6); assert.equal(start.hp.player.current, 30);
  assert.ok(Object.isFrozen(start)); assert.ok(Object.isFrozen(start.config.board)); assert.ok(Object.isFrozen(start.hp.player));
  assert.throws(() => { (start.hp.player as { current: number }).current = 0; }, TypeError);
  assert.ok(Object.isFrozen(drop(start, 0).resolution!.events)); assert.equal(start.boxes.length, 0);
});
test('enemy pattern position advances once per enemy action and resets', () => {
  const start = createBattle(config({ firstActor: 'enemy', enemyPattern: [{ type: 'drop' }, { type: 'drop' }, { type: 'drop' }] }));
  const first = applyAction(start, { type: 'enemy' }); assert.equal(first.state.enemyPatternIndex, 1);
  const second = applyAction(drop(first.state, 5).state, { type: 'enemy' }); assert.equal(second.state.enemyPatternIndex, 2);
  assert.equal(restartBattle(second.state).enemyPatternIndex, 0);
});
test('same seed and player choices reproduce every enemy choice and terminal result', () => {
  function play(seed: number) {
    let state = createBattle(config({ seed })); const record: unknown[] = [];
    while (!state.result) {
      const options = getDropOptions(state).filter((option) => option.available);
      const action: BattleAction = state.actor === 'enemy' ? { type: 'enemy' }
        : options.length === 0 ? { type: 'skip' } : { type: 'drop', candidateId: options[(state.turn * 7) % options.length]!.id };
      const result = applyAction(state, action); assert.equal(result.accepted, true);
      record.push(result.resolution); state = result.state;
      assert.ok(state.turn <= 51, 'Finite board must finish after at most one blocked skip');
    }
    return { state, record };
  }
  for (const seed of [0, 1, 42, 0xffff_ffff]) assert.deepEqual(play(seed), play(seed));
  assert.notDeepEqual(play(1).record, play(42).record);
  assert.deepEqual(restartBattle(play(42).state), createBattle(config({ seed: 42 })));
});
test('uniform index rejects biased remainder values and never samples an empty list', () => {
  const count = 0x8000_0001; const seed = 1_000;
  let cursor = nextRandomUint32(seed);
  assert.ok(cursor >= count, 'Test seed must trigger a rejected draw');
  let draws = 1;
  while (cursor >= count) { cursor = nextRandomUint32(cursor); draws += 1; }
  assert.ok(draws > 1); assert.deepEqual(sampleUniformIndex(seed, count), { index: cursor, rngState: cursor });
  for (const invalid of [0, -1, 1.5, NaN, 0x1_0000_0001]) assert.throws(() => sampleUniformIndex(1, invalid));
  assert.equal(sampleUniformIndex(1, 1).index, 0);
  assert.equal(sampleUniformIndex(1, 0x1_0000_0000).index, nextRandomUint32(1));
});
test('enemy selector reaches every legal candidate and never selects blocked candidates', () => {
  const seen = new Set<string>();
  for (let seed = 0; seed < 1_024; seed += 1) {
    const start = createBattle(config({ seed: Math.imul(seed, 0x9e3779b1) >>> 0, firstActor: 'enemy', board: board(6, 1), initialBoxes: [box(0, 1, 'neutral'), box(0, 4, 'neutral')] }));
    const event = applyAction(start, { type: 'enemy' }).resolution!.events[0]!;
    if (event.type !== 'drop') throw new Error('Expected drop');
    assert.ok([0, 2, 3, 5].includes(event.box.col)); seen.add(event.candidateId);
  }
  assert.equal(seen.size, 4);
});
for (const [name, patch] of [
  ['duplicate box position', { initialBoxes: [box(7, 0), box(7, 0, 'enemy', 'different-id')] }],
  ['duplicate box ID', { initialBoxes: [box(7, 0), box(7, 1, 'enemy', 'box:7:0')] }],
  ['out-of-board box', { initialBoxes: [box(8, 0)] }], ['negative coordinate', { initialBoxes: [box(-1, 0)] }],
  ['fractional coordinate', { initialBoxes: [box(1.5, 0)] }],
  ['terrain box', { board: board(2, 2, [{ row: 1, col: 1 }]), initialBoxes: [box(1, 1)] }],
  ['invalid-cell box', { board: board(2, 2, [], [{ row: 1, col: 1 }]), initialBoxes: [box(1, 1)] }],
  ['zero width', { board: board(0, 8) }], ['fractional height', { board: board(2, 1.5) }],
  ['duplicate terrain', { board: board(2, 2, [{ row: 0, col: 0 }, { row: 0, col: 0 }]) }],
  ['outside terrain', { board: board(2, 2, [{ row: 2, col: 0 }]) }],
  ['terrain/invalid overlap', { board: board(2, 2, [{ row: 0, col: 0 }], [{ row: 0, col: 0 }]) }],
  ['empty pattern', { enemyPattern: [] }], ['negative seed', { seed: -1 }],
  ['oversized seed', { seed: 0x1_0000_0000 }], ['fractional seed', { seed: 0.5 }],
] as [string, Partial<BattleConfig>][]) {
  test(`initial validation rejects ${name}`, () => assert.throws(() => createBattle(config(patch)), /Battle config:/));
}
for (const actor of ['player', 'enemy'] as Actor[]) {
  for (const maxHp of [0, -1, NaN, Infinity]) {
    test(`${actor} rejects maxHp ${maxHp}`, () => assert.throws(() => createBattle(config({
      combatants: { ...defaultConfig.combatants, [actor]: { ...defaultConfig.combatants[actor], maxHp } },
    })), /maxHp/));
  }
  for (const initialHp of [0, -1, 31, NaN]) {
    test(`${actor} rejects initialHp ${initialHp}`, () => assert.throws(() => createBattle(config({
      combatants: { ...defaultConfig.combatants, [actor]: { ...defaultConfig.combatants[actor], initialHp } },
    })), /initialHp/));
  }
}
test('unsupported gravity, action, owner, type, or status is rejected', () => {
  for (const mutation of [
    { board: { ...defaultConfig.board, gravity: 'left' } }, { enemyPattern: [{ type: 'skill' }] }, { firstActor: 'neutral' },
    { initialBoxes: [{ ...box(7, 0), type: 'wide' }] }, { initialBoxes: [{ ...box(7, 0), status: 'frozen' }] },
    { initialBoxes: [{ ...box(7, 0), owner: 'third-party' }] },
  ]) assert.throws(() => createBattle({ ...defaultConfig, ...mutation } as BattleConfig));
});
test('invalid damage is rejected; neutral ownership stays distinct from normal type/status', () => {
  for (const value of [-1, 1.5, Infinity, NaN, Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => createBattle(config({ combatants: { ...defaultConfig.combatants,
      player: { ...defaultConfig.combatants.player, attacks: { 3: value, 4: 7, 5: 11 } } } })), /attack 3/);
  }
  assert.deepEqual(createBattle(config({ initialBoxes: [box(7, 0, 'neutral')] })).boxes[0],
    { id: 'box:7:0', row: 7, col: 0, owner: 'neutral', type: 'normal', status: 'normal' });
});
test('settling rejects duplicate or non-playable boxes instead of losing one', () => {
  assert.throws(() => settleBoxes(board(2, 2), [box(0, 0), box(0, 0, 'enemy', 'other')]));
  assert.throws(() => settleBoxes(board(2, 2), [box(0, 0), box(0, 1, 'enemy', 'box:0:0')]));
  assert.throws(() => settleBoxes(board(2, 2), [box(3, 0)]));
});


test('two-candidate draws are not forced into low-bit alternating choices', () => {
  let state = 1;
  const selections: number[] = [];
  for (let n = 0; n < 12; n += 1) {
    const result = sampleUniformIndex(state, 2);
    selections.push(result.index); state = result.rngState;
  }
  assert.ok(selections.some((selection, index) => index > 0 && selection === selections[index - 1]));
  assert.equal(new Set(selections).size, 2);
});

test('all four axes attack in order, including continued defender overkill', () => {
  const initialBoxes = [0, 1, 2, 3].flatMap((row) => [box(row, 1), box(row, 3)]);
  initialBoxes.push(box(2, 2), box(3, 2));
  const start = createBattle(config({ board: board(5, 4), initialBoxes,
    combatants: { ...defaultConfig.combatants, enemy: { ...defaultConfig.combatants.enemy, initialHp: 1 } } }));
  assert.deepEqual(settleBoxes(start.config.board, initialBoxes), initialBoxes);
  const result = drop(start, 2);
  assert.deepEqual(attacks(result).map((hit) => hit.axis), ['vertical', 'horizontal', 'diagonal-down', 'diagonal-up']);
  assert.deepEqual(attacks(result).map((hit) => hit.hpAfter), [-3, -7, -11, -15]);
  assert.deepEqual(attacks(result).map((hit) => hit.overkill), [3, 4, 4, 4]);
  assert.equal(result.state.boxes.length, initialBoxes.length + 1);
});

for (const count of [4, 5, 6]) {
  test(`enemy ${count}-link uses enemy's own capped table`, () => {
    const start = createBattle(config({ board: board(count, 1), firstActor: 'enemy',
      initialBoxes: Array.from({ length: count - 1 }, (_, col) => box(0, col, 'enemy')) }));
    const result = applyAction(start, { type: 'enemy' });
    assert.equal(attacks(result).length, 1);
    assert.equal(attacks(result)[0]!.damage, count === 4 ? 6 : 9);
    assert.equal(attacks(result)[0]!.tier, Math.min(count, 5));
  });
}

test('exhaustive 2×3 cell layouts preserve candidates, barriers, and no-tunneling', () => {
  // 日本語: 各セルが空・箱・地形・無効の4096通りを独立な小モデルと比較する。
  // English: Compare all 4096 empty/box/terrain/invalid layouts against an independent small model.
  for (let encoded = 0; encoded < 4 ** 6; encoded += 1) {
    let remaining = encoded;
    const cells: number[][] = [[], [], []];
    const terrain: Cell[] = []; const invalid: Cell[] = []; const boxes: Box[] = [];
    for (let row = 0; row < 3; row += 1) for (let col = 0; col < 2; col += 1) {
      const value = remaining % 4; remaining = Math.floor(remaining / 4);
      cells[row]![col] = value;
      if (value === 1) boxes.push(box(row, col, 'neutral'));
      else if (value === 2) terrain.push({ row, col });
      else if (value === 3) invalid.push({ row, col });
    }
    const definition = config({ board: board(2, 3, terrain, invalid), initialBoxes: boxes });
    const options = getDropOptions(createBattle(definition));
    const expectedStarts: string[] = [];
    for (let col = 0; col < 2; col += 1) for (let row = 0; row < 3; row += 1) {
      if (cells[row]![col]! >= 2 || (row > 0 && cells[row - 1]![col]! < 2)) continue;
      const id = `ceiling:${col}:${row}`; expectedStarts.push(id);
      const option = options.find((item) => item.id === id)!;
      assert.ok(option, `Missing ${id} for layout ${encoded}`);
      if (cells[row]![col] === 1) {
        assert.equal(option.available, false); assert.equal(option.landing, null); assert.equal(option.path.length, 0);
      } else {
        let end = row;
        while (end + 1 < 3 && cells[end + 1]![col] === 0) end += 1;
        assert.equal(option.available, true); assert.deepEqual(option.landing, { row: end, col });
        assert.equal(option.path.length, end - row + 1);
        assert.ok(option.path.every((cell) => cell.col === col));
      }
    }
    assert.deepEqual(options.map((option) => option.id), expectedStarts);
    const settled = settleBoxes(definition.board, boxes);
    assert.equal(settled.length, boxes.length);
    assert.equal(new Set(settled.map((item) => `${item.row},${item.col}`)).size, boxes.length);
    assert.deepEqual(settleBoxes(definition.board, settled), settled);
    for (const old of boxes) assert.ok(settled.find((item) => item.id === old.id)!.row >= old.row);
  }
});
