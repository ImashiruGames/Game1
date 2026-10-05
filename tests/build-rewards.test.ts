import test from 'node:test';
import assert from 'node:assert/strict';
import { acquireSkill, activeSkillValue, applyAction, battleFixtures, carryTransformationState, createBattle, createPlayerBuild, createSkill, defaultConfig, instantSlots, playerPower } from '../src/core/index.ts';
import type { BattleConfig, NormalSkillId, PlayerBuild } from '../src/core/index.ts';
import { applyReward, generateRewardOffer, requiresReplacement, rewardPool, rewardSeed } from '../src/app/rewards.ts';
const equip = (character: 'blue' | 'red', a: NormalSkillId | null = null, b: NormalSkillId | null = null): PlayerBuild => ({ ...createPlayerBuild(character), slots: [a ? createSkill(a) : null, b ? createSkill(b) : null] });
const config = (build = createPlayerBuild('blue'), patch: Partial<BattleConfig> = {}): BattleConfig => ({ ...defaultConfig, characterId: build.fixed.id === 'health' ? 'blue' : 'red', initialBuild: build, ...patch });
const fixture = (id: string) => battleFixtures.find(f => f.id === id)!;

test('fixed starter and flexible duplicate acquisitions upgrade exactly once without changing slot count', () => {
  let build = createPlayerBuild('blue');
  build = acquireSkill(build, 'health')!; assert.equal(build.fixed.rank, 2); assert.deepEqual(build.slots, [null, null]);
  assert.equal(acquireSkill(build, 'health'), null);
  build = acquireSkill(build, 'charge')!; build = acquireSkill(build, 'charge')!;
  assert.equal(build.slots[0]?.rank, 2); assert.equal(build.slots[1], null);
  assert.ok(Object.isFrozen(build)); assert.ok(Object.isFrozen(build.slots));
});
test('full slots require explicit replacement and never replace the fixed slot', () => {
  const build = equip('blue', 'charge', 'first-guard');
  assert.equal(requiresReplacement(build, 'square-strike'), true);
  for (const replacement of [undefined, -1, 2, 0.5]) assert.equal(acquireSkill(build, 'square-strike', replacement), null);
  const changed = acquireSkill(build, 'square-strike', 1)!;
  assert.equal(changed.fixed.id, 'health'); assert.equal(changed.slots[0]?.id, 'charge'); assert.equal(changed.slots[1]?.id, 'square-strike');
  assert.equal(requiresReplacement(build, 'health'), false); assert.equal(requiresReplacement(build, 'three-polish'), false);
});
test('permanent power upgrades repeat additively without consuming or tiering slots', () => {
  let build = equip('red', 'charge', 'first-guard');
  for (let i = 0; i < 10; i += 1) { build = applyReward(build, 'three-polish')!; build = applyReward(build, 'large-polish')!; }
  assert.deepEqual(build.power, { 3: 10, 4: 10, 5: 20 }); assert.equal(build.slots[0]?.id, 'charge'); assert.equal(build.fixed.rank, 1);
  const state = createBattle(config(build)); assert.equal(playerPower(state, 3), 14); assert.equal(playerPower(state, 4), 17); assert.equal(playerPower(state, 5), 31);
});
test('offers contain three unique identities, repeat deterministically, and exclude only owned plus skills', () => {
  let build = equip('blue', 'healing-potion'); build = acquireSkill(build, 'health')!;
  const pool = rewardPool(build); assert.equal(pool.includes('health'), false); assert.equal(pool.includes('healing-potion'), true); assert.ok(pool.includes('grow-fire'));
  const seed = rewardSeed(123); const first = generateRewardOffer(build, seed, 'offer:1');
  assert.equal(first.offer.choices.length, 3); assert.equal(new Set(first.offer.choices).size, 3);
  assert.deepEqual(first, generateRewardOffer(build, seed, 'offer:1')); assert.ok(Object.isFrozen(first.offer.choices));
});
test('consumable duplicate becomes plus with one use, empties its slot, and reacquires as base', () => {
  const base = equip('blue', 'healing-potion'); const plus = acquireSkill(base, 'healing-potion')!;
  assert.equal(plus.slots[0]?.rank, 2); assert.equal(plus.slots[0]?.uses, 1);
  const result = applyAction(createBattle(config(plus)), { type: 'instant-skill', slot: 0 });
  assert.equal(result.accepted, true); assert.equal(result.state.build?.slots[0], null); assert.equal(result.state.actor, 'enemy'); assert.equal(result.state.turn, 2);
  const reacquired = acquireSkill(result.state.build!, 'healing-potion')!; assert.equal(reacquired.slots[0]?.rank, 1);
});
test('potion heals nominal 5 or 10, consumes one action at full HP, and triggers transformed Blue reflection', () => {
  for (const rank of [1, 2] as const) {
    const build = { ...equip('blue'), slots: [createSkill('healing-potion', rank), null] as const };
    const result = applyAction(createBattle(config(build, { initialTransformation: { character: 'blue', scope: 'stage' } })), { type: 'instant-skill', slot: 0 });
    const heal = result.resolution!.events.find(e => e.type === 'heal')!; const damage = result.resolution!.events.find(e => e.type === 'damage')!;
    assert.equal(heal.amount, 0); assert.equal(heal.requestedAmount, rank === 1 ? 5 : 10); assert.equal(damage.damage, heal.requestedAmount);
    assert.equal(result.state.build?.slots[0], null); assert.equal(result.state.gauge, 1);
  }
});
test('magic bullet uses upgraded current 4-link base power, excludes direction modifiers and stage growth', () => {
  for (const rank of [1, 2] as const) {
    const build = { ...equip('blue', null, 'horizontal-slash'), slots: [createSkill('magic-bullet', rank), createSkill('horizontal-slash', 2)] as const, power: { 3: 8, 4: 2, 5: 4 } };
    const state = { ...createBattle(config(build)), link3Growth: 20 };
    const result = applyAction(state, { type: 'instant-skill', slot: 0 });
    assert.equal(result.resolution!.events.find(e => e.type === 'damage')!.damage, 9 * (rank === 1 ? 2 : 3));
    assert.deepEqual(result.resolution!.links, []); assert.equal(result.resolution!.originBoxId, null); assert.equal(result.state.gauge, 1);
  }
});
test('instant skills work with a full board and invalid slot input is atomic', () => {
  const blocked = fixture('blocked-player'); const state = createBattle(config(equip('blue', 'healing-potion'), blocked));
  assert.deepEqual(instantSlots(state), [0]);
  for (const slot of [-1, 1, 2, 0.5, NaN]) { const result = applyAction(state, { type: 'instant-skill', slot }); assert.equal(result.accepted, false); assert.strictEqual(result.state, state); }
  assert.equal(applyAction(state, { type: 'instant-skill', slot: 0 }).accepted, true);
});
test('charge changes total own-turn end gain from1 to3, or4 for plus', () => {
  for (const rank of [1, 2] as const) {
    const build = { ...equip('blue'), slots: [createSkill('charge', rank), null] as const };
    const result = applyAction(createBattle(config(build)), { type: 'board-skill', skillId: 'pain-shared', row: 0 });
    assert.equal(result.state.gauge, rank === 1 ? 3 : 4);
  }
});
test('Health plus heals20 and Grow Fire plus uses bonus5 without changing growth increment', () => {
  const health = applyAction(createBattle(config({ ...createPlayerBuild('blue'), fixed: createSkill('health', 2) }, fixture('health-plus'))), { type: 'drop', candidateId: 'ceiling:0:0' });
  assert.equal(health.resolution!.events.find(e => e.type === 'heal')!.requestedAmount, 20);
  const fire = applyAction(createBattle(config({ ...createPlayerBuild('red'), fixed: createSkill('grow-fire', 2), power: { 3: 2, 4: 0, 5: 0 } }, fixture('grow-fire'))), { type: 'drop', candidateId: 'ceiling:1:0' });
  assert.equal(fire.resolution!.events.find(e => e.type === 'attack')!.damage, 11); assert.equal(fire.state.link3Growth, 1);
});
test('multiple L matches activate once, then square once, in slot order', () => {
  const state = createBattle(fixture('shape-skills-lab'));
  const result = applyAction(state, { type: 'drop', candidateId: 'ceiling:0:0' });
  const damage = result.resolution!.events.filter(e => e.type === 'damage');
  assert.deepEqual(damage.map(e => [e.source, e.damage]), [['corner-strike', 3], ['square-strike', 5]]);
  assert.equal(result.state.gauge, 1); assert.equal(damage[0]!.shapeBoxIds?.length, 3); assert.equal(damage[1]!.shapeBoxIds?.length, 4);
});
test('plus shape damage values are5 and8 and do not suppress later links', () => {
  const f = fixture('shape-skills-lab'); const build = { ...f.initialBuild!, slots: [createSkill('corner-strike', 2), createSkill('square-strike', 2)] as const };
  const result = applyAction(createBattle({ ...f, initialBuild: build }), { type: 'drop', candidateId: 'ceiling:0:0' });
  assert.deepEqual(result.resolution!.events.filter(e => e.type === 'damage').map(e => e.damage), [5, 8]);
});
test('permanent build carries without double application while stage growth resets', () => {
  const won = { ...createBattle(config(applyReward(createPlayerBuild('red'), 'three-polish')!)), link3Growth: 7 };
  const next = carryTransformationState(createBattle(config(createPlayerBuild('red'))), won);
  assert.equal(next.link3Growth, 0); assert.equal(playerPower(next, 3), 5); assert.equal(activeSkillValue(next, 'grow-fire'), 3);
});

