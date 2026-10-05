import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, battleFixtures, createBattle, createCharacterBattleConfig, createPlayerBuild, createSkill, createTuning, defaultConfig, defaultTuning, getEnemyIntent, getRowSkillPreview, skillDescription } from '../src/core/index.ts';
import { gaugeDefinition } from '../src/core/gauge.ts';
import { endlessEncounter } from '../src/app/progression.ts';
import { applyReward, generateRewardOffer, rewardLabel } from '../src/app/rewards.ts';
import { enemyIntentLabel } from '../src/ui/battlePresentation.ts';
import { BattleController } from '../src/app/BattleController.ts';
const fixture = (id: string) => battleFixtures.find(f => f.id === id)!;

test('typed overrides merge narrowly and never mutate defaults or caller objects', () => {
  const health: [number, number] = [7, 12];
  const tune = createTuning({ skills: { health }, enemies: { marujiro: { attacks: { 3: 9 } } } });
  health[0] = 99;
  assert.deepEqual(tune.skills.health, [7, 12]); assert.deepEqual(tune.enemies.marujiro.attacks, { 3: 9, 4: 4, 5: 6 });
  assert.deepEqual(defaultTuning.skills.health, [15, 20]); assert.ok(Object.isFrozen(tune)); assert.ok(Object.isFrozen(tune.skills.health));
  assert.deepEqual(createTuning(), defaultTuning);
});
test('invalid tuning is rejected at creation and battle boundaries', () => {
  for (const cost of [0, -1, 1.5, NaN]) assert.throws(() => createTuning({ gauge: { limits: { blue: { cost } } } }));
  assert.throws(() => createTuning({ gauge: { limits: { blue: { cost: 80, cap: 70 } } } }));
  assert.throws(() => createTuning({ skills: { health: [-1, 20] } }));
  assert.throws(() => createTuning({ transformation: { redBonusStarts: 0 } }));
  assert.throws(() => createTuning({ rewards: { choices: 0 } }));
  assert.throws(() => createBattle({ ...defaultConfig, tuning: { ...defaultTuning, progression: { hpPerStage: -1 } } }));
});
test('Pain preview and effect share an injected per-box amount', () => {
  const tuning = createTuning({ board: { painPerBox: 3 }, gauge: { damagePerHp: 2, turnGain: 2 } });
  const state = createBattle({ ...fixture('blocked-player'), characterId: 'blue', tuning });
  const preview = getRowSkillPreview(state, 0); assert.equal(preview.enemyDamage, 3); assert.equal(preview.playerDamage, 3);
  const result = applyAction(state, { type: 'board-skill', skillId: 'pain-shared', row: 0 });
  assert.equal(result.state.hp.player.current, 27); assert.equal(result.state.hp.enemy.current, 27); assert.equal(result.state.gauge, 8);
});
test('Ember cost and conversion count are independent injected values', () => {
  const tuning = createTuning({ board: { emberCost: 4, emberConversions: 0 } });
  const state = createBattle({ ...fixture('blocked-player'), characterId: 'red', tuning });
  const result = applyAction(state, { type: 'board-skill', skillId: 'ember' });
  assert.equal(result.state.hp.player.current, 26); assert.equal(result.state.rngState, state.rngState);
  assert.deepEqual(result.resolution!.events.find(e => e.type === 'boxes-converted')?.boxIds, []);
});
test('gauge, link eligibility and Red duration use one injected configuration', () => {
  const tuning = createTuning({ gauge: { linkPerBox: 2, limits: { red: { cost: 6, cap: 9 } } }, transformation: { minimumLink: 3, redBonusStarts: 3 } });
  assert.deepEqual(gaugeDefinition('red', tuning), { cost: 6, cap: 9 });
  const state = createBattle(createCharacterBattleConfig('red', 'marujiro', { ...fixture('grow-fire'), tuning }));
  const result = applyAction(state, { type: 'drop', candidateId: 'ceiling:1:0' });
  assert.equal(result.state.gauge, 4); // Two6-point links cap at9, cost6, ordinary-end+1.
  assert.equal(result.state.transformation?.character === 'red' && result.state.transformation.remainingStarts, 3);
});
test('healing, consumable multipliers and charge descriptions follow alternate strength values', () => {
  const tuning = createTuning({ skills: { health: [7, 12], 'magic-bullet': [4, 5], charge: [3, 6] }, gauge: { turnGain: 2 } });
  const health = applyAction(createBattle(createCharacterBattleConfig('blue', 'marujiro', { ...fixture('health-plus'), tuning })), { type: 'drop', candidateId: 'ceiling:0:0' });
  assert.equal(health.resolution!.events.find(e => e.type === 'heal')!.requestedAmount, 7);
  const build = { ...createPlayerBuild('blue'), slots: [createSkill('magic-bullet'), createSkill('charge')] as const };
  const bullet = applyAction(createBattle({ ...defaultConfig, characterId: 'blue', tuning, initialBuild: build }), { type: 'instant-skill', slot: 0 });
  assert.equal(bullet.resolution!.events.find(e => e.type === 'damage')!.damage, 28); assert.equal(bullet.state.gauge, 5);
  assert.match(skillDescription('charge', 1, tuning), /合計5/);
});
test('named enemy profiles and scheduled healing derive from the same tuning', () => {
  const tuning = createTuning({ enemies: { nigirin: { maxHp: 45, attacks: { 3: 8 }, healEveryOwnTurns: 2, healAmount: 4 } }, progression: { hpPerStage: 7 } });
  const state = createBattle(createCharacterBattleConfig('blue', 'nigirin', { ...defaultConfig, tuning }));
  assert.equal(state.hp.enemy.max, 45); assert.equal(state.config.combatants.enemy.attacks[3], 8);
  assert.deepEqual(getEnemyIntent({ ...state, enemyTurnCount: 1 }), { type: 'heal', amount: 4 });
  assert.equal(enemyIntentLabel(getEnemyIntent({ ...state, enemyTurnCount: 1 })), '回復 +4');
  assert.deepEqual(endlessEncounter(3, 'marujiro', tuning), { enemyId: 'nigirin', maxHp: 59 });
});
test('reward count, power and displayed descriptions use injected values', () => {
  const tuning = createTuning({ rewards: { choices: 1, threePower: 2, largeFourPower: 3, largeFivePower: 4 } });
  const build = createPlayerBuild('blue');
  assert.equal(generateRewardOffer(build, 1, 'test', tuning).offer.choices.length, 1);
  assert.deepEqual(applyReward(build, 'large-polish', undefined, tuning)!.power, { 3: 0, 4: 3, 5: 4 });
  assert.equal(applyReward(build, 'three-polish', undefined, tuning)!.power[3], 2);
  assert.match(rewardLabel(build, 'large-polish', tuning).description, /4リンク＋3・5以上＋4/);
});
test('controller propagates alternate progression and rewards through a real stage transition', async () => {
  const tuning = createTuning({ progression: { hpPerStage: 7 }, rewards: { choices: 1 }, enemies: { hikikizan: { maxHp: 42 } } });
  const c = { ...fixture('reward-lab'), enemyId: 'marujiro' as const, tuning };
  const controller = new BattleController(c, { render() {}, async animate() {} }, { run: { mode: 'endless', rewards: true } });
  await controller.drop('ceiling:2:0'); assert.equal(controller.runSnapshot!.offer!.choices.length, 1);
  await controller.chooseReward(controller.runSnapshot!.offer!.id, null);
  assert.equal(controller.snapshot.hp.enemy.max, 49); assert.deepEqual(controller.snapshot.config.tuning, tuning);
});


