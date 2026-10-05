import { defaultTuning, tuningOf } from '../core/tuning.ts';
import type { GameTuning } from '../core/tuning.ts';
import { freeze } from '../core/immutable.ts';
import { acquireSkill, canReceiveSkillReward } from '../core/playerBuild.ts';
import { normalSkillIds, legacyNormalSkillIds, skillCatalog, skillDescription, skillName } from '../core/skillCatalog.ts';
import { sampleUniformIndex } from '../core/random.ts';
import type { NormalSkillId, PlayerBuild, BattleState } from '../core/types.ts';
export type StatRewardId = 'max-health' | 'three-polish' | 'four-polish' | 'five-polish';
export type RewardCategory = 'heal' | 'stats' | 'skills';
export type RewardId = NormalSkillId | StatRewardId | 'large-polish' | 'immediate-heal';
export interface RewardOffer { readonly id: string; readonly choices: readonly RewardId[]; readonly category?: RewardCategory | 'pending' }
export function rewardSeed(seed: number): number { return (seed ^ 0x51ed_270b) >>> 0; }
export function rewardPool(build: PlayerBuild, unlockedPool: readonly NormalSkillId[] = []): readonly RewardId[] {
  return ['three-polish', 'large-polish', ...normalSkillIds.filter(id => canReceiveSkillReward(build, id) && (skillCatalog[id].rewardAccess !== 'trophy' || unlockedPool.includes(id)))];
}
/** 日本語: 候補不足ならある分だけ。空候補では乱数も使わず、重複候補も除く。
 * English: Short pools yield only their distinct members; an empty pool consumes no RNG. */
export function drawRewardChoices(candidates: readonly RewardId[], seed: number, count: number): { choices: readonly RewardId[]; rngState: number } {
  const pool = [...new Set(candidates)], choices: RewardId[] = []; let rngState = seed;
  for (let n = 0; n < count && pool.length; n++) {
    const random = sampleUniformIndex(rngState, pool.length); rngState = random.rngState;
    choices.push(pool.splice(random.index, 1)[0]!);
  }
  return freeze({ choices, rngState });
}
/** Reward draws use a dedicated stream and commit once; UI renders cannot reroll an offer. */
export function generateRewardOffer(build: PlayerBuild, seed: number, id: string, tuning: GameTuning = defaultTuning): { offer: RewardOffer; rngState: number } {
  const { choices, rngState } = drawRewardChoices(rewardPool(build).filter(id=>!isSkillReward(id)||legacyNormalSkillIds.includes(id)), seed, tuning.rewards.choices);
  return freeze({ offer: { id, choices }, rngState });
}
export function applyReward(build: PlayerBuild, id: RewardId, replacement?: number, tuning: GameTuning = defaultTuning): PlayerBuild | null {
  if (id === 'max-health' || id === 'immediate-heal') return null;
  if (isSkillReward(id)) return acquireSkill(build, id, replacement);
  const power = { ...build.power, 3: build.power[3] + (id === 'three-polish' ? tuning.rewards.threePower : 0), 4: build.power[4] + (id === 'large-polish' ? tuning.rewards.largeFourPower : id === 'four-polish' ? tuning.rewards.fourPower : 0), 5: build.power[5] + (id === 'large-polish' ? tuning.rewards.largeFivePower : id === 'five-polish' ? tuning.rewards.fivePower : 0) };
  if (Object.values(power).some(value => !Number.isSafeInteger(value))) return null;
  return freeze({ ...build, power });
}
export function rewardLabel(build: PlayerBuild, id: RewardId, tuning: GameTuning = defaultTuning): { title: string; description: string; upgrade: boolean } {
  if (id === 'immediate-heal') return { title: `今すぐHP＋${tuning.rewards.immediateHeal}`, description: '最大HPまで回復して次の戦闘へ', upgrade: false };
  if (id === 'max-health') return { title: `最大HP＋${tuning.rewards.maxHp}`, description: `現在HPも＋${tuning.rewards.maxHp}・このラン中`, upgrade: false };
  if (id === 'four-polish') return { title: `4リンク火力＋${tuning.rewards.fourPower}`, description: 'このラン中・枠を使わない', upgrade: false };
  if (id === 'five-polish') return { title: `5以上リンク火力＋${tuning.rewards.fivePower}`, description: 'このラン中・枠を使わない', upgrade: false };
  if (id === 'three-polish') return { title: '三連研磨', description: `3リンクの基礎火力＋${tuning.rewards.threePower}・このラン中`, upgrade: false };
  if (id === 'large-polish') return { title: '大連研磨', description: `4リンク＋${tuning.rewards.largeFourPower}・5以上＋${tuning.rewards.largeFivePower}・このラン中`, upgrade: false };
  const owned = [build.fixed, ...build.slots].find(skill => skill?.id === id);
  const upgrade = !!owned && skillCatalog[id].upgradeable !== false;
  const rank = upgrade ? 2 : 1;
  return { title: skillName(id, rank), description: skillDescription(id, rank, tuning), upgrade };
}
export function requiresReplacement(build: PlayerBuild, id: RewardId): boolean {
  return isSkillReward(id) && build.slots.every(Boolean) && ![build.fixed, ...build.slots].some(skill => skill?.id === id);
}

export function isSkillReward(id: RewardId): id is NormalSkillId { return (normalSkillIds as readonly string[]).includes(id); }
export function categoryOffer(id: string): RewardOffer { return freeze({ id, category: 'pending', choices: [] }); }
/** 日本語: カテゴリ確定時に一度だけ抽選。置換取消や描画では呼ばない。
 * English: Draw exactly once when committing a category; replacement cancellation never draws. */
export function generateCategoryOffer(build: PlayerBuild, seed: number, id: string, category: RewardCategory, tuning: GameTuning = defaultTuning, selectedPool?:readonly NormalSkillId[]): { offer: RewardOffer; rngState: number } {
  if (category === 'heal') return freeze({ offer: { id, category, choices: ['immediate-heal'] }, rngState: seed });
  const pool: RewardId[] = category === 'stats' ? ['max-health', 'three-polish', 'four-polish', 'five-polish'] : rewardPool(build,selectedPool).filter(isSkillReward).filter(skill=>(selectedPool??legacyNormalSkillIds).includes(skill));
  const { choices, rngState } = drawRewardChoices(pool, seed, tuning.rewards.choices);
  return freeze({ offer: { id, category, choices }, rngState });
}
/** 日本語: 撃破後報酬は戦闘外。青反射・ゲージ・ターンを発生させない。
 * English: Run rewards change persistent HP/build only, with no combat reactions or action clock. */
export function applyRunReward(state: BattleState, id: RewardId, replacement?: number): BattleState | null {
  if (isSkillReward(id) && skillCatalog[id].rewardAccess === 'trophy' && !state.config.meta?.pool.includes(id)) return null;
  if (!state.build || state.result?.winner !== 'player' || state.hp.player.current <= 0) return null;
  const rules = tuningOf(state.config).rewards;
  if (id === 'max-health') {
    const max = state.hp.player.max + rules.maxHp, current = state.hp.player.current + rules.maxHp;
    if (!Number.isSafeInteger(max) || !Number.isSafeInteger(current)) return null;
    return freeze({ ...state, hp: { ...state.hp, player: { max, current } } });
  }
  if (id === 'immediate-heal') return freeze({ ...state, hp: { ...state.hp, player: { ...state.hp.player, current: Math.min(state.hp.player.max, state.hp.player.current + rules.immediateHeal) } } });
  const build = applyReward(state.build, id, replacement, tuningOf(state.config));
  return build ? freeze({ ...state, build }) : null;
}
