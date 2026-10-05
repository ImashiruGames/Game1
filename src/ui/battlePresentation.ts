import type { Actor, EnemyIntent, BattleEvent, BattleState, Resolution } from '../core/index.ts';

export interface BattleEffect {
  readonly kind: 'link' | 'shape' | 'heal';
  readonly boxIds: readonly string[];
  readonly feedback?: { readonly amount: number; readonly type: 'damage' | 'heal'; readonly actor: Actor };
}
/** 日本語: 発火済みイベントから、その瞬間の形だけを描く。新しい技能判定はしない。
 * English: Display only geometry attached to the current committed event, never re-detect skills. */
export function effectForEvent(event: BattleEvent, resolution: Resolution): BattleEffect | null {
  if (event.type === 'heal') {
    return { kind: event.shapeBoxIds?.length ? 'shape' : 'heal', boxIds: event.shapeBoxIds ?? [],
      feedback: { amount: event.amount, type: 'heal', actor: event.target } };
  }
  if (event.type === 'damage' && (event.source === 'blue-transformation' || event.shapeBoxIds?.length || event.source === 'magic-bullet')) {
    return { kind: 'shape', boxIds: event.shapeBoxIds ?? [], feedback: { amount: event.damage, type: 'damage', actor: event.shapeBoxIds?.length ? 'player' : event.target } };
  }
  if (event.type === 'attack') {
    const link = resolution.links.find(link => link.axis === event.axis && link.tier !== null);
    return link ? { kind: 'link', boxIds: link.boxIds, feedback: { amount: event.damage, type: 'damage', actor: event.actor } } : null;
  }
  return null;
}
export function effectTiming(reduced: boolean): { lead: number; hold: number; float: number } {
  return reduced ? { lead: 0, hold: 160, float: 0 } : { lead: 160, hold: 640, float: 12 };
}
export interface BoardGeometry { left: number; top: number; cell: number; width: number; height: number }
/** 日本語: リンク領域の上中央。上端や左右端では文字全体をキャンバス内へ収める。
 * English: Anchor above the link bounds and clamp the whole label inside the canvas. */
export function damageLabelAnchor(state: Pick<BattleState, 'boxes'>, boxIds: readonly string[], geometry: BoardGeometry, labelWidth: number, labelHeight: number): { x: number; y: number } {
  const boxes = state.boxes.filter(box => boxIds.includes(box.id));
  const minCol = boxes.length ? Math.min(...boxes.map(box => box.col)) : 0;
  const maxCol = boxes.length ? Math.max(...boxes.map(box => box.col)) : 0;
  const row = boxes.length ? Math.min(...boxes.map(box => box.row)) : 0;
  const half = Math.min(labelWidth / 2, geometry.width / 2 - 8);
  return {
    x: Math.max(half + 8, Math.min(geometry.width - half - 8, geometry.left + (minCol + maxCol + 1) / 2 * geometry.cell)),
    y: Math.max(labelHeight + 8, Math.min(geometry.height - 8, geometry.top + row * geometry.cell - 9)),
  };
}

export function activeDropPose(before: BattleState, resolution: Resolution): BattleState {
  const drop = resolution.events.find(event => event.type === 'drop');
  return { ...before, result: null, boxes: drop ? [...before.boxes, drop.box] : before.boxes };
}

/** 日本語: 回復と被害は同じ文字演出を使い、値は確定イベントの実増減に従う。
 * English: Healing and damage share one feedback style contract and committed amounts. */
export function feedbackText(feedback: NonNullable<BattleEffect['feedback']>): { text: string; color: string; stroke: string } {
  return feedback.type === 'heal'
    ? { text: `${feedback.amount}回復`, color: '#8cf3ac', stroke: '#082015' }
    : { text: `${feedback.amount}ダメージ`, color: '#ff666b', stroke: '#19070d' };
}
export function feedbackAnchor(state: Pick<BattleState, 'boxes'>, effect: BattleEffect, geometry: BoardGeometry, labelWidth: number, labelHeight: number): { x: number; y: number } {
  if (effect.boxIds.length) return damageLabelAnchor(state, effect.boxIds, geometry, labelWidth, labelHeight);
  // 日本語: 形のない回復は、対象側の盤面上端に固定。箱を勝手に発光させない。
  // English: Unshaped healing anchors at its actor's upper edge without inventing matched boxes.
  const x = geometry.width * (effect.feedback?.actor === 'enemy' ? .75 : .25);
  const half = Math.min(labelWidth / 2, geometry.width / 2 - 8);
  return { x: Math.max(half + 8, Math.min(geometry.width - half - 8, x)), y: Math.max(labelHeight + 8, geometry.top - 9) };
}

export function enemyIntentLabel(intent: EnemyIntent): string { return intent.type === 'heal' ? `回復 +${intent.amount}` : '通常投入'; }