test('direct incomplete tuning records fail before creating NaN HP or silently disabled gauge', () => {
  for (const tuning of [
    { ...defaultTuning, board: { emberCost: 3, emberConversions: 2 } },
    { ...defaultTuning, gauge: { ...defaultTuning.gauge, limits: { red: defaultTuning.gauge.limits.red } } },
    { ...defaultTuning, enemies: { ...defaultTuning.enemies, nigirin: undefined } },
  ]) assert.throws(() => createBattle({ ...defaultConfig, tuning: tuning as unknown as typeof defaultTuning }));
});
test('optional enemy healing can be absent in a complete custom profile without inheriting default behavior', () => {
  const tuning = { ...defaultTuning, enemies: { ...defaultTuning.enemies, nigirin: { maxHp: 40, attacks: { 3: 2, 4: 4, 5: 6 } } } };
  const state = createBattle(createCharacterBattleConfig('blue', 'nigirin', { ...defaultConfig, tuning }));
  assert.deepEqual(getEnemyIntent({ ...state, enemyTurnCount: 4 }), { type: 'drop' });
  assert.equal(Object.isFrozen(tuning.enemies.nigirin.attacks), false);
});
test('Grow Fire growth and its description are independently configurable with default1 retained', () => {
  const tuning = createTuning({ links: { growFireGrowth: 2 } });
  const state = createBattle(createCharacterBattleConfig('red', 'marujiro', { ...fixture('grow-fire'), tuning }));
  const result = applyAction(state, { type: 'drop', candidateId: 'ceiling:1:0' });
  assert.equal(result.state.link3Growth, 2); assert.equal(result.resolution!.events.find(e => e.type === 'link-growth')!.amount, 2);
  assert.match(skillDescription('grow-fire', 1, tuning), /成長＋2/);
});


test('sparse base/plus arrays cannot pass validation and create NaN effects', () => {
  assert.throws(() => createTuning({ skills: { health: new Array(2) as unknown as readonly [number, number] } }));
});
