/** 日本語: 発火した形のIDから実際のセルだけを描く。新しい形の走査や効果の再発動はしない。 */
import type { BattleEvent, Box, ShapeSkillId } from '../core/types.ts';

export interface ShapeFeedback {
  readonly skillId: ShapeSkillId;
  readonly shortName: string;
  readonly geometry: string;
  readonly detail: string;
  readonly rows: number;
  readonly columns: number;
  readonly filled: readonly boolean[];
}
const shapes = {
  'rescue-kit': { shortName: '救急箱', geometry: '5箱の固定形・中央上は任意', count: 5, size: 3 },
  health: { shortName: 'ヘルス', geometry: '5箱の十字', count: 5, size: 3 },
  'corner-strike': { shortName: '角打ち', geometry: '3箱のL字', count: 3, size: 2 },
  'square-strike': { shortName: '四角打ち', geometry: '2×2の四角', count: 4, size: 2 },
} as const;
/** Render exactly the event's occupied cells, including the actual L rotation. No shape scan or effect execution. */
export function shapeFeedbackForEvent(event: BattleEvent, boxes: readonly Box[]): ShapeFeedback | null {
  const id = event.type === 'heal' && (event.source === 'health' || event.source === 'rescue-kit') ? event.source
    : event.type === 'damage' && (event.source === 'corner-strike' || event.source === 'square-strike') ? event.source : null;
  if (!id || !('shapeBoxIds' in event) || !event.shapeBoxIds) return null;
  const shape = shapes[id], ids = [...new Set(event.shapeBoxIds)];
  if (ids.length !== shape.count) return null;
  const cells = ids.flatMap(boxId => { const box = boxes.find(box => box.id === boxId); return box ? [box] : []; });
  if (cells.length !== ids.length || cells.some(cell => !Number.isSafeInteger(cell.row) || !Number.isSafeInteger(cell.col))) return null;
  const minRow = Math.min(...cells.map(cell => cell.row)), minCol = Math.min(...cells.map(cell => cell.col));
  const rows = Math.max(...cells.map(cell => cell.row)) - minRow + 1, columns = Math.max(...cells.map(cell => cell.col)) - minCol + 1;
  // Refuse malformed/missing geometry rather than inventing a glyph unrelated to the event.
  if (rows !== (id === 'rescue-kit' ? 2 : shape.size) || columns !== shape.size || new Set(cells.map(cell => `${cell.row}:${cell.col}`)).size !== cells.length) return null;
  const filled = Array.from({ length: rows * columns }, (_, i) => cells.some(cell => cell.row - minRow === Math.floor(i / columns) && cell.col - minCol === i % columns));
  if (id === 'health' && filled.some((value, i) => value !== [1, 3, 4, 5, 7].includes(i))) return null;
  if (id === 'rescue-kit' && filled.some((value, i) => value !== [0, 2, 3, 4, 5].includes(i))) return null;
  const target = (event.type === 'heal' || event.type === 'damage') && event.target === 'player' ? '自分' : '敵';
  const nominal = event.type === 'heal' && event.amount !== event.requestedAmount ? `（名目${event.requestedAmount}）` : '';
  return { skillId: id, shortName: shape.shortName, geometry: shape.geometry, detail: `${target}・${shape.geometry}${nominal}`, rows, columns, filled };
}
/** One compact header inside the existing feedback bubble. Blue reflection is deliberately not another activation. */
export function shapeFeedbackHtml(view: ShapeFeedback | null): string {
  if (!view) return '';
  return `<span class="shape-feedback-header" aria-label="${view.shortName}・${view.geometry}"><span class="shape-feedback-sigil" style="--shape-cols:${view.columns};--shape-rows:${view.rows}" aria-hidden="true">${view.filled.map(filled => `<i${filled ? ' class="filled"' : ''}></i>`).join('')}</span><span>${view.shortName}</span></span>`;
}
