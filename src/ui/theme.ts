import type { Axis, Owner } from '../core/index.ts';

export const ownerTheme: Record<Owner, { color: number; dark: number; label: string; glyph: string }> = {
  player: { color: 0xf4c77b, dark: 0x6b4f25, label: 'あなた', glyph: 'P' },
  enemy: { color: 0x7eced4, dark: 0x295a68, label: '敵', glyph: 'E' },
  neutral: { color: 0xa6acba, dark: 0x454c60, label: '中立', glyph: 'N' },
};
export const axisLabel: Record<Axis, string> = {
  vertical: '縦', horizontal: '横', 'diagonal-down': '斜め ↘', 'diagonal-up': '斜め ↗',
};
