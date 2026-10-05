import { getEnemyDefinition, tuningOf, enemyRoster, settleBoxes } from '../core/index.ts';
import type { RewardOffer } from './rewards.ts';
import type { BattleConfig, BattleState, Box, EnemyId } from '../core/index.ts';

export interface BattleRunOptions {
  /** A finite route; begin at the selected enemy and stop after its final opponent. */
  readonly enemyOrder?: readonly EnemyId[];
  readonly mode?: 'finite' | 'endless';
  readonly rewards?: boolean;
}

export interface BattleRunState {
  readonly stage: number;
  readonly defeatedCount: number;
  readonly currentEnemyId: EnemyId;
  readonly status: 'active' | 'reward' | 'transitioning' | 'lost' | 'cleared';
  readonly offer?: RewardOffer;
}

/** Copy the run settings, so a menu or test cannot mutate an active run. */
export function prepareEnemyOrder(config: BattleConfig, options?: BattleRunOptions): readonly EnemyId[] | null {
  if (!options || !config.characterId || !config.enemyId) return null;
  const supplied = options.enemyOrder ?? (config.enemyId === 'merarun' ? ['merarun'] as const : ['marujiro', 'hikikizan', 'nigirin'] as const);
  if (!Array.isArray(supplied) || supplied.length === 0
    || supplied.some(id => !enemyRoster.includes(id))
    || new Set(supplied).size !== supplied.length
    || !supplied.includes(config.enemyId)) {
    throw new Error('Battle run: enemy order must contain unique known enemies, including the selected enemy');
  }
  const start = supplied.indexOf(config.enemyId);
  return Object.freeze([...supplied.slice(start)]);
}

export function createRunState(enemyId: EnemyId): BattleRunState {
  return Object.freeze({ stage: 1, defeatedCount: 0, currentEnemyId: enemyId, status: 'active' });
}

/** Stage RNG is reproducible, independent of animation timing and menu updates. */
export function stageSeed(seed: number, stage: number): number {
  return (seed + Math.imul(stage - 1, 0x9e37_79b9)) >>> 0;
}

/** Preserve the highest occupied player row only; this gravity pass is passive. */
export function carryTopPlayerRow(state: BattleState): readonly Box[] {
  const own = state.boxes.filter(box => box.owner === 'player');
  if (own.length === 0) return Object.freeze([]);
  const row = own.reduce((minimum, box) => Math.min(minimum, box.row), Infinity);
  return settleBoxes(state.config.board, own.filter(box => box.row === row));
}

/** The next enemy starts fresh while HP and the approved top-row boxes carry over. */
export function createNextStageConfig(initial: BattleConfig, won: BattleState, enemyId: EnemyId, stage: number): BattleConfig {
  if (won.result?.winner !== 'player' || won.hp.player.current <= 0) {
    throw new Error('Battle run: only a surviving player victory can advance');
  }
  const enemy = getEnemyDefinition(enemyId, tuningOf(won.config));
  return {
    ...initial,
    enemyId,
    board: won.config.board,
    initialBoxes: carryTopPlayerRow(won),
    firstActor: 'player',
    initialGauge: 0, initialTransformation: undefined, initialBuild: undefined,
    seed: stageSeed(initial.seed, stage),
    combatants: {
      player: { ...won.config.combatants.player, initialHp: won.hp.player.current },
      enemy: { maxHp: enemy.maxHp, initialHp: enemy.maxHp, attacks: enemy.attacks },
    },
  };
}
