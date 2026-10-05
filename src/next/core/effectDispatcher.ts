import { tuningOf } from './tuning.ts';
import { damageHp, healHp } from './combatEffects.ts';
import { gainGauge } from './gauge.ts';
import type { Actor, BattleEvent, BattleState, BattleTransition, BoardSkillId, ShapeSkillId, InstantSkillId, HealEvent } from './types.ts';

export type DamageSource = BoardSkillId | ShapeSkillId | InstantSkillId | 'blue-transformation';
/** 日本語: HP変化を共通経路に集め、被ダメージ充填と回復への反応を取りこぼさない。
 * English: Shared HP transitions dispatch resource gains and healing reactions exactly once. */
export function applyDamageEffect(state: BattleState, target: Actor, amount: number, source: DamageSource, shapeBoxIds?: readonly string[]): BattleTransition {
  const change = damageHp(state.hp[target], amount);
  const changed = { ...state, hp: { ...state.hp, [target]: change.hp } };
  const charge = target === 'player' ? gainGauge(changed, change.actual * tuningOf(state.config).gauge.damagePerHp, 'damage') : { state: changed, events: [] };
  return { state: charge.state, events: [{ type: 'damage', actor: 'player', target, source, damage: amount, hpBefore: change.before, hpAfter: change.after, ...(shapeBoxIds ? { shapeBoxIds } : {}) }, ...charge.events] };
}
export function applyHealingEffect(state: BattleState, actor: Actor, requestedAmount: number, source: HealEvent['source'], shapeBoxIds?: readonly string[]): BattleTransition {
  const change = healHp(state.hp[actor], requestedAmount);
  const changed = { ...state, hp: { ...state.hp, [actor]: change.hp } };
  const event: BattleEvent = { type: 'heal', actor, target: actor, source, amount: change.actual, requestedAmount,
    hpBefore: change.before, hpAfter: change.after, ...(shapeBoxIds ? { shapeBoxIds } : {}) };
  // 日本語: 青の変化は回復予定量を攻撃に追加。実回復0でも予定15なら15ダメージ。
  // English: Active Blue reacts to nominal healing, even when maximum HP makes actual recovery zero.
  if (actor === 'player' && state.transformation?.character === 'blue' && state.hp.player.current > 0) {
    const reaction = applyDamageEffect(changed, 'enemy', requestedAmount, 'blue-transformation', shapeBoxIds);
    return { state: reaction.state, events: [event, ...reaction.events] };
  }
  return { state: changed, events: [event] };
}
