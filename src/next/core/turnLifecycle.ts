import { resolveActiveDrop } from './activeDrop.ts';
import { getDropOptions } from './board.ts';
import { sampleUniformIndex } from './random.ts';
import type { BattleState, BattleTransition, Link } from './types.ts';

export function needsTurnStart(state: BattleState): boolean {
  return !state.result && state.actor === 'player' && !state.playerTurnStarted
    && state.transformation?.character === 'red' && state.transformation.remainingStarts > 0;
}
/** 日本語: 追加投入は独立した解決。通常行動や敵手番を再帰的に実行しない。
 * English: Each start hook is a distinct resolution, never a recursive ordinary action. */
export function resolveTurnStart(state: BattleState): BattleTransition & { readonly originBoxId: string | null; readonly links: readonly Link[] } {
  if (!needsTurnStart(state) || state.transformation?.character !== 'red') throw new Error('No pending turn-start effect');
  const remainingStarts = state.transformation.remainingStarts - 1;
  const begun = { ...state, playerTurnStarted: true, transformation: { ...state.transformation, remainingStarts } };
  const legal = getDropOptions(begun).filter(option => option.available);
  const event = { type: 'turn-start', remainingStarts, skipped: legal.length === 0 } as const;
  if (!legal.length) return { state: begun, events: [event], originBoxId: null, links: [] };
  const random = sampleUniformIndex(state.rngState, legal.length);
  const drop = resolveActiveDrop({ ...begun, rngState: random.rngState }, legal[random.index]!);
  return { ...drop, events: [event, ...drop.events] };
}
