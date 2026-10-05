import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { SOUND_THEMES, SOUND_THEME_IDS, SOUND_THEME_CATALOG_SHA256, soundTheme, normalizeSoundTheme } from '../src/next/audio/soundThemes.ts';
import { CHARACTER_TRANSFORMATION_ASSETS } from '../src/next/audio/transformationAssets.ts';
import { NEON_AUDIO_ASSETS } from '../src/next/audio/neonAudioAssets.ts';
import { ATTACK_SAMPLE_RULES, EFFECT_SAMPLE_PRIORITY, sampleForBattleEvent, damageSampleForBattleEvent } from '../src/next/audio/sampleAssets.ts';
import { SAMPLE_MASTER_GAIN, SAMPLE_MUSIC_GAIN } from '../src/next/audio/SampleAudioDirector.ts';
import { attack, damage, deferred, tick, harness, Gain } from './helpers/themedAudioHarness.ts';
const choose = (s: ReturnType<typeof harness>, id: string) => { const theme = soundTheme(id); return s.audio.setEffectsTheme(theme.id, theme.effects); };

test('compiled 10 by 5 theme manifest exactly matches immutable published WAV hashes', () => {
  const hashes = JSON.parse(readFileSync(new URL('./fixtures/sound-theme-hashes.json', import.meta.url), 'utf8')) as { catalogSha256: string; wavAssets: Record<string, string> };
  const catalogBytes = readFileSync(new URL('../public/docs/audio/catalog.json', import.meta.url));
  assert.equal(createHash('sha256').update(catalogBytes).digest('hex'), SOUND_THEME_CATALOG_SHA256); assert.equal(hashes.catalogSha256, SOUND_THEME_CATALOG_SHA256);
  assert.equal(SOUND_THEMES.length, 11); assert.equal(SOUND_THEME_IDS.length, 11); assert.equal(SOUND_THEMES[0]!.effects, NEON_AUDIO_ASSETS.effects);
  const urls = SOUND_THEMES.slice(1).flatMap(theme => { assert.equal(Object.keys(theme.effects).length, 5); return Object.values(theme.effects).map(asset => asset.url); });
  assert.equal(new Set(urls).size, 50); assert.deepEqual([...urls].sort(), Object.keys(hashes.wavAssets).sort());
  for (const url of urls) { const bytes = readFileSync(new URL(`../public${url}`, import.meta.url)); assert.equal(createHash('sha256').update(bytes).digest('hex'), hashes.wavAssets[url]); }
  for (const invalid of [null, undefined, '', 'new-theme', 1, {}, 'NEON']) assert.equal(normalizeSoundTheme(invalid), 'neon');
});

test('explicit 3/4/5+ rules retain old Neon mapping and extended damage mapping excludes activation duplicates', () => {
  assert.deepEqual(ATTACK_SAMPLE_RULES, [{ minLinks: 5, sample: 'breaker' }, { minLinks: 4, sample: 'crush' }, { minLinks: 3, sample: 'strike' }]);
  for (const [count, sample] of [[2, null], [3, 'strike'], [4, 'crush'], [5, 'breaker'], [18, 'breaker']] as const) assert.equal(sampleForBattleEvent(attack(count)), sample);
  for (const source of ['corner-strike', 'square-strike']) assert.equal(damageSampleForBattleEvent(damage(source)), 'shapeDamage');
  for (const source of ['pain-shared', 'magic-bullet', 'blue-transformation', 'boss-fixed']) assert.equal(damageSampleForBattleEvent(damage(source)), 'directDamage');
  assert.equal(damageSampleForBattleEvent({ ...damage('boss-fixed'), actor: 'enemy', target: 'player' }), 'directDamage');
  // Blue reaction is identified by source and damaged side, including enemy-owned resolution metadata.
  assert.equal(damageSampleForBattleEvent({ ...damage('blue-transformation'), actor: 'enemy' }), 'directDamage');
  assert.equal(damageSampleForBattleEvent({ ...damage('blue-transformation'), target: 'player' }), null);
  for (const source of ['health', 'healing-potion', 'ember', 'new-source']) assert.equal(damageSampleForBattleEvent(damage(source)), null);
  for (const source of ['pain-shared', 'ember', 'magic-bullet', 'corner-strike']) assert.equal(damageSampleForBattleEvent({ ...damage(source), target: 'player' }), null);
  for (const type of ['drop', 'heal', 'shape-effect', 'instant-skill', 'board-skill', 'instant-kill', 'gauge', 'battle-end']) assert.equal(damageSampleForBattleEvent({ ...damage('corner-strike'), type }), null);
});

