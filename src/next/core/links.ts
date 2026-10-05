import { cellKey, isPlayable } from './board.ts';
import { freeze } from './immutable.ts';
import type { Axis, BoardDefinition, Box, Link } from './types.ts';

/** 日本語: 順序もルールの一部。変更すると攻撃列の意味が変わる。
 * English: This order is part of the rules, not a rendering preference. */
const AXES: readonly { axis: Axis; row: number; col: number }[] = [
  { axis: 'vertical', row: 1, col: 0 },
  { axis: 'horizontal', row: 0, col: 1 },
  { axis: 'diagonal-down', row: 1, col: 1 },
  { axis: 'diagonal-up', row: -1, col: 1 },
];

export function calculateLinks(board: BoardDefinition, boxes: readonly Box[], originBoxId: string): readonly Link[] {
  const origin = boxes.find((box) => box.id === originBoxId);
  if (!origin || !isPlayable(board, origin)) return freeze([]);
  const occupied = new Map(boxes.map((box) => [cellKey(box), box]));
  return freeze(AXES.map(({ axis, row: dr, col: dc }) => {
    const directions = [-1, 1].map((direction) => {
      const ids: string[] = [];
      for (let distance = 1; ; distance += 1) {
        const cell = { row: origin.row + dr * distance * direction, col: origin.col + dc * distance * direction };
        if (!isPlayable(board, cell)) break;
        const box = occupied.get(cellKey(cell));
        if (!box || box.owner !== origin.owner) break;
        ids.push(box.id);
      }
      return ids;
    });
    // 日本語: 起点は一度だけ数える。English: The origin counts exactly once per axis.
    const boxIds = [...directions[0]!.reverse(), origin.id, ...directions[1]!];
    const count = boxIds.length;
    const tier = count < 3 ? null : Math.min(count, 5) as 3 | 4 | 5;
    return { axis, count, boxIds, tier };
  }));
}
