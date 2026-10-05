import { validateExperimentTuning } from '../tuning.ts';
import { implementedIds } from '../model.ts';
import { tuningOf, validateTuning } from './tuning.ts';
import { cellKey, isPlayable } from './board.ts';
import { validatePlayerBuild } from './playerBuild.ts';
import { gaugeDefinition } from './gauge.ts';
import type { BattleConfig, Cell } from './types.ts';

/** 日本語: 開始時に設定ミスを拒否し、盤面を途中まで作らない。
 * English: Reject invalid definitions before constructing any partially usable battle. */
export function validateConfig(config: BattleConfig): void {
  const { board } = config;
  if (config.experimentTuning) validateExperimentTuning(config.experimentTuning);
  if (config.experiment && !implementedIds.includes(config.experiment)) throw new Error('Experiment is not implemented');
  if (config.experiment && config.initialBuild?.slots.every(Boolean)) throw new Error('Experiment requires one free flexible slot');
  if (config.tuning) validateTuning(config.tuning);
  const require = (condition: boolean, message: string): void => {
    if (!condition) throw new Error(`Battle config: ${message}`);
  };
  require(Number.isSafeInteger(board.width) && board.width > 0, 'width must be a positive integer');
  require(Number.isSafeInteger(board.height) && board.height > 0, 'height must be a positive integer');
  require(Number.isSafeInteger(board.width * board.height), 'board area must be a safe integer');
  require(board.gravity === 'down', 'only downward gravity is supported');
  require(config.firstActor === 'player' || config.firstActor === 'enemy', 'invalid first actor');
  require(Number.isSafeInteger(config.seed) && config.seed >= 0 && config.seed <= 0xffff_ffff, 'seed must be an unsigned 32-bit integer');
  require(config.enemyPattern.length > 0 && config.enemyPattern.every((action) => action.type === 'drop'
    || (action.type === 'heal' && Number.isSafeInteger(action.amount) && action.amount >= 0)), 'enemy pattern must contain valid drops or heals');
  require(config.characterId === undefined || ['blue', 'red'].includes(config.characterId), 'unsupported character');
  require(config.enemyId === undefined || ['marujiro', 'hikikizan', 'nigirin', 'merarun'].includes(config.enemyId), 'unsupported enemy');
  const gauge = gaugeDefinition(config.characterId, tuningOf(config));
  require(config.initialGauge === undefined || Number.isSafeInteger(config.initialGauge) && config.initialGauge >= 0 && config.initialGauge <= (gauge?.cap ?? 150), 'initial gauge is outside its character cap');
  if (config.initialTransformation) {
    const effect = config.initialTransformation;
    require(config.characterId === undefined || effect.character === config.characterId, 'initial transformation must match character');
    require(effect.character === 'blue' && effect.scope === 'stage' || effect.character === 'red' && effect.scope === 'run'
      && Number.isSafeInteger(effect.remainingStarts) && effect.remainingStarts >= 0 && effect.remainingStarts <= tuningOf(config).transformation.redBonusStarts, 'invalid transformation runtime');
  }
  if (config.initialBuild) validatePlayerBuild(config.initialBuild, config);
  if (config.playerSkills) {
    const { boardSkills, shapeSkills, linkSkills } = config.playerSkills;
    require(Array.isArray(boardSkills) && boardSkills.every(id => ['pain-shared', 'ember'].includes(id))
      && new Set(boardSkills).size === boardSkills.length, 'unsupported or duplicate board skill');
    require(Array.isArray(shapeSkills) && shapeSkills.every(id => ['health', 'corner-strike', 'square-strike'].includes(id))
      && new Set(shapeSkills).size === shapeSkills.length, 'unsupported or duplicate shape skill');
    require(Array.isArray(linkSkills) && linkSkills.every(id => ['grow-fire', 'horizontal-slash', 'diagonal-shot'].includes(id))
      && new Set(linkSkills).size === linkSkills.length, 'unsupported or duplicate link skill');
  }
  const inside = (cell: Cell): boolean => Number.isSafeInteger(cell.row) && Number.isSafeInteger(cell.col)
    && cell.row >= 0 && cell.row < board.height && cell.col >= 0 && cell.col < board.width;
  const terrain = new Set<string>();
  for (const cell of board.terrain) {
    require(inside(cell), 'terrain cell lies outside the board');
    require(!terrain.has(cellKey(cell)), 'duplicate terrain cell');
    terrain.add(cellKey(cell));
  }
  const invalid = new Set<string>();
  for (const cell of board.invalidCells) {
    require(inside(cell), 'invalid cell lies outside the board');
    require(!invalid.has(cellKey(cell)), 'duplicate invalid cell');
    require(!terrain.has(cellKey(cell)), 'terrain and invalid cells must be distinct');
    invalid.add(cellKey(cell));
  }
  const ids = new Set<string>();
  const cells = new Set<string>();
  for (const box of config.initialBoxes) {
    require(typeof box.id === 'string' && box.id.length > 0 && !ids.has(box.id), 'box IDs must be nonempty and unique');
    require(isPlayable(board, box), `box ${box.id} lies outside a playable cell`);
    require(!cells.has(cellKey(box)), `duplicate box cell at ${cellKey(box)}`);
    require(['player', 'enemy', 'neutral'].includes(box.owner), `unsupported owner on ${box.id}`);
    require(box.type === 'normal' && box.status === 'normal', `unsupported box type or status on ${box.id}`);
    ids.add(box.id); cells.add(cellKey(box));
  }
  for (const actor of ['player', 'enemy'] as const) {
    const definition = config.combatants[actor];
    require(Number.isSafeInteger(definition.maxHp) && definition.maxHp > 0, `${actor} maxHp must be positive`);
    require(Number.isSafeInteger(definition.initialHp) && definition.initialHp > 0 && definition.initialHp <= definition.maxHp,
      `${actor} initialHp must be positive and no greater than maxHp`);
    for (const tier of [3, 4, 5] as const) {
      const value = definition.attacks[tier];
      // 日本語: 最大4連撃のオーバーキルも整数で正確に保持する。
      // English: Keep even a four-axis overkill sequence within exact integer arithmetic.
      require(Number.isSafeInteger(value) && value >= 0 && value <= Math.floor(Number.MAX_SAFE_INTEGER / 4),
        `${actor} attack ${tier} must be a nonnegative safe damage value`);
    }
  }
}
