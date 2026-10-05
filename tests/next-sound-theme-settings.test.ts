import test from 'node:test';
import assert from 'node:assert/strict';
import { mountSoundThemeSettings, soundThemeSettingsKey, parseSoundThemeSettings, readSoundThemeSettings, saveSoundThemeSettings, parseSoundThemeSelection, readSoundThemeSelection } from '../src/next/audio/soundThemeSettings.ts';
import type { SettingsStorage } from '../src/next/audio/presentationSettings.ts';
import { harness, deferred, tick } from './helpers/themedAudioHarness.ts';
class Node {
  id = ''; type = ''; className = ''; htmlFor = ''; textContent = ''; value = ''; hidden = false; removed = false;
  attrs = new Map<string, string>(); children: Node[] = []; handlers = new Map<string, () => void>();
  setAttribute(k: string, v: string) { this.attrs.set(k, v); }
  append(...nodes: Node[]) { this.children.push(...nodes); }
  addEventListener(k: string, fn: () => void) { this.handlers.set(k, fn); }
  removeEventListener(k: string) { this.handlers.delete(k); }
  dispatch(k: string) { this.handlers.get(k)?.(); }
  remove() { this.removed = true; }
  find(id: string): Node | undefined { if (this.id === id) return this; return this.children.map(node => node.find(id)).find(Boolean); }
}
const store = (seed: Record<string, string> = {}) => {
  const values = new Map(Object.entries(seed)); let writes = 0;
  return { values, get writes() { return writes; }, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { writes++; values.set(key, value); } };
};
function mounted(s: ReturnType<typeof harness>, storage: SettingsStorage | null = store()) {
  const previous = globalThis.document, host = new Node(); globalThis.document = { createElement: () => new Node() } as unknown as Document;
  const unmount = mountSoundThemeSettings(s.audio, host as unknown as HTMLElement, { storage, pathname: '/night-qa/' });
  const select = host.find('sound-theme')!, retry = host.find('sound-theme-retry')!, status = host.find('sound-theme-status')!;
  return { host, select, retry, status, choose: (id: string) => { select.value = id; select.dispatch('change'); }, close: () => { unmount(); globalThis.document = previous; } };
}
test('missing, legacy or unknown theme settings fall back to Neon without touching old volume or motion data', () => {
  for (const raw of [null, '', 'null', '[]', '{}', 'no-json', JSON.stringify({ version: 2, theme: 'ice' }), JSON.stringify({ version: 1, theme: 'future' }), JSON.stringify({ version: 1, effectVolume: .4, musicVolume: .3, lowMotion: true, shortAnimations: true })]) assert.equal(parseSoundThemeSettings(raw), 'neon');
  assert.equal(parseSoundThemeSettings(JSON.stringify({ version: 1, theme: 'ice' })), 'ice');
  const old = JSON.stringify({ version: 1, effectVolume: .4, musicVolume: .3, lowMotion: true, shortAnimations: true });
  const s = store({ 'game1-next-presentation-settings-v1': old, 'game1-next-save-v1': 'untouched' });
  const key = soundThemeSettingsKey('/next/'); assert.equal(readSoundThemeSettings(s, key), 'neon'); assert.equal(s.writes, 0);
  assert.equal(saveSoundThemeSettings(s, key, 'dark'), true); assert.equal(readSoundThemeSettings(s, key), 'dark');
  assert.equal(s.values.get('game1-next-presentation-settings-v1'), old); assert.equal(s.values.get('game1-next-save-v1'), 'untouched'); assert.equal(s.values.size, 3);
});
test('night QA, older protected previews and production each use isolated theme keys', () => {
  const routes = ['next', 'save-preview', 'build-ui-preview', 'audio-asset-preview', 'night-qa'];
  const keys = routes.map(route => soundThemeSettingsKey(`/${route}/`)); assert.equal(new Set(keys).size, 5);
  assert.equal(soundThemeSettingsKey('/night-qa'), 'game1-night-qa-sound-theme-v1'); assert.equal(soundThemeSettingsKey('/night-qa/fixture'), keys[4]); assert.equal(soundThemeSettingsKey('/night-qa-other/'), keys[0]);
});
test('storage exceptions preserve session controls and report failed saves', async () => {
  const denied = { getItem() { throw Error('denied'); }, setItem() { throw Error('quota'); } };
  assert.equal(readSoundThemeSettings(denied, 'k'), 'neon'); assert.equal(saveSoundThemeSettings(denied, 'k', 'ice'), false); assert.equal(saveSoundThemeSettings(null, 'k', 'ice'), false);
  const s = harness(), m = mounted(s, denied);
  try { m.choose('ice'); await tick(); assert.equal(s.audio.effectsThemeId, 'ice'); assert.match(m.status.textContent, /保存できません/); assert.equal(s.creates, 0); } finally { m.close(); s.audio.destroy(); }
});
test('mount restores selected theme with no write, context, fetch or autoplay, preserving volume', async () => {
  const storage = store({ 'game1-night-qa-sound-theme-v1': JSON.stringify({ version: 1, theme: 'intellectual' }) });
  const s = harness(); s.audio.setVolume('effect', .35); s.audio.setVolume('music', 0); const m = mounted(s, storage);
  try { await tick(); assert.equal(m.select.value, 'intellectual'); assert.equal(m.select.children.length, 12); assert.equal(s.audio.effectsThemeId, 'intellectual'); assert.equal(storage.writes, 0); assert.equal(s.creates, 0); assert.equal(s.fetched.length, 0); assert.equal(s.active.length, 0); assert.equal(m.retry.hidden, true); assert.equal(m.status.hidden,true);
    m.choose('fire'); await tick(); assert.equal(storage.writes, 1); assert.equal(readSoundThemeSettings(storage, 'game1-night-qa-sound-theme-v1'), 'fire'); assert.equal(s.creates, 0); assert.equal(s.audio.getVolume('effect'), .35); assert.equal(s.audio.getVolume('music'), 0);
  } finally { m.close(); s.audio.destroy(); }
});
test('failed selected theme has visible retry, and retry restores ready without playing a test cue', async () => {
  let fail = true; const s = harness(async url => { if (fail && url.includes('05_ice')) throw Error('missing'); return { ok: true, arrayBuffer: async () => new TextEncoder().encode(url).buffer }; });
  const m = mounted(s);
  try { await s.audio.enableEffectsGesture(); m.choose('ice'); await tick(); assert.equal(m.select.value, 'ice'); assert.equal(s.audio.effectsStatus, 'unavailable'); assert.equal(m.retry.hidden, false); assert.match(m.status.textContent, /停止中/); assert.match(m.retry.textContent, /再試行/); assert.equal(s.active.length, 0);
    fail = false; m.retry.dispatch('click'); await tick(); assert.equal(s.audio.effectsStatus, 'ready'); assert.equal(m.retry.hidden, true); assert.equal(m.status.hidden,true); assert.equal(s.active.length, 0);
  } finally { m.close(); s.audio.destroy(); }
});
test('rapid selection status and saved choice remain current after stale rejection and after unmount', async () => {
  const pending = deferred<ArrayBuffer>(), storage = store(), s = harness(async url => ({ ok: true, arrayBuffer: () => url.includes('01_cute') ? pending.promise : Promise.resolve(new TextEncoder().encode(url).buffer) }));
  const m = mounted(s, storage);
  try { await s.audio.enableEffectsGesture(); m.choose('cute'); await tick(); assert.match(m.status.textContent, /読込中/); assert.equal(m.select.attrs.get('aria-busy'), 'true');
    m.choose('space'); await tick(); assert.equal(m.select.value, 'space'); pending.reject(Error('stale')); await tick(); assert.equal(m.select.value, 'space'); assert.equal(m.status.hidden,true); assert.equal(readSoundThemeSettings(storage, 'game1-night-qa-sound-theme-v1'), 'space');
  } finally { m.close(); s.audio.destroy(); }
  const waiting = deferred<ArrayBuffer>(), t = harness(async () => ({ ok: true, arrayBuffer: () => waiting.promise })), view = mounted(t);
  const enabling = t.audio.enableEffectsGesture(); await tick(); const text = view.status.textContent; view.close(); waiting.resolve(new ArrayBuffer(1)); await enabling; await tick(); assert.equal(view.status.textContent, text); assert.equal(view.host.children[0]!.removed, true); t.audio.destroy();
});


