import { tuningOf } from './tuning.ts';
import { gainGauge, gaugeDefinition } from './gauge.ts';
import { activeSkillValue } from './playerBuild.ts';
import { freeze } from './immutable.ts';
import type { BattleState, BattleTransition, Link } from './types.ts';

/** 日本語: 変化判定は能動投入の全技能・全攻撃の後で1回だけ行う。
 * English: One transformation gate follows all skills and attacks of this active insertion. */
export function tryTransformation(state: BattleState, links: readonly Link[]): BattleTransition {
  const character = state.config.characterId;
  const rules = gaugeDefinition(character, tuningOf(state.config));
  if (state.actor !== 'player' || !character || !rules || state.transformation
    || state.hp.player.current <= 0 || state.hp.enemy.current <= 0 || state.gauge < rules.cost || !links.some(link => link.count >= tuningOf(state.config).transformation.minimumLink)) return { state, events: [] };
  const transformation = character === 'blue' ? { character, scope: 'stage' } as const : { character, scope: 'run', remainingStarts: tuningOf(state.config).transformation.redBonusStarts } as const;
  const after = state.gauge - rules.cost;
  return { state: { ...state, transformation, gauge: after }, events: [{ type: 'transformation', character, cost: rules.cost, before: state.gauge, after }] };
}
export function completePlayerTurn(state: BattleState): BattleTransition {
  const expires = state.transformation?.character === 'red' && state.transformation.remainingStarts === 0;
  const charge = gainGauge(expires ? { ...state, transformation: null } : state, tuningOf(state.config).gauge.turnGain + activeSkillValue(state, 'charge'), 'turn');
  return { state: charge.state, events: [...(expires ? [{ type: 'transformation-ended', character: 'red' } as const] : []), ...charge.events] };
}
/** Run carry is independent of stage-local effects. It never rescans inherited boxes. */
export function carryTransformationState(next: BattleState, previous: BattleState): BattleState {
  return freeze({ ...next, build: previous.build, gauge: previous.gauge, transformation: previous.transformation?.character === 'red' && previous.transformation.remainingStarts > 0 ? previous.transformation : null,
    playerTurnStarted: false });
}
