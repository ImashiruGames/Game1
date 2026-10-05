import type { ShapePattern } from '../core/shapePatterns.ts';
/** Data-only diagram description is shared by skill cards and reward offers. */
export function shapeDiagramCells(pattern: ShapePattern): { rows: number; columns: number; filled: readonly boolean[]; orientation: string } {
  const rows = Math.max(...pattern.cells.map(cell => cell.row)) + 1;
  const columns = Math.max(...pattern.cells.map(cell => cell.col)) + 1;
  return { rows, columns, filled: Array.from({ length: rows * columns }, (_, index) => pattern.cells.some(cell => cell.row === Math.floor(index / columns) && cell.col === index % columns)),
    orientation: pattern.fixedOrientation ? '上下固定' : '回転可' };
}
export function createShapeDiagram(pattern: ShapePattern): HTMLElement {
  const shape = shapeDiagramCells(pattern);
  const element = document.createElement('span');
  element.className = 'shape-diagram'; element.setAttribute('role', 'img');
  element.setAttribute('aria-label', `${shape.rows}行${shape.columns}列の形、${shape.orientation}`);
  element.style.setProperty('--shape-columns', String(shape.columns));
  for (const filled of shape.filled) {
    const cell = document.createElement('i'); cell.className = filled ? 'filled' : ''; cell.setAttribute('aria-hidden', 'true'); element.append(cell);
  }
  return element;
}