test('fresh or malformed selection defaults to character mode, explicit stored Neon remains global', async () => {
  for (const raw of [null, '', 'null', '[]', '{}', 'no-json', JSON.stringify({ version: 2, theme: 'ice' }), JSON.stringify({ version: 1, theme: 'future' })]) assert.equal(parseSoundThemeSelection(raw), 'character');
  for (const theme of ['neon', 'intellectual', 'fire'] as const) assert.equal(parseSoundThemeSelection(JSON.stringify({ version: 1, theme })), theme);
  for (const saved of [null, JSON.stringify({ version: 1, theme: 'neon' })]) {
    const storage = store(saved ? { 'game1-night-qa-sound-theme-v1': saved } : {});
    const s = harness(), m = mounted(s, storage);
    try {
      await tick(); assert.equal(s.audio.effectsMode, saved ? 'global' : 'character'); assert.equal(m.select.value, saved ? 'neon' : 'character');
      assert.equal(s.creates, 0); assert.equal(s.fetched.length, 0); assert.equal(s.active.length, 0); assert.equal(storage.writes, 0);
      assert.equal(m.host.find('sound-theme-description'), undefined);
    } finally { m.close(); s.audio.destroy(); }
  }
});

test('character choice persists in its own route and restores silently for the current player', async () => {
  const storage = store({ 'game1-next-sound-theme-v1': JSON.stringify({ version: 1, theme: 'ice' }) });
  const s = harness(), m = mounted(s, storage);
  try {
    m.choose('fire'); await tick(); assert.equal(s.audio.effectsMode, 'global');
    m.choose('character'); await tick(); assert.equal(s.audio.effectsMode, 'character');
    assert.equal(readSoundThemeSelection(storage, 'game1-night-qa-sound-theme-v1'), 'character');
    assert.equal(readSoundThemeSelection(storage, 'game1-next-sound-theme-v1'), 'ice');
    await s.audio.setPlayerCharacter('red'); assert.equal(m.status.hidden,true); assert.equal(s.audio.effectsPlayerCharacter,'red');
    assert.equal(s.fetched.length, 0); assert.equal(s.active.length, 0);
  } finally { m.close(); s.audio.destroy(); }
  const t = harness(); await t.audio.setPlayerCharacter('red'); const restored = mounted(t, storage);
  try { await tick(); assert.equal(restored.select.value, 'character'); assert.equal(restored.status.hidden,true); assert.equal(t.audio.effectsPlayerCharacter,'red'); assert.equal(t.creates, 0); assert.equal(t.active.length, 0); }
  finally { restored.close(); t.audio.destroy(); }
});