test('horizontal and diagonal link skills modify their own axes once, leaving Grow Fire unchanged', () => {
  const cross = fixture('cross-attack');
  for (const rank of [1, 2] as const) {
    const build = { ...createPlayerBuild('red'), slots: [createSkill('horizontal-slash', rank), null] as const };
    const result = applyAction(createBattle(config(build, { ...cross, combatants: { ...cross.combatants, enemy: { ...cross.combatants.enemy, initialHp: 30 } } })), { type: 'drop', candidateId: 'ceiling:1:0' });
    assert.deepEqual(result.resolution!.events.filter(e => e.type === 'attack').map(e => e.damage), [7, rank === 1 ? 7 : 9]);
  }
});
test('guard reduces only first positive enemy link hit each enemy turn, with correct actual damage charging', () => {
  const f = fixture('cross-attack');
  for (const rank of [1, 2] as const) {
    const build = { ...createPlayerBuild('blue'), slots: [createSkill('first-guard', rank), null] as const };
    const state = createBattle(config(build, { ...f, firstActor: 'enemy', initialBoxes: f.initialBoxes.map(b => ({ ...b, owner: b.owner === 'player' ? 'enemy' : b.owner })) }));
    const result = applyAction(state, { type: 'enemy' });
    assert.deepEqual(result.resolution!.events.filter(e => e.type === 'attack').map(e => e.damage), [rank === 1 ? 1 : 0, 3]);
    assert.equal(result.state.gauge, rank === 1 ? 4 : 3);
  }
});
test('guard never reduces self-cost or blocked-enemy lethal replacement', () => {
  const build = equip('red', 'first-guard');
  const self = applyAction(createBattle(config(build)), { type: 'board-skill', skillId: 'ember' }); assert.equal(self.state.hp.player.current, 27);
  const f = fixture('blocked-player');
  const lethal = applyAction(createBattle(config(build, { ...f, firstActor: 'enemy' })), { type: 'enemy' });
  assert.equal(lethal.state.hp.player.current, 0); assert.equal(lethal.state.result?.reason, 'enemy-blocked');
});
