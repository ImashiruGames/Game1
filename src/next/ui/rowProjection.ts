import { applyAction } from '../core/index.ts';
import type { BattleResult, BattleState, Box, Cell } from '../core/types.ts';

export interface RowProjectionMove {
  readonly boxId: string;
  readonly from: Cell;
  readonly to: Cell;
}

/** Display data for one accepted row removal, never a command or a replacement state. */
export interface RowProjection {
  /** Caller must discard the projection if the current snapshot or selected row changes. */
  readonly sourceState: BattleState;
  /** Original selected row, even if no surviving box occupies it after settling. */
  readonly row: number;
  readonly boxes: readonly Box[];
  readonly removedBoxIds: readonly string[];
  readonly moves: readonly RowProjectionMove[];
  /** An in-bounds empty row remains a legal, turn-consuming core action. */
  readonly isEmptyRow: boolean;
  readonly result: BattleResult | null;
}

/** 日本語: 行消去と受動落下だけを正本の純粋な遷移から読む。次の敵行動は実行しない。
 * English: Use the exact action boundary for settled boxes, including terminal actions.
 * Validation (actor, result, skill, row and pending turn-start) belongs to that same boundary.
 */
export function projectRowRemoval(state: BattleState, row: number): RowProjection | null {
  const applied = applyAction(state, { type: 'board-skill', skillId: 'pain-shared', row });
  if (!applied.accepted) return null;

  const originals = new Map(state.boxes.map(box => [box.id, box]));
  const removedBoxIds = Object.freeze(state.boxes.filter(box => box.row === row).map(box => box.id));
  const moves: RowProjectionMove[] = [];
  for (const box of applied.state.boxes) {
    const original = originals.get(box.id)!;
    if (original.row === box.row && original.col === box.col) continue;
    moves.push(Object.freeze({
      boxId: box.id,
      from: Object.freeze({ row: original.row, col: original.col }),
      to: Object.freeze({ row: box.row, col: box.col }),
    }));
  }
  return Object.freeze({ sourceState: state, row, boxes: applied.state.boxes,
    removedBoxIds, moves: Object.freeze(moves), isEmptyRow: removedBoxIds.length === 0,
    result: applied.state.result });
}
