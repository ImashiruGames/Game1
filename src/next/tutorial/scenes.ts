// 日本語: チュートリアルの場面データ。盤面は「列A〜F・段は下から1〜8」で書く（台本と同じ表記）。
// English: Tutorial scene data, written like the script: columns A–F, rows counted from the bottom (1–8).
import type { Box } from '../core/types.ts';

const LETTERS = 'ABCDEF';
/** 'C' → 2（左から0始まり）。English: column letter to a zero-based column index. */
export function columnOf(letter: string): number {
  const index = LETTERS.indexOf(letter);
  if (letter.length !== 1 || index < 0) throw new Error(`列の指定が不正です：${letter}`);
  return index;
}
/** 'A1' → 最下段の左端。English: 'A1' is the bottom-left cell. */
export function cellOf(name: string): { row: number; col: number } {
  const n = Number(name.slice(1));
  if (!Number.isInteger(n) || n < 1 || n > 8) throw new Error(`マスの指定が不正です：${name}`);
  return { row: 8 - n, col: columnOf(name[0]!) };
}
export function boxesFor(player: readonly string[] = [], enemy: readonly string[] = []): Box[] {
  const make = (name: string, owner: 'player' | 'enemy'): Box => ({ id: `tut:${name}`, ...cellOf(name), owner, type: 'normal', status: 'normal' });
  const boxes = [...player.map(name => make(name, 'player')), ...enemy.map(name => make(name, 'enemy'))];
  if (new Set(boxes.map(box => box.id)).size !== boxes.length) throw new Error('同じマスに箱を重ねています');
  return boxes;
}

export interface SceneSpec {
  readonly player?: readonly string[];
  readonly enemy?: readonly string[];
  /** 日本語: 省略または'keep'は引き継ぎ。English: Omitted or 'keep' carries the current HP. */
  readonly playerHp?: number | 'keep';
  readonly enemyHp: number;
  readonly gauge?: number;
  readonly first?: 'player' | 'enemy';
}
/** 日本語: 第1戦の星人はHP30、第2戦はHP25。English: The star has 30 HP in battle one and 25 in battle two. */
export const ENEMY_MAX_HP = { 1: 30, 2: 25 } as const;
export const PLAYER_START_HP = 30;

const SHAPE_BOARD = { player: ['B3', 'C2', 'C3', 'D3'], enemy: ['B1', 'B2', 'C1', 'D1', 'D2'] } as const;
export const scenes = {
  // 1-1 あいさつ（空の盤面）
  hello: { enemyHp: 30, playerHp: PLAYER_START_HP },
  // 1-2 はじめてのリンク：Cへ置くと横3
  firstLink: { player: ['A1', 'B1'], enemyHp: 30, playerHp: PLAYER_START_HP },
  // 1-4 相手の攻撃と塞ぎ方：最初は敵の番
  block: { player: ['C1', 'D1'], enemy: ['A1', 'A2'], enemyHp: 8, playerHp: PLAYER_START_HP, first: 'enemy' },
  // 1-5 形スキル（ヘルス）：Cへ置くと十字が完成
  shape: { ...SHAPE_BOARD, enemyHp: 8, playerHp: 28 },
  // 1-6 とどめ
  finish: { player: ['E1', 'F1'], enemyHp: 4, playerHp: PLAYER_START_HP },
  // 3-2 盤面スキル：1段目は青5個・紫1個
  boardSkill: {
    player: ['A1', 'B1', 'C1', 'D1', 'F1', 'B2', 'D2', 'E2', 'A3', 'C3', 'F3', 'C4', 'D4', 'A5', 'B5', 'E5', 'F5'],
    enemy: ['E1', 'A2', 'C2', 'F2', 'B3', 'D3', 'E3', 'A4', 'B4', 'E4', 'F4', 'C5', 'D5'],
    enemyHp: 25, playerHp: 'keep',
  },
  // 3-3 変化：1-5と同じ十字の一歩手前。ゲージは満タン（アオイは80）
  // 日本語: ヘルス15がそのまま回復＋反撃になるよう、アオイのHPは減った状態から始める。
  transform: { ...SHAPE_BOARD, enemyHp: 15, playerHp: 12, gauge: 80 },
} as const satisfies Record<string, SceneSpec>;
export type SceneName = keyof typeof scenes;
