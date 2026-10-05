import { freeze } from './immutable.ts';
import type { BattleState, BoardDefinition, Box, Cell, DropCandidate, DropOption } from './types.ts';

export const cellKey = ({ row, col }: Cell): string => `${row},${col}`;
export function isPlayable(board: BoardDefinition, cell: Cell): boolean {
  return Number.isInteger(cell.row) && Number.isInteger(cell.col)
    && cell.row >= 0 && cell.row < board.height && cell.col >= 0 && cell.col < board.width
    && !board.terrain.some((other) => cellKey(other) === cellKey(cell))
    && !board.invalidCells.some((other) => cellKey(other) === cellKey(cell));
}

/** 日本語: 箱を無視して地形の各連続区間を探す。内部天井も対象。
 * English: Derive every vertical segment from terrain alone, including internal ceilings. */
export function generateDropCandidates(board: BoardDefinition): readonly DropCandidate[] {
  const candidates: DropCandidate[] = [];
  for (let col = 0; col < board.width; col += 1) {
    let row = 0;
    while (row < board.height) {
      if (!isPlayable(board, { row, col })) { row += 1; continue; }
      const start = row;
      while (row + 1 < board.height && isPlayable(board, { row: row + 1, col })) row += 1;
      candidates.push({ id: `ceiling:${col}:${start}`, spawn: { row: start, col },
        edge: { row: start, col, side: 'top' }, segmentEndRow: row });
      row += 1;
    }
  }
  return freeze(candidates);
}

/** 日本語: 出現マスが塞がっていたら即不可。下の空白へ飛び越えない。
 * English: A blocked spawn rejects the whole drop; never tunnel into an empty cell below. */
export function getDropOptions(state: Pick<BattleState, 'config' | 'boxes'>): readonly DropOption[] {
  const occupied = new Set(state.boxes.map(cellKey));
  return freeze(generateDropCandidates(state.config.board).map((candidate) => {
    if (occupied.has(cellKey(candidate.spawn))) return { ...candidate, available: false, landing: null, path: [] };
    const path: Cell[] = [{ ...candidate.spawn }];
    for (let row = candidate.spawn.row + 1; row <= candidate.segmentEndRow; row += 1) {
      const cell = { row, col: candidate.spawn.col };
      if (occupied.has(cellKey(cell))) break;
      path.push(cell);
    }
    return { ...candidate, available: true, path, landing: path[path.length - 1]! };
  }));
}

/** 日本語: 受動整理は位置だけを返す。起点・リンク・攻撃を決して生成しない。
 * English: Passive settling returns positions only, never an origin, links, or attacks.
 * 日本語: 下の箱から処理するので順序・所有者を維持し、地形も通過しない。
 * English: Bottom-up processing preserves stack order and respects every terrain barrier. */
export function settleBoxes(board: BoardDefinition, boxes: readonly Box[]): readonly Box[] {
  const occupied = new Set<string>();
  const ids = new Set<string>();
  for (const box of boxes) {
    if (!isPlayable(board, box)) throw new Error(`Invalid box cell: ${box.id}`);
    if (occupied.has(cellKey(box)) || ids.has(box.id)) throw new Error(`Duplicate box: ${box.id}`);
    occupied.add(cellKey(box)); ids.add(box.id);
  }
  const positions = new Map<string, Box>();
  const bottomFirst = [...boxes].sort((a, b) => b.row - a.row || a.col - b.col);
  for (const box of bottomFirst) {
    occupied.delete(cellKey(box));
    let row = box.row;
    while (isPlayable(board, { row: row + 1, col: box.col }) && !occupied.has(cellKey({ row: row + 1, col: box.col }))) row += 1;
    const settled = { ...box, row };
    occupied.add(cellKey(settled)); positions.set(box.id, settled);
  }
  return freeze(boxes.map((box) => positions.get(box.id)!));
}
