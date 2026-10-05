import { cornerPattern, plusPattern, squarePattern } from './shapePatterns.ts';
import type { ShapePattern } from './shapePatterns.ts';
import { defaultTuning } from './tuning.ts';
import type { GameTuning } from './tuning.ts';
import { freeze } from './immutable.ts';
import type { NormalSkillId } from './types.ts';
export interface SkillDefinition { readonly id: NormalSkillId; readonly name: string; readonly kind: 'shape' | 'link' | 'passive' | 'instant'; readonly pattern?: ShapePattern }
export const skillCatalog: Readonly<Record<NormalSkillId, SkillDefinition>> = freeze({
  health: { id: 'health', name: 'ヘルス', kind: 'shape', pattern: plusPattern },
  'grow-fire': { id: 'grow-fire', name: '成長する火', kind: 'link' },
  charge: { id: 'charge', name: '蓄勢', kind: 'passive' },
  'first-guard': { id: 'first-guard', name: '初撃の守り', kind: 'passive' },
  'horizontal-slash': { id: 'horizontal-slash', name: '横薙ぎ', kind: 'link' },
  'diagonal-shot': { id: 'diagonal-shot', name: '斜め撃ち', kind: 'link' },
  'corner-strike': { id: 'corner-strike', name: '角打ち', kind: 'shape', pattern: cornerPattern },
  'square-strike': { id: 'square-strike', name: '四角打ち', kind: 'shape', pattern: squarePattern },
  'healing-potion': { id: 'healing-potion', name: '回復ポーション', kind: 'instant' },
  'magic-bullet': { id: 'magic-bullet', name: '魔法弾', kind: 'instant' },
});
export const normalSkillIds = Object.keys(skillCatalog) as NormalSkillId[];
export function skillName(id: NormalSkillId, rank: 1 | 2): string { return skillCatalog[id].name + (rank === 2 ? '＋' : ''); }
export function skillValue(id: NormalSkillId, rank: 1 | 2, tuning: GameTuning = defaultTuning): number { return tuning.skills[id][rank - 1]!; }
export function skillDescription(id: NormalSkillId, rank: 1 | 2, tuning: GameTuning = defaultTuning): string {
  const n = skillValue(id, rank, tuning);
  switch (id) {
    case 'health': return `＋形でHP${n}回復`;
    case 'grow-fire': return `縦3以上：3リンク火力＋${n}、成長＋${tuning.links.growFireGrowth}`;
    case 'charge': return `手番終了のゲージ獲得を合計${n + tuning.gauge.turnGain}にする`;
    case 'first-guard': return `敵手番の最初のリンク被害−${n}`;
    case 'horizontal-slash': return `横3以上のリンク火力＋${n}`;
    case 'diagonal-shot': return `斜め3以上のリンク火力＋${n}`;
    case 'corner-strike': return `L形で${n}ダメージ・回転可`;
    case 'square-strike': return `2×2で${n}ダメージ・回転可`;
    case 'healing-potion': return `HP${n}回復・1回限り・1手消費`;
    case 'magic-bullet': return `現在の4リンク火力×${n}・1回限り・1手消費`;
  }
}
