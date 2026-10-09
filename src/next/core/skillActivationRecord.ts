import type {BattleEvent,NormalSkillId} from './types.ts';
/** Ephemeral presentation metadata: no mutation of event/state, no checkpoint field or RNG. */
const activations=new WeakMap<BattleEvent,readonly NormalSkillId[]>();
export function recordSkillActivation<T extends BattleEvent>(event:T,ids:readonly NormalSkillId[]):T {
 if(ids.length)activations.set(event,Object.freeze([...new Set(ids)]));
 return event;
}
export function recordedSkillActivations(event:BattleEvent):readonly NormalSkillId[]{return activations.get(event)??[];}
