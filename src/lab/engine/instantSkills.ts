import { tuningOf } from './tuning.ts';
import { applyDamageEffect, applyHealingEffect } from './effectDispatcher.ts';
import { basePlayerPower, useBuildSlot } from './playerBuild.ts';
import { skillValue } from './skillCatalog.ts';
import type { BattleState, BattleTransition, InstantSkillId } from './types.ts';
/** Consuming an item is one ordinary player action; its slot opens atomically. */
export function resolveInstantSkill(state: BattleState, slot: number): BattleTransition {
  const skill = state.build!.slots[slot]!; const build = useBuildSlot(state.build!, slot)!;
  const id = skill.id as InstantSkillId; const value = skillValue(id, skill.rank, tuningOf(state.config));
  const consumed = { ...state, build };
  const result = id === 'healing-potion' ? applyHealingEffect(consumed, 'player', value, 'healing-potion')
    : applyDamageEffect(consumed, 'enemy', basePlayerPower(state, 4) * value, 'magic-bullet');
  return { state: result.state, events: [{ type: 'instant-skill', skillId: id, rank: skill.rank }, ...result.events] };
}
