import test from 'node:test';
import assert from 'node:assert/strict';
import { endlessEncounter } from '../src/app/progression.ts';
import { cornerPattern, matchShape, plusPattern, shapeOrientations, squarePattern } from '../src/core/shapePatterns.ts';
import { shapeDiagramCells } from '../src/ui/shapeDiagram.ts';
import type { Box, BoardDefinition } from '../src/core/types.ts';
const board: BoardDefinition = { width: 5, height: 5, gravity: 'down', terrain: [], invalidCells: [] };
const box = (row: number, col: number): Box => ({ id: `${row}:${col}`, row, col, owner: 'player', type: 'normal', status: 'normal' });
test('endless progression repeats the complete roster and adds ten HP per stage', () => {
  assert.deepEqual(Array.from({ length: 7 }, (_, n) => endlessEncounter(n + 1)), [
    { enemyId: 'marujiro', maxHp: 60 }, { enemyId: 'hikikizan', maxHp: 40 }, { enemyId: 'nigirin', maxHp: 50 },
    { enemyId: 'marujiro', maxHp: 90 }, { enemyId: 'hikikizan', maxHp: 70 }, { enemyId: 'nigirin', maxHp: 80 }, { enemyId: 'marujiro', maxHp: 120 }]);
  assert.equal(endlessEncounter(3, 'hikikizan').enemyId, 'marujiro');
});
test('invalid stages reject instead of introducing rounded HP', () => {
  for (const stage of [0, -1, 1.5, NaN, Number.MAX_SAFE_INTEGER]) assert.throws(() => endlessEncounter(stage));
});
test('rotations are unique and orientation locks are explicit', () => {
  assert.equal(shapeOrientations(cornerPattern).length, 4);
  assert.equal(shapeOrientations(squarePattern).length, 1);
  assert.equal(shapeOrientations(plusPattern).length, 1);
  assert.equal(shapeOrientations({ ...cornerPattern, fixedOrientation: true }).length, 1);
});
test('every rotated L is matched from any of its three active-origin parts', () => {
  for (const cells of shapeOrientations(cornerPattern)) {
    const boxes = cells.map(cell => box(cell.row + 1, cell.col + 1));
    for (const origin of boxes) assert.equal(matchShape(board, boxes, origin.id, cornerPattern).length, 1);
  }
});
test('matching rejects foreign boxes, terrain, remote origins and missing cells', () => {
  const boxes = cornerPattern.cells.map(cell => box(cell.row + 1, cell.col + 1));
  assert.equal(matchShape(board, [...boxes, box(4, 4)], '4:4', cornerPattern).length, 0);
  assert.equal(matchShape(board, boxes.slice(1), boxes[1]!.id, cornerPattern).length, 0);
  assert.equal(matchShape(board, boxes.map((b, i) => i === 0 ? { ...b, owner: 'enemy' } : b), boxes[1]!.id, cornerPattern).length, 0);
  assert.equal(matchShape({ ...board, terrain: [boxes[0]!] }, boxes, boxes[1]!.id, cornerPattern).length, 0);
});
test('grid diagrams use real occupied cells and label locked orientation', () => {
  assert.deepEqual(shapeDiagramCells(cornerPattern), { rows: 2, columns: 2, filled: [true, false, true, true], orientation: '回転可' });
  assert.equal(shapeDiagramCells(plusPattern).filled.filter(Boolean).length, 5);
  assert.equal(shapeDiagramCells({ ...cornerPattern, fixedOrientation: true }).orientation, '上下固定');
});
