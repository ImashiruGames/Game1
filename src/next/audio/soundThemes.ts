import { NEON_AUDIO_ASSETS } from './neonAudioAssets.ts';
import type { EffectAssets } from './sampleAssets.ts';

/** Compiled from the reviewed catalog; runtime never fetches all 50 assets.
 * Files remain byte-identical at /docs/audio/audio/. Themes only change sound. */
export const SOUND_THEME_CATALOG_SHA256 = '3e487a6008fba4489cbe434ab68637e97367a39606bc23f783dedd1303631ee6';
export const SOUND_THEME_IDS = ['neon', 'cute', 'cool', 'intellectual', 'fire', 'ice', 'thunder', 'dark', 'light', 'machine', 'space'] as const;
export type SoundThemeId = typeof SOUND_THEME_IDS[number];
export interface SoundTheme {
  readonly id: SoundThemeId;
  readonly label: string;
  readonly description: string;
  readonly effects: EffectAssets;
}
/** linkSmall=3 links, linkMedium=4, linkLarge=5+; thresholds live in
 * ATTACK_SAMPLE_RULES in sampleAssets.ts. Shape/direct cue only actual HP loss. */
export const SOUND_THEMES: readonly SoundTheme[] = [
  { id: 'neon', label: 'Neon（標準）', description: 'これまでのリンク攻撃3音', effects: NEON_AUDIO_ASSETS.effects },
  { id: 'cute', label: 'かわいい', description: '弾む泡と柔らかい木質', effects: {
    strike: { url: '/docs/audio/audio/01_cute_link_small.wav' },
    crush: { url: '/docs/audio/audio/01_cute_link_medium.wav' },
    breaker: { url: '/docs/audio/audio/01_cute_link_large.wav' },
    shapeDamage: { url: '/docs/audio/audio/01_cute_shape_damage.wav' },
    directDamage: { url: '/docs/audio/audio/01_cute_direct_damage.wav' },
  } },
  { id: 'cool', label: 'かっこいい', description: '鋭い合金と装甲', effects: {
    strike: { url: '/docs/audio/audio/02_cool_link_small.wav' },
    crush: { url: '/docs/audio/audio/02_cool_link_medium.wav' },
    breaker: { url: '/docs/audio/audio/02_cool_link_large.wav' },
    shapeDamage: { url: '/docs/audio/audio/02_cool_shape_damage.wav' },
    directDamage: { url: '/docs/audio/audio/02_cool_direct_damage.wav' },
  } },
  { id: 'intellectual', label: '知的', description: '精密なガラス機構', effects: {
    strike: { url: '/docs/audio/audio/03_intellectual_link_small.wav' },
    crush: { url: '/docs/audio/audio/03_intellectual_link_medium.wav' },
    breaker: { url: '/docs/audio/audio/03_intellectual_link_large.wav' },
    shapeDamage: { url: '/docs/audio/audio/03_intellectual_shape_damage.wav' },
    directDamage: { url: '/docs/audio/audio/03_intellectual_direct_damage.wav' },
  } },
  { id: 'fire', label: '炎', description: '短い燃焼と火花', effects: {
    strike: { url: '/docs/audio/audio/04_fire_link_small.wav' },
    crush: { url: '/docs/audio/audio/04_fire_link_medium.wav' },
    breaker: { url: '/docs/audio/audio/04_fire_link_large.wav' },
    shapeDamage: { url: '/docs/audio/audio/04_fire_shape_damage.wav' },
    directDamage: { url: '/docs/audio/audio/04_fire_direct_damage.wav' },
  } },
  { id: 'ice', label: '氷', description: '結晶の割れ', effects: {
    strike: { url: '/docs/audio/audio/05_ice_link_small.wav' },
    crush: { url: '/docs/audio/audio/05_ice_link_medium.wav' },
    breaker: { url: '/docs/audio/audio/05_ice_link_large.wav' },
    shapeDamage: { url: '/docs/audio/audio/05_ice_shape_damage.wav' },
    directDamage: { url: '/docs/audio/audio/05_ice_direct_damage.wav' },
  } },
  { id: 'thunder', label: '雷', description: '放電と短い雷鳴', effects: {
    strike: { url: '/docs/audio/audio/06_thunder_link_small.wav' },
    crush: { url: '/docs/audio/audio/06_thunder_link_medium.wav' },
    breaker: { url: '/docs/audio/audio/06_thunder_link_large.wav' },
    shapeDamage: { url: '/docs/audio/audio/06_thunder_shape_damage.wav' },
    directDamage: { url: '/docs/audio/audio/06_thunder_direct_damage.wav' },
  } },
  { id: 'dark', label: '闇', description: '低い空洞と封印', effects: {
    strike: { url: '/docs/audio/audio/07_dark_link_small.wav' },
    crush: { url: '/docs/audio/audio/07_dark_link_medium.wav' },
    breaker: { url: '/docs/audio/audio/07_dark_link_large.wav' },
    shapeDamage: { url: '/docs/audio/audio/07_dark_shape_damage.wav' },
    directDamage: { url: '/docs/audio/audio/07_dark_direct_damage.wav' },
  } },
  { id: 'light', label: '光', description: '丸い輝きと放射', effects: {
    strike: { url: '/docs/audio/audio/08_light_link_small.wav' },
    crush: { url: '/docs/audio/audio/08_light_link_medium.wav' },
    breaker: { url: '/docs/audio/audio/08_light_link_large.wav' },
    shapeDamage: { url: '/docs/audio/audio/08_light_shape_damage.wav' },
    directDamage: { url: '/docs/audio/audio/08_light_direct_damage.wav' },
  } },
  { id: 'machine', label: '機械', description: '歯車と装甲', effects: {
    strike: { url: '/docs/audio/audio/09_machine_link_small.wav' },
    crush: { url: '/docs/audio/audio/09_machine_link_medium.wav' },
    breaker: { url: '/docs/audio/audio/09_machine_link_large.wav' },
    shapeDamage: { url: '/docs/audio/audio/09_machine_shape_damage.wav' },
    directDamage: { url: '/docs/audio/audio/09_machine_direct_damage.wav' },
  } },
  { id: 'space', label: '宇宙', description: '重力と歪んだ空間', effects: {
    strike: { url: '/docs/audio/audio/10_space_link_small.wav' },
    crush: { url: '/docs/audio/audio/10_space_link_medium.wav' },
    breaker: { url: '/docs/audio/audio/10_space_link_large.wav' },
    shapeDamage: { url: '/docs/audio/audio/10_space_shape_damage.wav' },
    directDamage: { url: '/docs/audio/audio/10_space_direct_damage.wav' },
  } },
 ];
export function normalizeSoundTheme(value: unknown): SoundThemeId {
  return SOUND_THEME_IDS.includes(value as SoundThemeId) ? value as SoundThemeId : 'neon';
}
export function soundTheme(value: unknown): SoundTheme {
  const id = normalizeSoundTheme(value);
  return SOUND_THEMES.find(theme => theme.id === id)!;
}
