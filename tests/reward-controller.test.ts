import test from 'node:test';
import assert from 'node:assert/strict';
import { BattleController } from '../src/app/BattleController.ts';
import type { BattleView } from '../src/app/BattleController.ts';
import { battleFixtures, createPlayerBuild, createSkill, defaultConfig, playerPower } from '../src/core/index.ts';
import type { BattleConfig, Resolution } from '../src/core/index.ts';
import { generateRewardOffer, rewardSeed } from '../src/app/rewards.ts';
const fixture = (id: string): BattleConfig => ({ ...battleFixtures.find(f => f.id === id)!, enemyId: 'marujiro' });
const options = { run: { mode: 'endless' as const, rewards: true } };
function harness() { const resolutions: Resolution[] = []; const view: BattleView = { render() {}, async animate(resolution) { resolutions.push(resolution); } }; return { view, resolutions }; }
async function win(id = 'reward-lab') { const h = harness(); const controller = new BattleController(fixture(id), h.view, options); await controller.drop('ceiling:2:0'); return { ...h, controller }; }

test('victory waits for one stable reward offer before next-stage setup or automatic action', async () => {
  const { controller, resolutions } = await win(); const offer = controller.runSnapshot!.offer!; const snapshot = controller.snapshot;
  assert.equal(controller.runSnapshot!.status, 'reward'); assert.equal(controller.runSnapshot!.stage, 1); assert.equal(resolutions.length, 1);
  await controller.start(); await controller.start();
  assert.strictEqual(controller.runSnapshot!.offer, offer); assert.strictEqual(controller.snapshot, snapshot);
  assert.equal(await controller.drop('ceiling:0:0'), false); assert.equal(await controller.boardSkill('pain-shared', 0), false); assert.equal(await controller.instantSkill(0), false);
});
test('chosen power applies once, carry is passive, and second enemy starts at40HP', async () => {
  const { controller, resolutions } = await win(); const id = controller.runSnapshot!.offer!.id;
  assert.equal(await controller.chooseReward(id, 'three-polish'), true);
  assert.equal(await controller.chooseReward(id, 'three-polish'), false);
  assert.equal(controller.runSnapshot!.stage, 2); assert.equal(controller.snapshot.config.enemyId, 'hikikizan'); assert.equal(controller.snapshot.hp.enemy.max, 40);
  assert.equal(controller.snapshot.hp.player.current, 30); assert.equal(controller.snapshot.gauge, 13); assert.equal(playerPower(controller.snapshot, 3), 5);
  assert.equal(controller.snapshot.config.combatants.player.attacks[3], 4); assert.equal(resolutions.length, 1);
});
test('invalid choice/replacement cannot consume or reroll an offer, and fixed starter remains protected', async () => {
  const { controller } = await win('reward-replace'); assert.equal(controller.snapshot.gauge, 15, '12 link charge plus total3 at turn end'); const run = controller.runSnapshot; const before = controller.snapshot; const id = run!.offer!.id;
  assert.equal(await controller.chooseReward(id, 'corner-strike'), false);
  assert.equal(await controller.chooseReward(id, 'corner-strike', 2), false);
  assert.equal(await controller.chooseReward('old-id', 'three-polish'), false);
  assert.strictEqual(controller.runSnapshot, run); assert.strictEqual(controller.snapshot, before);
  assert.equal(await controller.chooseReward(id, 'corner-strike', 1), true);
  assert.equal(controller.snapshot.build!.fixed.id, 'health'); assert.equal(controller.snapshot.build!.slots[0]?.id, 'charge'); assert.equal(controller.snapshot.build!.slots[1]?.id, 'corner-strike');
});
test('skip preserves build and does not perturb the next-stage combat RNG', async () => {
  const a = await win(); const b = await win(); const original = a.controller.snapshot.build;
  await a.controller.chooseReward(a.controller.runSnapshot!.offer!.id, null);
  await b.controller.chooseReward(b.controller.runSnapshot!.offer!.id, 'three-polish');
  assert.strictEqual(a.controller.snapshot.build, original); assert.equal(a.controller.snapshot.rngState, b.controller.snapshot.rngState);
});
test('Red bonus kill pauses for a reward before its carried remaining bonus executes', async () => {
  const h = harness(); const controller = new BattleController(fixture('bonus-reward-lab'), h.view, options);
  await controller.start(); assert.equal(controller.runSnapshot!.status, 'reward'); assert.equal(controller.runSnapshot!.stage, 1); assert.equal(h.resolutions.length, 1);
  assert.equal(controller.snapshot.transformation?.character === 'red' && controller.snapshot.transformation.remainingStarts, 1);
  await controller.chooseReward(controller.runSnapshot!.offer!.id, null);
  assert.equal(controller.runSnapshot!.stage, 2); assert.equal(controller.snapshot.hp.enemy.current, 40); assert.equal(h.resolutions.length, 2);
  assert.equal(controller.snapshot.actor, 'player'); assert.equal(controller.snapshot.turn, 1);
  assert.equal(controller.snapshot.transformation?.character === 'red' && controller.snapshot.transformation.remainingStarts, 0);
});
test('last Red bonus kill expires at victory boundary and offers a reward without a third bonus', async () => {
  const h = harness(); const c = fixture('bonus-reward-lab'); const controller = new BattleController({ ...c, initialTransformation: { character: 'red', scope: 'run', remainingStarts: 1 } }, h.view, options);
  await controller.start(); assert.equal(controller.snapshot.transformation, null);
  await controller.chooseReward(controller.runSnapshot!.offer!.id, null);
  assert.equal(h.resolutions.length, 1); assert.equal(controller.runSnapshot!.stage, 2); assert.equal(controller.snapshot.transformation, null);
});
test('restart while waiting for a reward invalidates that offer without touching the new run', async () => {
  const { controller } = await win(); const id = controller.runSnapshot!.offer!.id;
  await controller.restart(fixture('reward-lab'), options); const before = controller.snapshot;
  assert.equal(await controller.chooseReward(id, 'three-polish'), false); assert.strictEqual(controller.snapshot, before);
  assert.equal(controller.runSnapshot!.status, 'active'); assert.equal(controller.snapshot.build!.power[3], 0);
});
test('restart during reward transition ignores old completion and next-stage hooks', async () => {
  let finish!: () => void; let signal!: AbortSignal;
  const view: BattleView = { render() {}, async animate() {}, async animateStageTransition(_before, _after, _run, value) { signal = value; await new Promise<void>(resolve => { finish = resolve; }); } };
  const controller = new BattleController(fixture('reward-lab'), view, options); await controller.drop('ceiling:2:0');
  const choosing = controller.chooseReward(controller.runSnapshot!.offer!.id, null);
  await controller.restart(defaultConfig, {}); finish(); await choosing;
  assert.equal(signal.aborted, true); assert.equal(controller.runSnapshot, null); assert.equal(controller.snapshot.config.id, 'standard'); assert.equal(controller.snapshot.boxes.length, 0);
});
test('endless mode survives the third enemy and wraps to stage4 Marujiro90HP', async () => {
  const empty = createPlayerBuild('blue'); let selectedSeed = -1;
  for (let seed = 0; seed < 10000 && selectedSeed < 0; seed += 1) {
    let rng = rewardSeed(seed); let valid = true;
    for (let stage = 1; stage <= 3; stage += 1) { const next = generateRewardOffer(empty, rng, String(stage)); rng = next.rngState; valid &&= next.offer.choices.includes('magic-bullet'); }
    if (valid) selectedSeed = seed;
  }
  assert.ok(selectedSeed >= 0);
  const c: BattleConfig = { ...defaultConfig, characterId: 'blue', enemyId: 'marujiro', seed: selectedSeed,
    initialBuild: { ...empty, slots: [createSkill('magic-bullet'), null] }, combatants: { ...defaultConfig.combatants, player: { ...defaultConfig.combatants.player, attacks: { 3: 4, 4: 100, 5: 11 } } } };
  const h = harness(); const controller = new BattleController(c, h.view, options);
  for (let i = 0; i < 3; i += 1) { assert.equal(await controller.instantSkill(0), true); assert.equal(controller.runSnapshot!.status, 'reward'); await controller.chooseReward(controller.runSnapshot!.offer!.id, 'magic-bullet'); }
  assert.equal(controller.runSnapshot!.stage, 4); assert.equal(controller.runSnapshot!.status, 'active'); assert.equal(controller.snapshot.config.enemyId, 'marujiro'); assert.equal(controller.snapshot.hp.enemy.current, 90);
  assert.equal(controller.snapshot.hp.player.current, 30); assert.equal(controller.snapshot.build!.slots[0]?.rank, 1);
});
