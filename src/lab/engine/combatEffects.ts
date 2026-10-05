import type { Hp } from './types.ts';

export interface HpChange {
  readonly hp: Hp;
  readonly before: number;
  readonly after: number;
  /** Actual lost/recovered HP excludes damage beyond zero and healing beyond maximum. */
  readonly actual: number;
  readonly amount: number;
  readonly overkill: number;
}
/** 日本語: HPの数値計算は純粋関数に集約し、演出・ゲージ・反応効果から共有する。
 * English: Pure HP arithmetic is shared by actions, resource charging and reactive effects. */
export function damageHp(hp: Hp, amount: number): HpChange {
  const after = hp.current - amount;
  return { hp: { ...hp, current: after }, before: hp.current, after, amount,
    actual: Math.min(Math.max(0, hp.current), amount), overkill: Math.max(0, amount - Math.max(0, hp.current)) };
}
export function healHp(hp: Hp, requested: number): HpChange {
  const amount = Math.max(0, Math.min(requested, hp.max - hp.current));
  const after = hp.current + amount;
  return { hp: { ...hp, current: after }, before: hp.current, after, actual: amount, amount, overkill: 0 };
}
