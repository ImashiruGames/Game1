import { defaultExperimentTuning } from '../tuning.ts';
import type { ProposalId } from '../model.ts';
import { tuningOf } from './tuning.ts';
import { damageHp, healHp } from './combatEffects.ts';
import { gainGauge } from './gauge.ts';
import type { Actor, BattleEvent, BattleState, BattleTransition, BoardSkillId, ShapeSkillId, InstantSkillId, HealEvent } from './types.ts';

export type DamageSource = ProposalId | BoardSkillId | ShapeSkillId | InstantSkillId | 'blue-transformation';
/** 日本語: HP変化を共通経路に集め、被ダメージ充填と回復への反応を取りこぼさない。
 * English: Shared HP transitions dispatch resource gains and healing reactions exactly once. */
export function applyDamageEffect(state: BattleState, target: Actor, amount: number, source: DamageSource, shapeBoxIds?: readonly string[]): BattleTransition {
  const change = damageHp(state.hp[target], amount);
  const changed = { ...state, hp: { ...state.hp, [target]: change.hp } };
  const charge = target === 'player' ? gainGauge(changed, change.actual * tuningOf(state.config).gauge.damagePerHp, 'damage') : { state: changed, events: [] };
  return { state: charge.state, events: [{ type: 'damage', actor: 'player', target, source, damage: amount, hpBefore: change.before, hpAfter: change.after, ...(shapeBoxIds ? { shapeBoxIds } : {}) }, ...charge.events] };
}
export function applyHealingEffect(initial: BattleState, actor: Actor, requestedAmount: number, source: HealEvent['source'], shapeBoxIds?: readonly string[]): BattleTransition {
  const t=initial.config.experimentTuning??defaultExperimentTuning;
  const mutual=initial.config.experiment==='A051'&&actor==='player'&&initial.hp.player.current>0&&initial.hp.enemy.current>0;
  const events:BattleEvent[]=[];
  if(mutual){requestedAmount+=t.mutualHealBonus;events.push({type:'experiment',skill:'A051',phase:'before-heal',eligible:true,triggered:true,detail:'自分の予定回復量を増加 / 青連動後に双方生存なら敵も回復',amount:t.mutualHealBonus});}
  const change=healHp(initial.hp[actor],requestedAmount);
  let state:BattleState={...initial,hp:{...initial.hp,[actor]:change.hp}};
  events.push({type:'heal',actor,target:actor,source,amount:change.actual,requestedAmount,hpBefore:change.before,hpAfter:change.after,...(shapeBoxIds?{shapeBoxIds}:{})});
  // 日本語: 青の連動を1回解決してから相互回復。敵KOを復活させない。
  // English: Resolve Blue's reaction once before mutual healing; never resurrect a defeated enemy.
  if(actor==='player'&&initial.transformation?.character==='blue'&&state.hp.player.current>0){const reaction=applyDamageEffect(state,'enemy',requestedAmount,'blue-transformation',shapeBoxIds);state=reaction.state;events.push(...reaction.events);}
  if(mutual&&state.hp.player.current>0&&state.hp.enemy.current>0){const enemyHeal=applyHealingEffect(state,'enemy',t.mutualEnemyHeal,'A051');state=enemyHeal.state;events.push(...enemyHeal.events);}
  if(initial.config.experiment==='D030'&&actor==='enemy'&&state.hp.player.current>0){
    const amount=Math.floor(change.actual/t.healRebuttalDivisor);
    events.push({type:'experiment',skill:'D030',phase:'after-enemy-heal',eligible:true,triggered:amount>0,detail:`敵の実回復${change.actual} / 半分切捨て`,amount});
    if(amount>0){const reaction=applyDamageEffect(state,'enemy',amount,'D030');state=reaction.state;events.push(...reaction.events);}
  }
  return {state,events};
}