test('zero actual HP damage never cues, including retained negative overkill HP', () => {
  for (const patch of [{ damage: 0 }, { damage: -1 }, { damage: NaN }, { hpBefore: 0, hpAfter: -5 }, { hpBefore: -1, hpAfter: -6 }, { hpBefore: 10, hpAfter: 10 }, { hpBefore: 10, hpAfter: 11 }, { hpBefore: Infinity }, { hpAfter: NaN }, { hpBefore: undefined }]) {
    assert.equal(sampleForBattleEvent({ ...attack(), ...patch }), null); assert.equal(damageSampleForBattleEvent({ ...damage(), ...patch }), null);
  }
  assert.equal(sampleForBattleEvent({ ...attack(), hpBefore: 1, hpAfter: -4 }), 'strike'); assert.equal(damageSampleForBattleEvent({ ...damage(), hpBefore: 1, hpAfter: -4 }), 'directDamage');
});

test('OFF selections are silent; enabling loads five selected attack WAVs plus the current character transformation with no audition or music', async () => {
  const s = harness(); await choose(s, 'cute'); await choose(s, 'space');
  assert.equal(s.creates, 0); assert.equal(s.fetched.length, 0); assert.equal(s.active.length, 0); assert.equal(s.audio.effectsThemeId, 'space');
  assert.equal(await s.audio.enableEffectsGesture(), true); assert.equal(s.fetched.length, 6); assert.ok(s.fetched.every(url => (url.includes('/10_space_') || url === CHARACTER_TRANSFORMATION_ASSETS.blue.url) && url.endsWith('.wav'))); assert.equal(s.active.length, 0);
  s.audio.playEvent(attack(4), {}, 0); s.flush(); assert.match(s.active[0]!.buffer!.id, /10_space_link_medium.wav$/); s.audio.destroy();
});

test('default Neon loads its existing three and the current transformation and never cues direct or shape hits', async () => {
  const s = harness(); await s.audio.enableEffectsGesture(); assert.deepEqual(s.fetched, [...Object.values(NEON_AUDIO_ASSETS.effects).map(asset => asset.url), CHARACTER_TRANSFORMATION_ASSETS.blue.url]);
  s.audio.playEvent(damage(), {}, 0); s.audio.playEvent(damage('corner-strike'), {}, 1); s.flush(); assert.equal(s.active.length, 0);
  s.audio.playEvent(attack(5), {}, 0); s.flush(); assert.match(s.active[0]!.buffer!.id, /se03_neon_breaker.wav$/); s.audio.destroy();
});

test('rapid A to B to A switch discards old completions and plays only the selected theme', async () => {
  const waiting = deferred<ArrayBuffer>();
  const s = harness(async url => ({ ok: true, arrayBuffer: () => url.includes('01_cute') ? waiting.promise : Promise.resolve(new TextEncoder().encode(url).buffer) }));
  await choose(s, 'cute'); const first = s.audio.enableEffectsGesture(); await tick(); assert.equal(s.audio.effectsStatus, 'loading');
  const oldResolution = {}; s.audio.playEvent(attack(5), oldResolution, 0);
  assert.equal(await choose(s, 'ice'), true); s.audio.playEvent(attack(), {}, 0); s.flush(); assert.match(s.active[0]!.buffer!.id, /05_ice_link_small.wav$/);
  const latest = choose(s, 'cute'); assert.equal(s.active.length, 0); waiting.resolve(new TextEncoder().encode('latest-cute').buffer);
  assert.equal(await first, false); assert.equal(await latest, true); assert.equal(s.audio.effectsThemeId, 'cute');
  s.audio.playEvent(attack(5), oldResolution, 0); s.flush(); assert.equal(s.active.length, 0);
  s.audio.playEvent(attack(), {}, 0); s.flush(); assert.equal(s.active[0]!.buffer!.id, 'latest-cute'); s.audio.destroy();
});

test('stale failed theme cannot overwrite current ready theme or silently fall back', async () => {
  const waiting = deferred<ArrayBuffer>(); const s = harness(async url => ({ ok: true, arrayBuffer: () => url.includes('01_cute') ? waiting.promise : Promise.resolve(new TextEncoder().encode(url).buffer) }));
  await choose(s, 'cute'); const old = s.audio.enableEffectsGesture(); await tick(); await choose(s, 'fire'); waiting.reject(Error('old broken asset'));
  assert.equal(await old, false); assert.equal(s.audio.effectsStatus, 'ready'); assert.equal(s.audio.effectsThemeId, 'fire'); assert.equal(s.audio.getError('effect'), null);
  s.audio.playEvent(damage(), {}, 0); s.flush(); assert.match(s.active[0]!.buffer!.id, /04_fire_direct_damage.wav$/); s.audio.destroy();
});

