import { monsterIntent } from './monsterBehavior.ts';
import {isKitBoard,canUseKitBoard} from './kitBoards.ts';
import {IMASHIRU} from './shiny.ts';
import { bossIntent } from './enemySequence.ts';
import { cellKey, isPlayable } from './board.ts';
import { characterSkills, getEnemyDefinition } from './definitions.ts';
import { tuningOf } from './tuning.ts';
import { freeze } from './immutable.ts';
import type { BattleConfig, BattleState, BoardDefinition, BoardSkillId, Box, EnemyIntent, PlayerSkillLoadout, PlusShape, RowSkillPreview } from './types.ts';

const NO_SKILLS: PlayerSkillLoadout = freeze({ boardSkills: [], shapeSkills: [], linkSkills: [] });
export function getPlayerSkills(config: BattleConfig): PlayerSkillLoadout {
  if(config.meta)return {...characterSkills[config.characterId!],boardSkills:[config.meta.board]};
  return config.playerSkills ?? (config.characterId ? characterSkills[config.characterId] : NO_SKILLS);
}

/** 日本語: 削除前の所有者で被害を確定。中立箱はダメージを生まない。
 * English: A preview snapshots pre-deletion ownership; neutral boxes never cause damage. */
export function getRowSkillPreview(state: Pick<BattleState, 'config' | 'boxes'>, row: number): RowSkillPreview {
  const inBounds = Number.isSafeInteger(row) && row >= 0 && row < state.config.board.height;
  const boxes = inBounds ? state.boxes.filter(box => box.row === row) : [];
  const playerCount = boxes.filter(box => box.owner === 'player').length;
  const enemyCount = boxes.filter(box => box.owner === 'enemy').length;
  const neutralCount = boxes.length - playerCount - enemyCount;
  return freeze({ valid: inBounds, row, boxIds: boxes.map(box => box.id),
    playerCount, enemyCount, neutralCount, playerDamage: enemyCount * tuningOf(state.config).board.painPerBox, enemyDamage: playerCount * tuningOf(state.config).board.painPerBox });
}

/** Target availability is independent of whether an ordinary drop can be made. */
export function getAvailableBoardSkills(state: BattleState): readonly BoardSkillId[] {
  if (state.result || state.actor !== 'player') return freeze([]);
  return freeze([...getPlayerSkills(state.config).boardSkills].filter(id=>isKitBoard(id)?canUseKitBoard(state,id):id!=='imashiru-insight'||state.config.meta?.rosterId==='imashiru'&&state.gauge>=IMASHIRU.insightCost&&!state.shinyNextDrop));
}

/** 日本語: 投入可否より先に敵の予定行動を決定。敵自身の手番数で回復を数える。
 * English: The next enemy action is chosen before inspecting drop availability. */
export function getEnemyIntent(state: BattleState): EnemyIntent {
  const boss = bossIntent(state); if (boss) return boss;
  const monster = monsterIntent(state); if (monster) return monster;
  const enemy = state.config.enemyId ? getEnemyDefinition(state.config.enemyId, tuningOf(state.config)) : undefined;
  if (enemy?.healEveryOwnTurns && (state.enemyTurnCount + 1) % enemy.healEveryOwnTurns === 0) {
    return freeze({ type: 'heal', amount: enemy.healAmount! });
  }
  return freeze({ ...state.config.enemyPattern[state.enemyPatternIndex]! });
}

/** 日本語: 能動投入の起点を含む5個の＋形だけ。起点は中央でも腕でもよい。受動時は呼ばない。
 * English: Only five-cell '+' shapes containing this active origin are eligible.
 * The origin may be the center or any arm. No whole-board passive rescan occurs. */
export function findPlusShapes(board: BoardDefinition, boxes: readonly Box[], originBoxId: string): readonly PlusShape[] {
  const origin = boxes.find(box => box.id === originBoxId);
  if (!origin || origin.owner !== 'player' || !isPlayable(board, origin)) return freeze([]);
  const occupied = new Map(boxes.map(box => [cellKey(box), box]));
  const offsets = [{ row: 0, col: 0 }, { row: -1, col: 0 }, { row: 1, col: 0 }, { row: 0, col: -1 }, { row: 0, col: 1 }];
  const shapes: PlusShape[] = [];
  for (const offset of offsets) {
    const center = { row: origin.row - offset.row, col: origin.col - offset.col };
    const cells = offsets.map(part => ({ row: center.row + part.row, col: center.col + part.col }));
    if (cells.some(cell => !isPlayable(board, cell))) continue;
    const parts = cells.map(cell => occupied.get(cellKey(cell)));
    if (parts.every((part): part is Box => part?.owner === 'player')) shapes.push({ center, boxIds: parts.map(part => part.id) });
  }
  return freeze(shapes);
}
