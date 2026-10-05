import { getEnemyDefinition } from '../core/definitions.ts';
import { defaultTuning } from '../core/tuning.ts';
import type { GameTuning } from '../core/tuning.ts';
import { freeze } from '../core/immutable.ts';
import type { EnemyId } from '../core/types.ts';

export const endlessRoster = ['marujiro', 'hikikizan', 'nigirin'] as const;
/** 日本語: 進行順と難度計算は戦闘・継承から独立。選択した開始点から循環する。
 * English: Route and difficulty are pure progression data, independent of combat or carry. */
export function endlessEncounter(stage: number, first: EnemyId = 'marujiro', tuning: GameTuning = defaultTuning): { enemyId: EnemyId; maxHp: number } {
  if (!Number.isSafeInteger(stage) || stage < 1) throw new Error('Stage must be a positive safe integer');
  const start = endlessRoster.indexOf(first as typeof endlessRoster[number]);
  // The standalone Merarun lab remains a one-enemy cycle when explicitly selected.
  const enemyId = start < 0 ? first : endlessRoster[(start + (stage - 1) % endlessRoster.length) % endlessRoster.length]!;
  const maxHp = getEnemyDefinition(enemyId, tuning).maxHp + (stage - 1) * tuning.progression.hpPerStage;
  if (!Number.isSafeInteger(maxHp)) throw new Error('Enemy HP exceeded exact integer range');
  return freeze({ enemyId, maxHp });
}
