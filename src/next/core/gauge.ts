import { defaultTuning, tuningOf } from './tuning.ts';
import type { GameTuning } from './tuning.ts';
import type { BattleState, BattleTransition, CharacterId } from './types.ts';

export function gaugeDefinition(character?: CharacterId, tuning: GameTuning = defaultTuning): Readonly<{ cost: number; cap: number }> | null {
  return character ? tuning.gauge.limits[character] : null;
}
/** 日本語: 加算元と上限を独立させる。上限付近でも倍率を減らさない。
 * English: Every source uses one flat capped accumulator; no near-cap gain reduction. */
export function gainGauge(state: BattleState, amount: number, source: 'link' | 'damage' | 'turn'): BattleTransition {
  const rules = gaugeDefinition(state.config.characterId, tuningOf(state.config));
  if (!rules || amount <= 0) return { state, events: [] };
  const after = Math.min(rules.cap, state.gauge + amount);
  if (after === state.gauge) return { state, events: [] };
  return { state: { ...state, gauge: after }, events: [{ type: 'gauge', before: state.gauge, after, amount: after - state.gauge, source }] };
}

/** 日本語: 6以上は固定値。複数軸はそれぞれ1回、受動落下は呼ばない。
 * English: Six-plus is one fixed amount per qualifying axis, never passive settling. */
export function linkGaugeGain(state: BattleState, count: number): number {
  const tuning = tuningOf(state.config);
  if (count < 3) return 0;
  if (state.config.strategy?.gauge !== 'bands') return count * tuning.gauge.linkPerBox;
  const bands = tuning.gauge.bands!;
  return bands[count >= 6 ? 'sixPlus' : count as 3 | 4 | 5];
}
