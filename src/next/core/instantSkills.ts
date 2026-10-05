import {assignBoxType} from './boxTypes.ts';
import {gainGauge} from './gauge.ts';
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
  let result:BattleTransition;
  if(id==='capacitor')result=gainGauge(consumed,value,'turn');
  else if(id==='solvent'){
    const ids=new Set(consumed.boxes.filter(b=>b.owner==='player'&&['poison','deadly-poison','frozen'].includes(b.type)).sort((a,b)=>a.row-b.row||a.col-b.col).slice(0,value).map(b=>b.id));
    result={state:{...consumed,boxes:consumed.boxes.map(b=>ids.has(b.id)?assignBoxType(b,'normal'):b)},events:[]};
  }
  else result = id === 'healing-potion' ? applyHealingEffect(consumed, 'player', value, 'healing-potion')
    : applyDamageEffect(consumed, 'enemy', basePlayerPower(state, 4) * value, 'magic-bullet');
  return { state: result.state, events: [{ type: 'instant-skill', skillId: id, rank: skill.rank }, ...result.events] };
}
