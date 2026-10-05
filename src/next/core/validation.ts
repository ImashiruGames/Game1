import { enemyRoster } from './monsters.ts';
import {validateKitBalance,validateBoardBalance,kitBalanceOf} from '../meta/kitBalance.ts';
import {BOARD_CATALOG_VERSION,characterBoardChoices,legacyBoardChoices} from '../meta/kits.ts';
import {boxTypeIds} from './boxTypes.ts';
import { roster, isRosterId } from '../meta/roster.ts';
import { normalSkillIds,skillCatalog } from './skillCatalog.ts';
import { tuningOf, validateTuning } from './tuning.ts';
import { cellKey, isPlayable } from './board.ts';
import { validatePlayerBuild } from './playerBuild.ts';
import { gaugeDefinition } from './gauge.ts';
import type { BattleConfig, Cell } from './types.ts';

/** 日本語: 開始時に設定ミスを拒否し、盤面を途中まで作らない。
 * English: Reject invalid definitions before constructing any partially usable battle. */
export function validateConfig(config: BattleConfig): void {
  const { board } = config;
  if (config.tuning) validateTuning(config.tuning);
  if(config.meta?.kitBalance!==undefined){if(config.meta.kitVersion!==2)throw new Error('Kit balance requires a versioned kit');validateKitBalance(config.meta.kitBalance);}
  const require = (condition: boolean, message: string): void => {
    if (!condition) throw new Error(`Battle config: ${message}`);
  };
  require(config.frozenRule===undefined||config.frozenRule==='half-melt-v1','invalid frozen rule');
  require(Number.isSafeInteger(board.width) && board.width > 0, 'width must be a positive integer');
  require(Number.isSafeInteger(board.height) && board.height > 0, 'height must be a positive integer');
  require(Number.isSafeInteger(board.width * board.height), 'board area must be a safe integer');
  require(board.gravity === 'down', 'only downward gravity is supported');
  require(config.firstActor === 'player' || config.firstActor === 'enemy', 'invalid first actor');
  require(Number.isSafeInteger(config.seed) && config.seed >= 0 && config.seed <= 0xffff_ffff, 'seed must be an unsigned 32-bit integer');
  require(config.enemyPattern.length > 0 && config.enemyPattern.every((action) => action.type === 'drop'
    || (action.type === 'heal' && Number.isSafeInteger(action.amount) && action.amount >= 0)), 'enemy pattern must contain valid drops or heals');
  require(config.characterId === undefined || ['blue', 'red'].includes(config.characterId), 'unsupported character');
  require(config.enemyId === undefined || enemyRoster.includes(config.enemyId), 'unsupported enemy');
  require(config.enemyFixedDamageBonus === undefined || Number.isSafeInteger(config.enemyFixedDamageBonus) && config.enemyFixedDamageBonus >= 0, 'fixed damage bonus must be a safe nonnegative integer');
  require(Number.isSafeInteger((config.enemyFixedDamageBonus ?? 0) + Math.max(tuningOf(config).bosses.speedPulseDamage,tuningOf(config).bosses.motherPulseDamage)), 'fixed damage exceeded exact integer range');
  if (config.strategy) {
    require(['automatic-link', 'manual-charge'].includes(config.strategy.transformation), 'unknown transformation strategy');
    require(['per-box', 'bands'].includes(config.strategy.gauge), 'unknown gauge strategy');
    require(config.strategy.gauge !== 'bands' || !!tuningOf(config).gauge.bands, 'band gauge requires explicit amounts');
  }
  require(config.initialEnemyTurnCount === undefined || Number.isSafeInteger(config.initialEnemyTurnCount) && config.initialEnemyTurnCount >= 0, 'initial enemy own-turn count must be nonnegative');
  const gauge = gaugeDefinition(config.characterId, tuningOf(config));
  require(config.initialGauge === undefined || Number.isSafeInteger(config.initialGauge) && config.initialGauge >= 0 && config.initialGauge <= (gauge?.cap ?? 150), 'initial gauge is outside its character cap');
  if (config.initialTransformation) {
    const effect = config.initialTransformation;
    if(effect.character==='amber'){const turns=kitBalanceOf(config).amber.ownTurns;require(turns>1?Number.isSafeInteger(effect.remainingOwnTurns)&&effect.remainingOwnTurns!>=1&&effect.remainingOwnTurns!<=turns:effect.remainingOwnTurns===undefined,'invalid power-form duration');}
    require(config.characterId === undefined || (effect.character === config.characterId||effect.character==='imashiru'&&config.meta?.rosterId==='imashiru'||config.meta?.kitVersion===2&&effect.character===config.meta.rosterId), 'initial transformation must match character');
    require(config.meta?.kitVersion===2&&effect.character===config.meta.rosterId&&(effect.character==='mint'?effect.scope==='stage':['amber','violet','silver','rose'].includes(effect.character)&&effect.scope==='turn')||effect.character==='imashiru'&&effect.scope==='turn'&&config.meta?.rosterId==='imashiru'||effect.character === 'blue' && effect.scope === 'stage' || effect.character === 'red' && effect.scope === 'run'
      && Number.isSafeInteger(effect.remainingStarts) && effect.remainingStarts >= 0 && effect.remainingStarts <= tuningOf(config).transformation.redBonusStarts, 'invalid transformation runtime');
  }
  if(config.meta){const m=config.meta;
    require(m.balanceVersion===undefined||m.balanceVersion===2,'unknown roster balance');
    require(m.treeVersion===undefined||m.treeVersion===2,'unknown tree version');
    require(m.progressionVersion===undefined||m.progressionVersion===2,'unknown progression terms');
    require(m.boardCatalogVersion===undefined||m.boardCatalogVersion===BOARD_CATALOG_VERSION,'unknown board catalog');
    require(m.boardCatalogVersion===undefined?m.boardBalance===undefined:m.kitVersion===2&&m.boardBalance!==undefined,'board balance requires current catalog');
    if(m.boardBalance!==undefined)validateBoardBalance(m.boardBalance);
    require((m.kitVersion===undefined||m.kitVersion===2)&&m.version===1&&isRosterId(m.rosterId)&&roster[m.rosterId].archetype===config.characterId,'invalid roster identity');
    require(Number.isSafeInteger(m.level)&&m.level>=1&&m.level<=30&&typeof m.eligible==='boolean','invalid progression snapshot');
    require(!!m.tree&&['three','four','five','slots','board'].every(k=>Number.isSafeInteger(m.tree[k as keyof typeof m.tree])&&(m.tree[k as keyof typeof m.tree]??-1)>=0),'invalid tree');
    require(m.slots===2+m.tree.slots&&m.slots>=2&&m.slots<=4,'invalid slot capacity');
    require([m.tree.three,m.tree.four,m.tree.five].every(n=>n<=5+(m.treeVersion===2?Math.floor(m.level/5):0))&&m.tree.board<=1&&(m.tree.rewardHeal===undefined||Number.isSafeInteger(m.tree.rewardHeal)&&m.tree.rewardHeal>=0&&m.tree.rewardHeal<=(m.treeVersion===2?5+Math.floor(m.level/5):0)),'invalid tree ranks');
    require((m.tree.rewardHeal??0)+m.tree.three+m.tree.four+m.tree.five+3*m.tree.slots+3*m.tree.board<=2+(m.level-1)*2,'overspent tree');
    const allowedBoards=m.boardCatalogVersion===BOARD_CATALOG_VERSION?characterBoardChoices(m.rosterId,!!m.tree.board):legacyBoardChoices(m.rosterId,!!m.tree.board,m.kitVersion===2);require(allowedBoards.includes(m.board),'locked board skill');
    require(Array.isArray(m.pool)&&m.pool.length>=6&&m.pool.length<=20&&new Set(m.pool).size===m.pool.length&&m.pool.every(id=>normalSkillIds.includes(id)&&skillCatalog[id].rewardAccess!=='never'&&(skillCatalog[id].rewardAccess!=='starter-upgrade-only'||roster[m.rosterId].starter===id)),'invalid frozen reward pool');
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
    require(boxTypeIds.includes(box.type) && box.status === 'normal', `unsupported box type or status on ${box.id}`);
    require(box.poisonSource===undefined||(box.type==='poison'||box.type==='deadly-poison')&&['player','enemy'].includes(box.poisonSource),'invalid poison source');
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
