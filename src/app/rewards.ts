import { defaultTuning } from '../core/tuning.ts';
import type { GameTuning } from '../core/tuning.ts';
import { freeze } from '../core/immutable.ts';
import { acquireSkill } from '../core/playerBuild.ts';
import { normalSkillIds, skillDescription, skillName } from '../core/skillCatalog.ts';
import { sampleUniformIndex } from '../core/random.ts';
import type { NormalSkillId, PlayerBuild } from '../core/types.ts';
export type RewardId = NormalSkillId | 'three-polish' | 'large-polish';
export interface RewardOffer { readonly id: string; readonly choices: readonly RewardId[] }
export function rewardSeed(seed: number): number { return (seed ^ 0x51ed_270b) >>> 0; }
export function rewardPool(build: PlayerBuild): readonly RewardId[] {
  const maxed = new Set([build.fixed, ...build.slots].filter(s => s?.rank === 2).map(s => s!.id));
  return ['three-polish', 'large-polish', ...normalSkillIds.filter(id => !maxed.has(id))];
}
/** Reward draws use a dedicated stream and commit once; UI renders cannot reroll an offer. */
export function generateRewardOffer(build: PlayerBuild, seed: number, id: string, tuning: GameTuning = defaultTuning): { offer: RewardOffer; rngState: number } {
  const pool = [...rewardPool(build)]; const choices: RewardId[] = []; let rngState = seed;
  for (let n = 0; n < tuning.rewards.choices && pool.length; n += 1) {
    const random = sampleUniformIndex(rngState, pool.length); rngState = random.rngState;
    choices.push(pool.splice(random.index, 1)[0]!);
  }
  return freeze({ offer: { id, choices }, rngState });
}
export function applyReward(build: PlayerBuild, id: RewardId, replacement?: number, tuning: GameTuning = defaultTuning): PlayerBuild | null {
  if (id !== 'three-polish' && id !== 'large-polish') return acquireSkill(build, id, replacement);
  const power = { ...build.power, 3: build.power[3] + (id === 'three-polish' ? tuning.rewards.threePower : 0), 4: build.power[4] + (id === 'large-polish' ? tuning.rewards.largeFourPower : 0), 5: build.power[5] + (id === 'large-polish' ? tuning.rewards.largeFivePower : 0) };
  if (Object.values(power).some(value => !Number.isSafeInteger(value))) return null;
  return freeze({ ...build, power });
}
export function rewardLabel(build: PlayerBuild, id: RewardId, tuning: GameTuning = defaultTuning): { title: string; description: string; upgrade: boolean } {
  if (id === 'three-polish') return { title: '三連研磨', description: `3リンクの基礎火力＋${tuning.rewards.threePower}・このラン中`, upgrade: false };
  if (id === 'large-polish') return { title: '大連研磨', description: `4リンク＋${tuning.rewards.largeFourPower}・5以上＋${tuning.rewards.largeFivePower}・このラン中`, upgrade: false };
  const owned = [build.fixed, ...build.slots].find(skill => skill?.id === id);
  const rank = owned ? 2 : 1;
  return { title: skillName(id, rank), description: skillDescription(id, rank, tuning), upgrade: !!owned };
}
export function requiresReplacement(build: PlayerBuild, id: RewardId): boolean {
  return id !== 'three-polish' && id !== 'large-polish' && build.slots.every(Boolean) && ![build.fixed, ...build.slots].some(skill => skill?.id === id);
}
