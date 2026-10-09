import {starterFor} from '../meta/kits.ts';
import { tuningOf } from './tuning.ts';
import { freeze } from './immutable.ts';
import { skillCatalog, skillValue, normalSkillIds } from './skillCatalog.ts';
import { getPlayerSkills } from './skills.ts';
import type { BattleConfig, BattleState, CharacterId, NormalSkillId, PlayerBuild, SkillInstance } from './types.ts';

export function createSkill(id: NormalSkillId, rank: 1 | 2 = 1): SkillInstance { if (rank === 2 && skillCatalog[id].upgradeable === false) throw new Error('This skill cannot be upgraded'); return freeze({ id, rank, uses: skillCatalog[id].kind === 'instant' ? 1 : null }); }
export function createPlayerBuild(character: CharacterId): PlayerBuild { return freeze({ fixed: createSkill(character === 'blue' ? 'health' : 'grow-fire'), slots: [null, null], power: { 3: 0, 4: 0, 5: 0 } }); }
export function buildSkills(state: BattleState): readonly SkillInstance[] {
  if (state.build) return [state.build.fixed, ...state.build.slots.filter((s): s is SkillInstance => s !== null)];
  const legacy = getPlayerSkills(state.config);
  return [...legacy.shapeSkills, ...legacy.linkSkills].map(id => createSkill(id));
}
export function skillRank(state: BattleState, id: NormalSkillId): 0 | 1 | 2 { return buildSkills(state).find(skill => skill.id === id)?.rank ?? 0; }
export function activeSkillValue(state: BattleState, id: NormalSkillId): number { const rank = skillRank(state, id); return rank ? skillValue(id, rank, tuningOf(state.config)) : 0; }
export function basePlayerPower(state: BattleState, tier: 3 | 4 | 5): number { return state.config.combatants.player.attacks[tier] + (state.build?.power[tier] ?? 0); }
export function playerPower(state: BattleState, tier: 3 | 4 | 5): number { return basePlayerPower(state, tier) + (tier === 3 ? state.link3Growth : 0); }
/** 日本語: 固有通常スキルは初期固定枠の所持者だけ強化できる。自由枠への混入は資格にならない。
 * English: Intrinsic rewards only upgrade the immutable starter; an injected flexible-slot copy grants no eligibility. */
export function canReceiveSkillReward(build: PlayerBuild, id: NormalSkillId): boolean {
  const definition = skillCatalog[id];
  if (!normalSkillIds.includes(id)||definition.rewardAccess==='never') return false;
  const owned = [build.fixed, ...build.slots].find(skill => skill?.id === id);
  if (owned && (owned.rank === 2 || definition.upgradeable === false)) return false;
  return definition.rewardAccess !== 'starter-upgrade-only' || build.fixed.id === id;
}
export function acquireSkill(build: PlayerBuild, id: NormalSkillId, replacement?: number): PlayerBuild | null {
  if (!canReceiveSkillReward(build, id)) return null;
  const all = [build.fixed, ...build.slots]; const owned = all.findIndex(skill => skill?.id === id);
  if (owned >= 0) {
    const old = all[owned]!;
    if (old.rank === 2 || skillCatalog[id].upgradeable === false) return null;
    const upgraded = createSkill(id, 2);
    if (owned === 0) return freeze({ ...build, fixed: upgraded });
    const slots = [...build.slots] as [SkillInstance | null, SkillInstance | null, ...(SkillInstance | null)[]]; slots[owned - 1] = upgraded;
    return freeze({ ...build, slots });
  }
  const empty = build.slots.indexOf(null); const slot = empty >= 0 ? empty : replacement;
  if (!Number.isSafeInteger(slot) || slot === undefined || slot < 0 || slot >= build.slots.length) return null;
  const slots = [...build.slots] as [SkillInstance | null, SkillInstance | null, ...(SkillInstance | null)[]]; slots[slot] = createSkill(id);
  return freeze({ ...build, slots });
}
export function useBuildSlot(build: PlayerBuild, slot: number): PlayerBuild | null {
  if (!Number.isSafeInteger(slot) || slot === undefined || slot < 0 || slot >= build.slots.length) return null;
  const skill = build.slots[slot]; if (!skill || skill.uses === null || skill.uses < 1) return null;
  const slots = [...build.slots] as [SkillInstance | null, SkillInstance | null, ...(SkillInstance | null)[]];
  slots[slot] = skill.uses === 1 ? null : { ...skill, uses: skill.uses - 1 };
  return freeze({ ...build, slots });
}
export function instantSlots(state: BattleState): readonly number[] {
  if (!state.build || state.result || state.actor !== 'player') return [];
  return state.build.slots.flatMap((skill, slot) => skill && skillCatalog[skill.id].kind === 'instant' && skill.uses ? [slot] : []);
}
export function validatePlayerBuild(build: PlayerBuild, config: BattleConfig): void {
  const expected = starterFor(config);
  if (!config.characterId || build.fixed.id !== expected || build.slots.length !== (config.meta?.slots ?? 2)) throw new Error('Invalid fixed starter or flexible slots');
  const skills = [build.fixed, ...build.slots.filter((s): s is SkillInstance => s !== null)];
  if (new Set(skills.map(s => s.id)).size !== skills.length) throw new Error('Duplicate equipped skill identities');
  for (const skill of skills) if ((skill.id === 'health' && expected !== 'health')||(['combo-unit','death-arrow'].includes(skill.id)&&skill.id!==expected)||(skill.id==='poison-craft'&&(expected!=='poison-craft'||skill.rank!==1)) || (skillCatalog[skill.id]?.upgradeable === false && skill.rank !== 1) || !normalSkillIds.includes(skill.id) || ![1, 2].includes(skill.rank) || skill.uses !== (skillCatalog[skill.id].kind === 'instant' ? 1 : null)) throw new Error('Invalid skill instance');
  for (const tier of [3, 4, 5] as const) if (!Number.isSafeInteger(build.power[tier]) || build.power[tier] < 0) throw new Error('Invalid permanent power');
}
