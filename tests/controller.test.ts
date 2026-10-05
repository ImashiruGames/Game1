import test from 'node:test';
import assert from 'node:assert/strict';
import { BattleController } from '../src/app/BattleController.ts';
import { battleFixtures, defaultConfig, createBattle, getDropOptions } from '../src/core/index.ts';
import type { BattleConfig, BattleState, Resolution } from '../src/core/index.ts';
import type { BattleView } from '../src/app/BattleController.ts';

const fixture = (id: string): BattleConfig => {
  const config = battleFixtures.find(f => f.id === id);
  assert.ok(config, `Missing test fixture ${id}`);
  return config;
};
const firstCandidate = (state: BattleState): string => {
  const option = getDropOptions(state).find(option => option.available);
  assert.ok(option, 'Test requires a legal drop');
  return option.id;
};
const flush = () => new Promise<void>(resolve => setImmediate(resolve));

function deferredView() {
  const gates: Array<() => void> = [];
  const resolutions: Resolution[] = [];
  const signals: AbortSignal[] = [];
  const renders: Array<{ state: BattleState; resolving: boolean }> = [];
  let resets = 0;
  const view: BattleView = {
    render(state, resolving) { renders.push({ state, resolving }); },
    animate(resolution, _before, _after, signal) {
      resolutions.push(resolution);
      signals.push(signal);
      // 日本語: わざと中断を無視する演出でも世代ロックが守るかを検証。
      // English: Even a renderer that ignores cancellation cannot corrupt a restarted match.
      return new Promise<void>(resolve => gates.push(resolve));
    },
    reset() { resets += 1; },
  };
  return { view, gates, resolutions, signals, renders, get resets() { return resets; } };
}

function immediateView() {
  const resolutions: Resolution[] = [];
  const renders: Array<{ state: BattleState; resolving: boolean }> = [];
  const view: BattleView = {
    render(state, resolving) { renders.push({ state, resolving }); },
    async animate(resolution) { resolutions.push(resolution); },
  };
  return { view, resolutions, renders };
}

test('rapid input is locked across both player and enemy animation; each action commits once', async () => {
  const mock = deferredView();
  const controller = new BattleController(defaultConfig, mock.view);
  await controller.start();
  const id = firstCandidate(controller.snapshot);
  const pending = controller.drop(id);
  assert.equal(controller.isResolving, true);
  assert.equal(controller.snapshot.boxes.length, 1);
  assert.equal(await controller.drop(id), false);
  assert.equal(mock.resolutions.length, 1);
  mock.gates[0]!();
  await flush();
  assert.equal(mock.resolutions.length, 2);
  assert.equal(controller.snapshot.boxes.length, 2);
  assert.equal(await controller.drop(id), false);
  mock.gates[1]!();
  assert.equal(await pending, true);
  assert.equal(controller.snapshot.boxes.length, 2);
  assert.equal(controller.snapshot.actor, 'player');
  assert.equal(controller.isResolving, false);
});

test('restart during falling cancels old signal and ignores stale completion', async () => {
  const mock = deferredView();
  const controller = new BattleController(defaultConfig, mock.view);
  const pending = controller.drop(firstCandidate(controller.snapshot));
  await controller.restart();
  assert.equal(mock.signals[0]!.aborted, true);
  assert.equal(mock.resets, 1);
  assert.deepEqual(controller.snapshot, createBattle(defaultConfig));
  mock.gates[0]!();
  await pending;
  assert.deepEqual(controller.snapshot, createBattle(defaultConfig));
  assert.equal(mock.resolutions.length, 1, 'old completion must not trigger an enemy turn');
  assert.equal(controller.isResolving, false);
});

test('restart during enemy animation cannot advance the new battle', async () => {
  const mock = deferredView();
  const controller = new BattleController(defaultConfig, mock.view);
  const pending = controller.drop(firstCandidate(controller.snapshot));
  mock.gates[0]!();
  await flush();
  assert.equal(mock.resolutions.length, 2);
  await controller.restart({ ...defaultConfig, seed: 77 });
  assert.equal(mock.signals[1]!.aborted, true);
  mock.gates[1]!();
  await pending;
  assert.equal(controller.snapshot.turn, 1);
  assert.equal(controller.snapshot.rngState, 77);
  assert.equal(controller.snapshot.boxes.length, 0);
});

test('blocked player skips visibly before enemy lethal action, with no random draw', async () => {
  const mock = immediateView();
  const controller = new BattleController(fixture('blocked-player'), mock.view);
  await controller.start();
  assert.equal(mock.resolutions.length, 2);
  assert.deepEqual(mock.resolutions[0]!.events.map(e => e.type), ['skip']);
  assert.deepEqual(mock.resolutions[1]!.events.map(e => e.type), ['blocked', 'instant-kill', 'battle-end']);
  assert.equal(controller.snapshot.rngState, controller.snapshot.config.seed);
  assert.equal(controller.snapshot.result?.winner, 'enemy');
  assert.equal(controller.isResolving, false);
});