test('pending theme changes are cancelled by OFF, reset, hide, mute or destroy and restart requires a new gesture', async () => {
  for (const cancel of ['off', 'reset', 'hidden', 'mute', 'destroy'] as const) {
    const waiting = deferred<ArrayBuffer>(), s = harness(async url => ({ ok: true, arrayBuffer: () => url.includes('01_cute') ? waiting.promise : Promise.resolve(new TextEncoder().encode(url).buffer) }));
    await s.audio.enableEffectsGesture(); const loading = choose(s, 'cute'); await tick();
    if (cancel === 'off') s.audio.setEffectsEnabled(false); else if (cancel === 'hidden') s.audio.setHidden(true); else s.audio[cancel]();
    waiting.resolve(new TextEncoder().encode('cute').buffer); assert.equal(await loading, false); s.audio.playEvent(attack(), {}, 0); s.flush(); assert.equal(s.active.length, 0);
    if (cancel !== 'destroy') { s.audio.setHidden(false); assert.equal(await s.audio.enableEffectsGesture(), true); s.audio.playEvent(attack(), {}, 0); s.flush(); assert.equal(s.active[0]!.buffer!.id, 'cute'); }
    s.audio.destroy();
  }
});

test('switch cancels active effects, aggregate timer and abort listeners before loading next theme', async () => {
  const s = harness(); await choose(s, 'cool'); await s.audio.enableEffectsGesture(); const abort = new AbortController();
  s.audio.playEvent(attack(), {}, 0, abort.signal); s.flush(); const active = s.active[0]!;
  s.audio.playEvent(attack(5), {}, 0); const oldCallback = [...s.timers.values()][0]!.callback;
  await choose(s, 'dark'); assert.equal(active.disconnected, true); assert.equal(s.timers.size, 0); assert.equal(s.active.length, 0);
  s.audio.playEvent(damage(), {}, 0); oldCallback(); s.flush(); assert.equal(s.active.length, 1); assert.match(s.active[0]!.buffer!.id, /07_dark_direct_damage.wav$/);
  abort.abort(); assert.equal(s.active.length, 1); s.audio.destroy();
});

test('theme load failures are visible and retryable with no old-theme fallback and no BGM restart', async () => {
  let fail = true;
  const s = harness(async url => { if (fail && url.includes('09_machine')) throw Error('offline'); return { ok: true, arrayBuffer: async () => new TextEncoder().encode(url).buffer }; });
  s.audio.setVolume('effect', .4); s.audio.setVolume('music', .3); await s.audio.enableMusicGesture(); const music = s.active[0]!;
  await s.audio.enableEffectsGesture(); s.audio.playEvent(attack(), {}, 0); s.flush(); assert.equal(s.active.length, 2);
  assert.equal(await choose(s, 'machine'), false); assert.equal(s.audio.effectsThemeId, 'machine'); assert.equal(s.audio.effectsStatus, 'unavailable'); assert.ok(s.audio.getError('effect'));
  s.audio.playEvent(attack(), {}, 0); s.flush(); assert.equal(s.active.length, 1); assert.equal(s.active[0], music); assert.equal(music.disconnected, false);
  fail = false; assert.equal(await s.audio.enableEffectsGesture(), true); assert.equal(s.active.length, 1);
  s.audio.playEvent(attack(), {}, 0); s.flush(); assert.match(s.active.find(source => !source.loop)!.buffer!.id, /09_machine_link_small.wav$/);
  assert.equal(s.audio.getVolume('effect'), .4); assert.equal(s.audio.getVolume('music'), .3); assert.equal(music.loopStart, 0); assert.equal(music.loopEnd, 43.6376); assert.equal(music.offset, 0);
  const musicBus = music.destination!.destination as Gain, master = musicBus.destination as Gain;
  assert.equal(musicBus.gain.values.at(-1)!.value, .3 * SAMPLE_MUSIC_GAIN); assert.equal(master.gain.values.at(-1)!.value, SAMPLE_MASTER_GAIN); s.audio.destroy();
});

