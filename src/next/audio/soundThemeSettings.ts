import type { EffectsMode, SoundCharacter } from './characterSoundThemes.ts';
import { SOUND_THEMES, normalizeSoundTheme, soundTheme } from './soundThemes.ts';
import type { SoundThemeId } from './soundThemes.ts';
import type { EffectAssets } from './sampleAssets.ts';
import type { AudioStatus } from './SampleAudioDirector.ts';
import type { SettingsStorage } from './presentationSettings.ts';

/** Separate from battle-save and existing volume/motion preferences.
 * QA routes are isolated from production and from the protected older preview. */
export function soundThemeSettingsKey(pathname: string): string {
  const route = ['save-preview', 'build-ui-preview', 'audio-asset-preview', 'night-qa','energy-qa'].find(name => pathname === `/${name}` || pathname.startsWith(`/${name}/`));
  return `game1-${route ?? 'next'}-sound-theme-v1`;
}
export function parseSoundThemeSettings(raw: string | null): SoundThemeId {
  try {
    const data: unknown = raw === null ? null : JSON.parse(raw);
    if (!data || typeof data !== 'object' || !('version' in data) || data.version !== 1 || !('theme' in data)) return 'neon';
    return normalizeSoundTheme(data.theme);
  } catch { return 'neon'; }
}
export function readSoundThemeSettings(storage: SettingsStorage | null, key: string): SoundThemeId {
  try { return parseSoundThemeSettings(storage?.getItem(key) ?? null); } catch { return 'neon'; }
}
export function saveSoundThemeSettings(storage: SettingsStorage | null, key: string, theme: SoundThemeId): boolean {
  try { if (!storage) return false; storage.setItem(key, JSON.stringify({ version: 1, theme: normalizeSoundTheme(theme) })); return true; } catch { return false; }
}
/** The existing key and manual {version:1,theme} values remain valid. Only the
 * new selector value is added; battle-save and volume/motion schemas are untouched. */
export type SoundThemeSelection = SoundThemeId | 'character';
export function parseSoundThemeSelection(raw: string | null): SoundThemeSelection {
  try {
    const data: unknown = raw === null ? null : JSON.parse(raw);
    if (!data || typeof data !== 'object' || !('version' in data) || data.version !== 1 || !('theme' in data)) return 'character';
    if (data.theme === 'character') return 'character';
    const normalized = normalizeSoundTheme(data.theme);
    return normalized === data.theme ? normalized : 'character';
  } catch { return 'character'; }
}
export function readSoundThemeSelection(storage: SettingsStorage | null, key: string): SoundThemeSelection {
  try { return parseSoundThemeSelection(storage?.getItem(key) ?? null); } catch { return 'character'; }
}
export function saveSoundThemeSelection(storage: SettingsStorage | null, key: string, selected: SoundThemeSelection): boolean {
  if (selected !== 'character') return saveSoundThemeSettings(storage, key, selected);
  try { if (!storage) return false; storage.setItem(key, JSON.stringify({ version: 1, theme: 'character' })); return true; } catch { return false; }
}
export interface SoundThemeControl {
  readonly effectsEnabled: boolean;
  readonly effectsStatus: AudioStatus;
  readonly effectsThemeId: string;
  readonly effectsMode?: EffectsMode;
  readonly effectsPlayerCharacter?: SoundCharacter;
  setEffectsMode?(mode: EffectsMode): Promise<boolean>;
  setEffectsTheme(id: string, assets: EffectAssets): Promise<boolean>;
  enableEffectsGesture(): Promise<boolean>;
  subscribe(listener: () => void): () => void;
}
export interface SoundThemeSettingsOptions { readonly storage?: SettingsStorage | null; readonly pathname?: string }
/** Compact settings-only selector. Changing a theme never plays an audition cue. */
export function mountSoundThemeSettings(control: SoundThemeControl, host: HTMLElement, options: SoundThemeSettingsOptions = {}): () => void {
  let storage = options.storage ?? null;
  if (options.storage === undefined) { try { storage = localStorage; } catch { /* Keep session controls usable. */ } }
  const key = soundThemeSettingsKey(options.pathname ?? (typeof window === 'undefined' ? '/next/' : window.location.pathname));
  const section = document.createElement('section'); section.className = 'settings sound-theme-settings';
  const label = document.createElement('label'); label.htmlFor = 'sound-theme'; label.textContent = '効果音のテーマ';
  const select = document.createElement('select'); select.id = 'sound-theme'; select.setAttribute('aria-describedby', 'sound-theme-status');
  if (control.setEffectsMode) { const option = document.createElement('option'); option.value = 'character'; option.textContent = 'キャラ別'; select.append(option); }
  for (const theme of SOUND_THEMES) { const option = document.createElement('option'); option.value = theme.id; option.textContent = theme.label; select.append(option); }
  const status = document.createElement('p'); status.id = 'sound-theme-status'; status.setAttribute('role', 'status');
  const retry = document.createElement('button'); retry.type = 'button'; retry.id = 'sound-theme-retry'; retry.textContent = '効果音を再試行'; retry.hidden = true;
  label.append(select);
  section.append(label, status, retry); host.append(section);
  let disposed = false, savingFailed = false;
  const update = () => {
    if (disposed) return;
    const selected = soundTheme(control.effectsThemeId), state = control.effectsStatus;
    const byCharacter = control.effectsMode === 'character';
    select.value = byCharacter ? 'character' : selected.id;
    // 日本語: 常設の説明は省き、操作が必要な失敗・中断だけ知らせる。
    // English: Keep only actionable failures or suspension, not permanent theme prose.
    status.textContent = savingFailed ? '設定を保存できませんでした' : state === 'loading' ? '読込中' : state === 'unavailable' ? '効果音を読み込めませんでした・停止中' : state === 'resume' && control.effectsEnabled ? '効果音は中断中です' : '';
    status.hidden = !status.textContent;
    select.setAttribute('aria-busy', String(state === 'loading'));
    retry.hidden = !control.effectsEnabled || (state !== 'unavailable' && state !== 'resume');
    retry.textContent = state === 'resume' ? '効果音を再開' : '効果音を再試行';
  };
  const apply = (value: SoundThemeSelection) => {
    if (value === 'character' && control.setEffectsMode) return control.setEffectsMode('character');
    const selected = soundTheme(value);
    return control.setEffectsTheme(selected.id, selected.effects);
  };
  const choose = () => {
    const selected = select.value === 'character' && control.setEffectsMode ? 'character' : soundTheme(select.value).id;
    savingFailed = !saveSoundThemeSelection(storage, key, selected);
    // Runtime revokes the old route synchronously; late completion cannot restore it.
    void apply(selected).catch(() => false).then(update); update();
  };
  const retryClick = () => { void control.enableEffectsGesture().catch(() => false).then(update); update(); };
  select.addEventListener('change', choose); retry.addEventListener('click', retryClick);
  const off = control.subscribe(update);
  const initial = readSoundThemeSelection(storage, key);
  // The default runtime is OFF: restore selects the manifest without context/fetch/play.
  void apply(initial).catch(() => false).then(update); update();
  return () => { disposed = true; off(); select.removeEventListener('change', choose); retry.removeEventListener('click', retryClick); section.remove(); };
}