test('winning action prevents enemy scheduling; terminal inputs are immutable until restart', async () => {
  const mock = immediateView();
  const config = fixture('cross-attack');
  const controller = new BattleController(config, mock.view);
  await controller.start();
  await controller.drop(firstCandidate(controller.snapshot));
  const won = controller.snapshot;
  assert.equal(won.result?.winner, 'player');
  assert.equal(won.hp.enemy.current, -4);
  assert.equal(mock.resolutions.length, 1);
  assert.equal(await controller.drop(firstCandidate(createBattle(config))), false);
  await controller.start();
  assert.equal(controller.snapshot, won);
  assert.equal(mock.resolutions.length, 1);
  await controller.restart();
  assert.deepEqual(controller.snapshot, createBattle(config));
  assert.equal(controller.isResolving, false);
});

test('invalid input and invalid restart leave the current match unchanged', async () => {
  const mock = immediateView();
  const controller = new BattleController(defaultConfig, mock.view);
  const before = controller.snapshot;
  assert.equal(await controller.drop('not-a-ceiling'), false);
  assert.equal(controller.snapshot, before);
  assert.equal(mock.resolutions.length, 0);
  assert.equal(controller.isResolving, false);
  await assert.rejects(() => controller.restart({ ...defaultConfig, seed: -1 }));
  assert.equal(controller.snapshot, before);
});

test('render failure does not replay committed actions or leave input locked', async () => {
  let attempts = 0;
  let errors = 0;
  const controller = new BattleController(defaultConfig, {
    render() {},
    async animate() { attempts += 1; throw new Error('test animation error'); },
    reportError() { errors += 1; },
  });
  await controller.drop(firstCandidate(controller.snapshot));
  assert.equal(attempts, 2);
  assert.equal(errors, 2);
  assert.equal(controller.snapshot.boxes.length, 2);
  assert.equal(controller.isResolving, false);
});

test('destroy blocks input and stale animation continuation', async () => {
  const mock = deferredView();
  const controller = new BattleController(defaultConfig, mock.view);
  const pending = controller.drop(firstCandidate(controller.snapshot));
  controller.destroy();
  assert.equal(mock.signals[0]!.aborted, true);
  mock.gates[0]!();
  await pending;
  assert.equal(mock.resolutions.length, 1);
  assert.equal(await controller.drop(firstCandidate(controller.snapshot)), false);
});

test('same seed and same input sequence replay identically through the controller', async () => {
  const mock = immediateView();
  const controller = new BattleController(defaultConfig, mock.view);
  const commands: string[] = [];
  for (let i = 0; i < 6 && !controller.snapshot.result; i += 1) {
    const candidate = firstCandidate(controller.snapshot);
    commands.push(candidate);
    await controller.drop(candidate);
  }
  const original = controller.snapshot;
  await controller.restart();
  for (const command of commands) await controller.drop(command);
  assert.deepEqual(controller.snapshot, original);
});

test('blocked player keeps a usable board skill choice instead of automatic skip', async () => {
  const mock = immediateView();
  const config: BattleConfig = { ...fixture('blocked-player'), characterId: 'blue' };
  const controller = new BattleController(config, mock.view);
  await controller.start();
  assert.equal(mock.resolutions.length, 0);
  assert.equal(controller.snapshot.actor, 'player');
  assert.equal(controller.snapshot.turn, 1);
  assert.equal(await controller.drop('ceiling:0:0'), false);
  assert.equal(await controller.boardSkill('pain-shared', 0), true);
  assert.equal(mock.resolutions.length, 2);
  assert.equal(mock.resolutions[0]!.events[0]!.type, 'board-skill');
  assert.equal(mock.resolutions[0]!.events.some(event => event.type === 'drop'), false);
  assert.equal(mock.resolutions[1]!.actor, 'enemy');
  assert.equal(controller.snapshot.boxes.length, 1);
  assert.equal(controller.snapshot.actor, 'player');
  assert.equal(controller.snapshot.turn, 3);
});

