import { cellKey, isPlayable } from './board.ts';
import { freeze } from './immutable.ts';
import type { BoardDefinition, Box, Cell } from './types.ts';

export interface ShapePattern { readonly cells: readonly Cell[]; readonly fixedOrientation?: boolean }
export const plusPattern: ShapePattern = freeze({ cells: [{ row: 0, col: 1 }, { row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 }, { row: 2, col: 1 }] });
export const cornerPattern: ShapePattern = freeze({ cells: [{ row: 0, col: 0 }, { row: 1, col: 0 }, { row: 1, col: 1 }] });
export const squarePattern: ShapePattern = freeze({ cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 0 }, { row: 1, col: 1 }] });
function normalize(cells: readonly Cell[]): readonly Cell[] {
  const row = Math.min(...cells.map(cell => cell.row)); const col = Math.min(...cells.map(cell => cell.col));
  return cells.map(cell => ({ row: cell.row - row, col: cell.col - col })).sort((a, b) => a.row - b.row || a.col - b.col);
}
/** Rotation is permitted unless the definition explicitly locks orientation. Reflection is not rotation. */
export function shapeOrientations(pattern: ShapePattern): readonly (readonly Cell[])[] {
  const unique = new Map<string, readonly Cell[]>();
  let current = normalize(pattern.cells);
  for (let rotation = 0; rotation < (pattern.fixedOrientation ? 1 : 4); rotation += 1) {
    unique.set(current.map(cellKey).join('|'), current);
    current = normalize(current.map(cell => ({ row: cell.col, col: -cell.row })));
  }
  return freeze([...unique.values()]);
}
/** 日本語: 新しい能動箱を必ず含め、同じ箱集合の回転重複を除く。
 * English: Every match must contain this active origin; equivalent rotations are deduplicated. */
export function matchShape(board: BoardDefinition, boxes: readonly Box[], originBoxId: string, pattern: ShapePattern): readonly (readonly string[])[] {
  const origin = boxes.find(box => box.id === originBoxId);
  if (!origin || origin.owner !== 'player') return freeze([]);
  const occupied = new Map(boxes.map(box => [cellKey(box), box]));
  const matches = new Map<string, readonly string[]>();
  for (const variant of shapeOrientations(pattern)) for (const anchor of variant) {
    const cells = variant.map(part => ({ row: origin.row + part.row - anchor.row, col: origin.col + part.col - anchor.col }));
    if (cells.some(cell => !isPlayable(board, cell))) continue;
    const parts = cells.map(cell => occupied.get(cellKey(cell)));
    if (parts.every((box): box is Box => box?.owner === 'player')) {
      const ids = parts.map(box => box.id).sort(); matches.set(ids.join('|'), ids);
    }
  }
  return freeze([...matches.values()]);
}
