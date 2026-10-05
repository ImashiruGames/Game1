// 日本語: 消える箱はVanish状態で残り、計算が終わってからゆっくり消える。盤面スキルは演出のあとに効果が出る。
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, createBattle, defaultConfig } from '../src/next/core/index.ts';
import { createTrialConfig } from '../src/next/config.ts';
import { createBattleAnimator, VANISH_MS } from '../src/next/ui/battleAnimator.ts';
import type { BattleAnimationHooks } from '../src/next/ui/battleAnimator.ts';
import { boxesFor } from '../src/next/tutorial/scenes.ts';

test('行消去：Vanish状態で残り、全計算の後にゆっくり消えてから落下後の盤面になる', async () => {
  const config = { ...createTrialConfig('blue', 'tutorial-star', { ...defaultConfig, seed: 1 }, 'manual'), initialBoxes: boxesFor(['A1', 'B1', 'A2'], ['C1', 'C2']) };
  const before = createBattle(config);
  const result = applyAction(before, { type: 'board-skill', skillId: 'pain-shared', row: 7 });
  assert.ok(result.accepted && result.resolution);
  const log: string[] = [];
  let shownIds: string[] = [];
  const hooks: BattleAnimationHooks = {
    motion: () => ({ short: false, lowMotion: false }), playSound() {}, describe() {}, observe() {}, highlight() {}, drop() {}, react() {},
    feedback: () => ({ remove() {} }), transform: async () => {}, complete() { log.push('complete'); },
    render(state) { shownIds = state.boxes.map(b => b.id); log.push(`render:${state.boxes.length}`); },
    vanish(ids, phase, ms) { log.push(`vanish:${phase}:${ids.length}:${ms}`); },
    pause: async () => {},
  };
  await createBattleAnimator(hooks)(result.resolution, before, result.state, new AbortController().signal);
  const fading = log.findIndex(line => line.startsWith('vanish:fading'));
  assert.ok(log.some(line => line === 'vanish:marked:3:0'), '消える3箱をVanish状態にする');
  assert.equal(log[fading], `vanish:fading:3:${VANISH_MS.full}`);
  // 消す前の描画では5個とも残っている（落下前の盤面）
  assert.ok(log.slice(0, fading).filter(line => line.startsWith('render:')).every(line => line === 'render:5'));
  // 消えたあとに、落下後の盤面（残り2箱）を最後に描く
  assert.equal(log.at(-1), `render:${result.state.boxes.length}`);
  assert.equal(log.at(-2), 'complete');
  assert.equal(log.at(-3), 'vanish:marked:0:0'); // 解除してから最終盤面
  assert.equal(shownIds.length, result.state.boxes.length);
});