test('board skill spends one action, blocks simultaneous drop or skill, and is reusable next turn', async () => {
  const mock = deferredView();
  const controller = new BattleController({ ...defaultConfig, characterId: 'red' }, mock.view);
  const first = controller.boardSkill('ember');
  assert.equal(controller.snapshot.hp.player.current, 27);
  assert.equal(controller.snapshot.boxes.length, 0, 'Skill must not add a player drop');
  assert.equal(controller.snapshot.actor, 'enemy');
  assert.equal(await controller.boardSkill('ember'), false);
  assert.equal(await controller.drop(firstCandidate(controller.snapshot)), false);
  mock.gates[0]!();
  await flush();
  assert.equal(controller.snapshot.boxes.length, 1);
  assert.equal(await controller.boardSkill('ember'), false);
  mock.gates[1]!();
  await first;
  assert.equal(controller.snapshot.actor, 'player');
  const second = controller.boardSkill('ember');
  assert.equal(controller.snapshot.hp.player.current, 24);
  assert.equal(controller.snapshot.boxes.filter(box => box.owner === 'player').length, 1);
  mock.gates[2]!();
  await flush();
  mock.gates[3]!();
  await second;
  assert.equal(controller.snapshot.boxes.length, 2);
  assert.equal(controller.snapshot.turn, 5);
  assert.equal(mock.resolutions.filter(resolution => resolution.actor === 'player').length, 2);
});

test('invalid board skill targeting and missing skill leave the same state without spending a turn', async () => {
  const mock = immediateView();
  const controller = new BattleController({ ...defaultConfig, characterId: 'blue' }, mock.view);
  const original = controller.snapshot;
  assert.equal(await controller.boardSkill('ember'), false);
  assert.equal(await controller.boardSkill('pain-shared'), false);
  assert.equal(await controller.boardSkill('pain-shared', -1), false);
  assert.equal(await controller.boardSkill('pain-shared', 100), false);
  assert.equal(controller.snapshot, original);
  assert.equal(mock.resolutions.length, 0);
  assert.equal(controller.isResolving, false);
  assert.equal(await controller.boardSkill('pain-shared', 0), true, 'A valid empty row still consumes the player action');
  assert.equal(controller.snapshot.hp.player.current, 30);
  assert.equal(controller.snapshot.boxes.length, 1);
  assert.equal(controller.snapshot.turn, 3);
});

test('restart during skill animation cannot replay damage, conversion, or an old enemy turn', async () => {
  const mock = deferredView();
  const config: BattleConfig = { ...defaultConfig, characterId: 'red' };
  const controller = new BattleController(config, mock.view);
  const pending = controller.boardSkill('ember');
  await controller.restart();
  const fresh = controller.snapshot;
  mock.gates[0]!();
  await pending;
  assert.equal(mock.signals[0]!.aborted, true);
  assert.equal(controller.snapshot, fresh);
  assert.deepEqual(fresh, createBattle(config));
  assert.equal(mock.resolutions.length, 1);
});

test('a reentrant renderer restart cannot apply a stale action to the new battle', async () => {
  let restart = true;
  let animations = 0;
  let controller: BattleController;
  controller = new BattleController(defaultConfig, {
    render(_state, resolving) {
      if (resolving && restart) {
        restart = false;
        void controller.restart({ ...defaultConfig, seed: 101 });
      }
    },
    async animate() { animations += 1; },
  });
  assert.equal(await controller.drop(firstCandidate(controller.snapshot)), false);
  assert.equal(controller.snapshot.config.seed, 101);
  assert.equal(controller.snapshot.boxes.length, 0);
  assert.equal(controller.isResolving, false);
  assert.equal(animations, 0);
});

test('a newer restart issued by an abort listener wins over the restart that canceled it', async () => {
  let release!: () => void;
  let controller: BattleController;
  controller = new BattleController(defaultConfig, {
    render() {},
    async animate(_resolution, _before, _after, signal) {
      signal.addEventListener('abort', () => {
        void controller.restart({ ...defaultConfig, seed: 303 });
      }, { once: true });
      await new Promise<void>(resolve => { release = resolve; });
    },
  });
  const pending = controller.drop(firstCandidate(controller.snapshot));
  await controller.restart({ ...defaultConfig, seed: 202 });
  assert.equal(controller.snapshot.config.seed, 303);
  assert.equal(controller.snapshot.boxes.length, 0);
  release();
  await pending;
  assert.equal(controller.snapshot.config.seed, 303);
  assert.equal(controller.isResolving, false);
});

test('an abort listener may destroy the controller without an outer restart reviving it', async () => {
  let release!: () => void;
  let controller: BattleController;
  controller = new BattleController(defaultConfig, {
    render() {},
    async animate(_resolution, _before, _after, signal) {
      signal.addEventListener('abort', () => controller.destroy(), { once: true });
      await new Promise<void>(resolve => { release = resolve; });
    },
  });
  const pending = controller.drop(firstCandidate(controller.snapshot));
  const committed = controller.snapshot;
  await controller.restart({ ...defaultConfig, seed: 202 });
  assert.equal(controller.snapshot, committed);
  release();
  await pending;
  assert.equal(await controller.drop(firstCandidate(controller.snapshot)), false);
  assert.equal(await controller.boardSkill('ember'), false);
});