test('new cues keep one 80ms highest-priority batch, two voices including fade, and no decode on event path', async () => {
  const s = harness(); await choose(s, 'thunder'); await s.audio.enableEffectsGesture(); const decodes = s.context.decodes;
  assert.ok(EFFECT_SAMPLE_PRIORITY.shapeDamage > EFFECT_SAMPLE_PRIORITY.directDamage); assert.ok(EFFECT_SAMPLE_PRIORITY.directDamage > EFFECT_SAMPLE_PRIORITY.breaker);
  for (const event of [attack(3), damage(), attack(5), damage('square-strike')]) s.audio.playEvent(event, {}, 0);
  assert.equal(s.timers.size, 1); assert.equal([...s.timers.values()][0]!.ms, 80); s.flush(); assert.match(s.active[0]!.buffer!.id, /shape_damage.wav$/);
  s.audio.setFastMode(true);
  for (let i = 0; i < 12; i++) { s.context.advance(.001); s.audio.playEvent(damage(), {}, 0); assert.equal([...s.timers.values()][0]!.ms, 80); s.flush(); assert.ok(s.active.length <= 2); }
  assert.equal(s.context.decodes, decodes); assert.equal(s.fetched.length, 6); s.audio.destroy();
});

test('aborted direct/shape events cannot win, revive, or duplicate a shape cue', async () => {
  const s = harness(); await choose(s, 'light'); await s.audio.enableEffectsGesture(); const abort = new AbortController(), resolution = {};
  s.audio.playEvent({ ...damage('corner-strike'), type: 'shape-effect' }, resolution, 0);
  s.audio.playEvent(damage('corner-strike'), resolution, 1, abort.signal); s.audio.playEvent(damage(), resolution, 2); abort.abort(); s.flush();
  assert.equal(s.active.length, 1); assert.match(s.active[0]!.buffer!.id, /direct_damage.wav$/);
  s.audio.reset(); s.audio.playEvent(damage('corner-strike'), resolution, 1); s.flush(); assert.equal(s.active.length, 0); s.audio.destroy();
});

test('A loading then B ready then OFF cannot be revived by either late A success or failure', async () => {
  for (const rejects of [false, true]) {
    const waiting = deferred<ArrayBuffer>(), s = harness(async url => ({ ok: true, arrayBuffer: () => url.includes('01_cute') ? waiting.promise : Promise.resolve(new TextEncoder().encode(url).buffer) }));
    await choose(s, 'cute'); const first = s.audio.enableEffectsGesture(); await tick(); await choose(s, 'cool'); s.audio.setEffectsEnabled(false);
    if (rejects) waiting.reject(Error('stale')); else waiting.resolve(new TextEncoder().encode('old-cute').buffer);
    assert.equal(await first, false); assert.equal(s.audio.effectsThemeId, 'cool'); assert.equal(s.audio.effectsStatus, 'off'); assert.equal(s.audio.getError('effect'), null);
    s.audio.playEvent(attack(), {}, 0); s.flush(); assert.equal(s.active.length, 0); s.audio.destroy();
  }
});

test('hidden theme switch and return alone stay silent; zero volume is preserved through the next explicit gesture', async () => {
  const s = harness(); s.audio.setVolume('effect', 0); await s.audio.enableEffectsGesture(); s.audio.setHidden(true);
  const fetched = s.fetched.length; assert.equal(await choose(s, 'space'), false); s.audio.setHidden(false); s.context.state = 'running'; s.context.onstatechange?.();
  assert.equal(s.audio.effectsStatus, 'resume'); assert.equal(s.fetched.length, fetched); s.audio.playEvent(attack(), {}, 0); s.flush(); assert.equal(s.active.length, 0);
  assert.equal(await s.audio.enableEffectsGesture(), true); assert.equal(s.active.length, 0); assert.equal(s.audio.getVolume('effect'), 0);
  s.audio.playEvent(attack(), {}, 0); s.flush(); const bus = s.active[0]!.destination!.destination as Gain; assert.equal(bus.gain.values.at(-1)!.value, 0); s.audio.destroy();
});

test('damaged WAV decode failure is silent and a user retry refetches the failed asset', async () => {
  const s = harness(); await s.audio.enableEffectsGesture(); const original = s.context.decodeAudioData.bind(s.context); let fail = true;
  s.context.decodeAudioData = async data => { if (fail && new TextDecoder().decode(data).includes('10_space_shape_damage')) throw Error('bad WAV'); return original(data); };
  assert.equal(await choose(s, 'space'), false); assert.equal(s.audio.effectsStatus, 'unavailable'); s.audio.playEvent(attack(), {}, 0); s.flush(); assert.equal(s.active.length, 0);
  fail = false; assert.equal(await s.audio.enableEffectsGesture(), true); assert.equal(s.fetched.filter(url => url.includes('10_space_shape_damage')).length, 2);
  s.audio.playEvent(damage('square-strike'), {}, 0); s.flush(); assert.match(s.active[0]!.buffer!.id, /10_space_shape_damage.wav$/); s.audio.destroy();
});
