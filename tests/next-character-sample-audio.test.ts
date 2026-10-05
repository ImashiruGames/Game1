import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTER_EFFECT_THEMES } from '../src/next/audio/characterSoundThemes.ts';
import { CHARACTER_TRANSFORMATION_ASSETS } from '../src/next/audio/transformationAssets.ts';
import { playTransformationWithSample } from '../src/next/audio/transformationSampleAudio.ts';
import { soundTheme } from '../src/next/audio/soundThemes.ts';
import { NEON_AUDIO_ASSETS } from '../src/next/audio/neonAudioAssets.ts';
import { SAMPLE_MASTER_GAIN } from '../src/next/audio/SampleAudioDirector.ts';
import { attack, damage, deferred, tick, harness, Gain } from './helpers/themedAudioHarness.ts';
import type { SampleBattleEvent } from '../src/next/audio/sampleAssets.ts';
import type { TransformationRequest, TransformationResult } from '../src/next/ui/transformationCinematic.ts';

const transform = (character: 'blue' | 'red' = 'blue'): SampleBattleEvent => ({ type: 'transformation', character });
const choose = (s: ReturnType<typeof harness>, id: string) => { const t = soundTheme(id); return s.audio.setEffectsTheme(t.id, t.effects); };
const lastEffect = (s: ReturnType<typeof harness>) => s.active.filter(voice => !voice.loop).at(-1)!;
const play = (s: ReturnType<typeof harness>, event: SampleBattleEvent) => { s.audio.playEvent(event, {}, 0); s.flush(); return lastEffect(s); };
const request = (signal?: AbortSignal): TransformationRequest => ({ eventId: {}, event: { type: 'transformation', character: 'blue' }, beforeSrc: 'before.png', afterSrc: 'after.png', signal });

test('character mode is presentation-only, OFF stays unloaded and enable fetches only current player plus enemy PCM', async () => {
  const s = harness();
  assert.deepEqual(CHARACTER_EFFECT_THEMES, { blue: 'intellectual', red: 'fire', enemy: 'neon' });
  await s.audio.setEffectsMode('character');
  const muted = {}; s.audio.playEvent(transform(), muted, 0);
  assert.equal(s.audio.effectsMode, 'character'); assert.equal(s.creates, 0); assert.equal(s.fetched.length, 0);
  await s.audio.enableEffectsGesture();
  assert.equal(s.fetched.length, 9); assert.equal(s.context.decodes, 9);
  assert.ok(s.fetched.every(url => url.includes('03_intellectual_') || url.includes('/neon-v1/se0') || url === CHARACTER_TRANSFORMATION_ASSETS.blue.url));
  assert.equal(s.active.length, 0);
  s.audio.playEvent(transform(), muted, 0); s.flush(); assert.equal(s.active.length, 0);
  s.audio.destroy();
});

test('Blue and Red attacks route by attacker; enemy always retains its separate Neon palette', async () => {
  const s = harness(); await s.audio.setEffectsMode('character'); await s.audio.enableEffectsGesture();
  assert.match(play(s, attack()).buffer!.id, /03_intellectual_link_small.wav$/);
  assert.match(play(s, { ...attack(4), actor: 'enemy', target: 'player' }).buffer!.id, /se02_neon_crush.wav$/);
  assert.match(play(s, damage('square-strike')).buffer!.id, /03_intellectual_shape_damage.wav$/);
  // Reaction actor can carry the enemy resolution metadata, but damage is Blue-owned.
  assert.match(play(s, { ...damage('blue-transformation'), actor: 'enemy' }).buffer!.id, /03_intellectual_direct_damage.wav$/);
  const creates = s.creates;
  await s.audio.setPlayerCharacter('red'); assert.equal(s.creates, creates); assert.equal(s.fetched.length, 15);
  assert.match(play(s, attack(5)).buffer!.id, /04_fire_link_large.wav$/);
  assert.match(play(s, { ...attack(5), actor: 'enemy', target: 'player' }).buffer!.id, /se03_neon_breaker.wav$/);
  const fetched = s.fetched.length, decodes = s.context.decodes;
  await s.audio.setPlayerCharacter('red'); assert.equal(s.fetched.length, fetched);
  s.audio.playEvent(attack(), {}, 0, undefined, { playerCharacterId: 'blue' }); s.flush();
  assert.equal(s.fetched.length, fetched); assert.equal(s.context.decodes, decodes);
  // An explicitly mismatched context cannot silently play the current Red voice.
  assert.match(lastEffect(s).buffer!.id, /se03_neon_breaker.wav$/); s.audio.destroy();
});

test('manual attack theme overrides both actors but each transformation retains the player character', async () => {
  const s = harness(); await s.audio.setEffectsMode('character'); await s.audio.setPlayerCharacter('red');
  await choose(s, 'ice'); await s.audio.enableEffectsGesture();
  assert.equal(s.audio.effectsMode, 'global'); assert.equal(s.fetched.length, 6);
  for (const actor of ['player', 'enemy']) assert.match(play(s, { ...attack(), actor, target: actor === 'player' ? 'enemy' : 'player' }).buffer!.id, /05_ice_link_small.wav$/);
  assert.equal(play(s, transform('red')).buffer!.id, CHARACTER_TRANSFORMATION_ASSETS.red.url);
  await s.audio.setPlayerCharacter('blue'); assert.equal(s.fetched.length, 7);
  assert.equal(s.fetched.filter(url => url.includes('05_ice')).length, 5);
  assert.equal(play(s, transform('blue')).buffer!.id, CHARACTER_TRANSFORMATION_ASSETS.blue.url);
  await s.audio.setEffectsMode('character'); assert.equal(s.audio.effectsPlayerCharacter, 'blue');
  assert.match(play(s, attack()).buffer!.id, /03_intellectual_link_small.wav$/);
  await choose(s, 'neon'); assert.equal(play(s, transform()).buffer!.id, CHARACTER_TRANSFORMATION_ASSETS.blue.url); s.audio.destroy();
});

test('transformation has a dedicated PCM slot, plays once per committed event, and never plays enemy or ended forms', async () => {
  const s = harness(); await s.audio.setEffectsMode('character'); await s.audio.enableEffectsGesture();
  const resolution = {}, event = transform(); s.audio.playEvent(event, resolution, 0); s.audio.playEvent(event, resolution, 0);
  assert.equal(s.timers.size, 1); assert.equal([...s.timers.values()][0]!.ms, 80); s.flush();
  assert.equal(s.active.length, 1); assert.equal(lastEffect(s).buffer!.id, CHARACTER_TRANSFORMATION_ASSETS.blue.url);
  s.audio.reset(); s.audio.playEvent(event, resolution, 0); s.flush(); assert.equal(s.active.length, 0);
  for (const invalid of [{ ...event, actor: 'enemy' }, { ...event, character: 'future' }, { ...event, type: 'transformation-ended' }, { type: 'transformation' }]) s.audio.playEvent(invalid, {}, 0);
  s.flush(); assert.equal(s.active.length, 0);
  await s.audio.setPlayerCharacter('red'); assert.equal(play(s, transform('red')).buffer!.id, CHARACTER_TRANSFORMATION_ASSETS.red.url);
  s.audio.destroy();
});

test('transformation loading/mute/hide events are consumed without late replay; restore only selects character', async () => {
  const waiting = deferred<ArrayBuffer>();
  const s = harness(async url => ({ ok: true, arrayBuffer: () => url.includes('03_intellectual') ? waiting.promise : Promise.resolve(new TextEncoder().encode(url).buffer) }));
  await s.audio.setEffectsMode('character'); const enabling = s.audio.enableEffectsGesture(); await tick();
  const loadingResolution = {}; s.audio.playEvent(transform(), loadingResolution, 0);
  waiting.resolve(new TextEncoder().encode('blue').buffer); await enabling;
  s.audio.playEvent(transform(), loadingResolution, 0); s.flush(); assert.equal(s.active.length, 0);
  s.audio.mute(); const mutedResolution = {}; s.audio.playEvent(transform(), mutedResolution, 0);
  await s.audio.setPlayerCharacter('red'); assert.equal(s.fetched.length, 9); assert.equal(s.active.length, 0);
  await s.audio.enableEffectsGesture(); s.audio.playEvent(transform(), mutedResolution, 0); s.flush(); assert.equal(s.active.length, 0);
  s.audio.setHidden(true); const hiddenResolution = {}; s.audio.playEvent(transform('red'), hiddenResolution, 0);
  s.audio.setHidden(false); await s.audio.enableEffectsGesture(); s.audio.playEvent(transform('red'), hiddenResolution, 0); s.flush(); assert.equal(s.active.length, 0);
  s.audio.destroy();
});

test('character updates during hidden/interrupted/resume never invent an audio gesture or fetch', async () => {
  for (const interruption of ['hidden', 'suspended', 'resume'] as const) {
    const s = harness(); await s.audio.setEffectsMode('character'); await s.audio.enableEffectsGesture();
    if (interruption === 'hidden') s.audio.setHidden(true);
    else { await s.context.suspend(); if (interruption === 'resume') { s.context.state = 'running'; s.context.onstatechange?.(); } }
    const fetches = s.fetched.length, resumes = s.context.resumes;
    await s.audio.setPlayerCharacter('red'); assert.equal(s.audio.effectsStatus, 'resume');
    assert.equal(s.fetched.length, fetches); assert.equal(s.context.resumes, resumes);
    s.audio.setHidden(false); s.audio.playEvent(transform('red'), {}, 0); s.flush(); assert.equal(s.active.length, 0);
    await s.audio.enableEffectsGesture(); assert.equal(s.audio.effectsStatus, 'ready'); assert.equal(play(s, transform('red')).buffer!.id, CHARACTER_TRANSFORMATION_ASSETS.red.url);
    s.audio.destroy();
  }
});

test('stale character loads cannot replace a newer character or global choice; BGM remains the same voice', async () => {
  for (const finalChoice of ['red', 'global'] as const) {
    const waiting = deferred<ArrayBuffer>();
    const s = harness(async url => ({ ok: true, arrayBuffer: () => url.includes('03_intellectual') ? waiting.promise : Promise.resolve(new TextEncoder().encode(url).buffer) }));
    await s.audio.enableMusicGesture(); const bgm = s.active[0]!;
    await s.audio.setEffectsMode('character'); const old = s.audio.enableEffectsGesture(); await tick();
    if (finalChoice === 'red') await s.audio.setPlayerCharacter('red'); else await choose(s, 'machine');
    waiting.reject(Error('stale Blue failure')); assert.equal(await old, false); assert.equal(s.audio.effectsStatus, 'ready'); assert.equal(s.audio.getError('effect'), null);
    assert.equal(s.active[0], bgm); assert.equal(bgm.disconnected, false);
    assert.equal(play(s, transform(finalChoice === 'red' ? 'red' : 'blue')).buffer!.id, finalChoice === 'red' ? CHARACTER_TRANSFORMATION_ASSETS.red.url : CHARACTER_TRANSFORMATION_ASSETS.blue.url);
    assert.match(play(s, attack()).buffer!.id, finalChoice === 'red' ? /04_fire_link_small.wav$/ : /09_machine_link_small.wav$/);
    assert.equal(bgm.buffer!.id, NEON_AUDIO_ASSETS.music.url); s.audio.destroy();
  }
});

test('transformation and both actor banks share one aggregate and the existing max-two complementary fading voices', async () => {
  const s = harness(); await s.audio.setEffectsMode('character'); await s.audio.enableEffectsGesture();
  const fetched = s.fetched.length, decodes = s.context.decodes;
  for (const event of [attack(5), damage('square-strike'), transform()]) s.audio.playEvent(event, {}, 0);
  assert.equal(s.timers.size, 1); s.flush(); assert.equal(s.active.length, 1);
  assert.equal(lastEffect(s).buffer!.id, CHARACTER_TRANSFORMATION_ASSETS.blue.url);
  for (let i = 0; i < 15; i++) {
    s.context.advance(.001);
    play(s, i % 2 ? transform() : { ...attack(), actor: 'enemy', target: 'player' });
    assert.ok(s.active.length <= 2);
    const incoming = lastEffect(s); assert.equal(incoming.destination!.gain.values.at(-1)!.value, 1);
    const outgoing = s.active.find(voice => voice !== incoming)!;
    const level = outgoing.destination!.gain.values.at(-2)!.value;
    for (let step = 0; step <= 5; step++) assert.ok(level * (1 - step / 5) + step / 5 <= 1 + Number.EPSILON);
  }
  const bus = lastEffect(s).destination!.destination as Gain, master = bus.destination as Gain;
  assert.equal(bus.gain.values.at(-1)!.value, 1); assert.equal(master.gain.values.at(-1)!.value, SAMPLE_MASTER_GAIN);
  assert.equal(s.fetched.length, fetched); assert.equal(s.context.decodes, decodes); s.audio.destroy();
});

test('cinematic skip/abort cancels only its cue, consumes it once, and keeps the battle signal usable', async () => {
  for (const status of ['skipped', 'cancelled'] as const) {
    const s = harness(); await s.audio.setEffectsMode('character'); await s.audio.enableEffectsGesture();
    const battle = new AbortController(), finish = deferred<TransformationResult>(), r = request(battle.signal), resolution = {};
    const playing = playTransformationWithSample(s.audio, { play: () => finish.promise }, r, resolution, 0);
    s.flush(); assert.equal(s.active.length, 1);
    finish.resolve({ status }); assert.deepEqual(await playing, { status }); assert.equal(s.active.length, 0); assert.equal(battle.signal.aborted, false);
    s.audio.playEvent(r.event, resolution, 0); s.flush(); assert.equal(s.active.length, 0);
    assert.match(play(s, attack()).buffer!.id, /03_intellectual_link_small.wav$/); s.audio.destroy();
  }
});

test('aborting before aggregation or before cinematic start prevents transformation audio and late tails', async () => {
  for (const beforeStart of [false, true]) {
    const s = harness(); await s.audio.setEffectsMode('character'); await s.audio.enableEffectsGesture();
    const battle = new AbortController(), finish = deferred<TransformationResult>();
    if (beforeStart) battle.abort();
    const playing = playTransformationWithSample(s.audio, { play: () => finish.promise }, request(battle.signal), {}, 0);
    battle.abort(); s.flush(); assert.equal(s.active.length, 0);
    finish.resolve({ status: 'cancelled' }); await playing; s.flush(); assert.equal(s.active.length, 0); s.audio.destroy();
  }
});

test('an optional audio failure cannot reject the cinematic or alter its result', async () => {
  const result = await playTransformationWithSample({ playEvent() { throw Error('device failure'); } }, { play: async () => ({ status: 'completed' }) }, request(), {}, 0);
  assert.deepEqual(result, { status: 'completed' });
});


test('short completion leaves the dedicated PCM tail running without UI wait, but a later battle abort still cancels it', async () => {
  const s = harness(); await s.audio.setEffectsMode('character'); await s.audio.enableEffectsGesture();
  const battle = new AbortController(), finish = deferred<TransformationResult>();
  const playing = playTransformationWithSample(s.audio, { play: () => finish.promise }, { ...request(battle.signal), motion: { short: true, lowMotion: true } }, {}, 0);
  s.flush(); const cue = lastEffect(s); s.context.advance(.25);
  finish.resolve({ status: 'completed' }); assert.deepEqual(await playing, { status: 'completed' });
  assert.equal(cue.disconnected, false); assert.equal(cue.stopAt, Infinity); assert.equal(battle.signal.aborted, false);
  battle.abort(); assert.equal(cue.disconnected, true); s.audio.destroy();
});

test('short completion can end naturally and pagehide/mute each stop an unfinished dedicated cue', async () => {
  for (const ending of ['natural', 'pagehide', 'mute'] as const) {
    const s = harness(); await s.audio.setEffectsMode('character'); await s.audio.enableEffectsGesture();
    const result = await playTransformationWithSample(s.audio, { play: async () => ({ status: 'completed' }) }, { ...request(), motion: { short: true, lowMotion: false } }, {}, 0);
    assert.equal(result.status, 'completed'); s.flush(); const cue = lastEffect(s); assert.equal(cue.disconnected, false);
    if (ending === 'natural') cue.onended?.(); else if (ending === 'pagehide') s.audio.setHidden(true); else s.audio.mute();
    assert.equal(cue.disconnected, true); assert.equal(s.active.length, 0); s.audio.destroy();
  }
});

test('dedicated transformation asset failure is silent, never falls back to a hit, and retry consumes no old event', async () => {
  let fail = true;
  const s = harness(async url => { if (fail && url === CHARACTER_TRANSFORMATION_ASSETS.blue.url) throw Error('missing dedicated cue'); return { ok: true, arrayBuffer: async () => new TextEncoder().encode(url).buffer }; });
  await s.audio.enableMusicGesture(); const bgm = s.active[0]!; await s.audio.setEffectsMode('character');
  assert.equal(await s.audio.enableEffectsGesture(), false); assert.equal(s.audio.effectsStatus, 'unavailable'); assert.equal(s.audio.musicStatus, 'ready');
  const consumed = {}; s.audio.playEvent(transform(), consumed, 0); s.flush(); assert.equal(s.active.length, 1);
  fail = false; assert.equal(await s.audio.enableEffectsGesture(), true); s.audio.playEvent(transform(), consumed, 0); s.flush(); assert.equal(s.active.length, 1);
  assert.equal(play(s, transform()).buffer!.id, CHARACTER_TRANSFORMATION_ASSETS.blue.url); assert.equal(s.active[0], bgm); s.audio.destroy();
});


test('older Safari without AbortSignal.any keeps short tails cancellable and bounds relay listener/timer lifetime', async () => {
  const anyDescriptor = Object.getOwnPropertyDescriptor(AbortSignal, 'any')!;
  const originalSetTimeout = globalThis.setTimeout, originalClearTimeout = globalThis.clearTimeout;
  const timers = new Map<number, { callback: () => void; delay: number }>(); let timerId = 0;
  Object.defineProperty(AbortSignal, 'any', { configurable: true, value: undefined });
  globalThis.setTimeout = ((callback: () => void, delay: number) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; }) as unknown as typeof setTimeout;
  globalThis.clearTimeout = ((id: number) => { timers.delete(id); }) as unknown as typeof clearTimeout;
  try {
    for (const ending of ['abort', 'natural', 'skip', 'error'] as const) {
      const s = harness(); await s.audio.setEffectsMode('character'); await s.audio.enableEffectsGesture();
      const battle = new AbortController(), finish = deferred<TransformationResult>(); let listeners = 0;
      const add = battle.signal.addEventListener.bind(battle.signal), remove = battle.signal.removeEventListener.bind(battle.signal);
      battle.signal.addEventListener = ((type: string, listener: EventListener, options?: AddEventListenerOptions) => { if (type === 'abort') listeners++; add(type, listener, options); }) as typeof battle.signal.addEventListener;
      battle.signal.removeEventListener = ((type: string, listener: EventListener, options?: EventListenerOptions) => { if (type === 'abort') listeners--; remove(type, listener, options); }) as typeof battle.signal.removeEventListener;
      const playing = playTransformationWithSample(s.audio, { play: () => finish.promise }, { ...request(battle.signal), motion: { short: true, lowMotion: false } }, {}, 0);
      s.flush(); const cue = lastEffect(s); assert.equal(listeners, 1); assert.equal(timers.size, 1); assert.equal([...timers.values()][0]!.delay, 900);
      if (ending === 'error') { finish.reject(Error('cut-in unavailable')); await assert.rejects(playing, /cut-in unavailable/); }
      else {
        finish.resolve({ status: ending === 'skip' ? 'skipped' : 'completed' }); await playing;
        if (ending === 'abort') { assert.equal(cue.disconnected, false); assert.equal(listeners, 1); battle.abort(); }
        if (ending === 'natural') { assert.equal(cue.disconnected, false); cue.onended?.(); [...timers.values()][0]!.callback(); }
      }
      assert.equal(cue.disconnected, true); assert.equal(listeners, 0); assert.equal(timers.size, 0); s.audio.destroy();
    }
  } finally {
    Object.defineProperty(AbortSignal, 'any', anyDescriptor); globalThis.setTimeout = originalSetTimeout; globalThis.clearTimeout = originalClearTimeout;
  }
});


test('older Safari fallback expiry aborts delayed queued or active cues before releasing the parent relay', async () => {
  const anyDescriptor = Object.getOwnPropertyDescriptor(AbortSignal, 'any')!;
  const originalSetTimeout = globalThis.setTimeout, originalClearTimeout = globalThis.clearTimeout;
  const timers = new Map<number, { callback: () => void; delay: number }>(); let timerId = 0;
  Object.defineProperty(AbortSignal, 'any', { configurable: true, value: undefined });
  globalThis.setTimeout = ((callback: () => void, delay: number) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; }) as unknown as typeof setTimeout;
  globalThis.clearTimeout = ((id: number) => { timers.delete(id); }) as unknown as typeof clearTimeout;
  try {
    for (const order of ['aggregate-first', 'expiry-first'] as const) {
      const s = harness(); await s.audio.setEffectsMode('character'); await s.audio.enableEffectsGesture();
      const battle = new AbortController(), resolution = {}; let listeners = 0;
      const add = battle.signal.addEventListener.bind(battle.signal), remove = battle.signal.removeEventListener.bind(battle.signal);
      battle.signal.addEventListener = ((type: string, listener: EventListener, options?: AddEventListenerOptions) => { if (type === 'abort') listeners++; add(type, listener, options); }) as typeof battle.signal.addEventListener;
      battle.signal.removeEventListener = ((type: string, listener: EventListener, options?: EventListenerOptions) => { if (type === 'abort') listeners--; remove(type, listener, options); }) as typeof battle.signal.removeEventListener;
      const result = await playTransformationWithSample(s.audio, { play: async () => ({ status: 'completed' }) }, { ...request(battle.signal), motion: { short: true, lowMotion: false } }, resolution, 0);
      assert.equal(result.status, 'completed'); assert.equal(s.active.length, 0); assert.equal(listeners, 1);
      // Simulate a main-thread stall past both the 80ms aggregation and 900ms
      // fallback deadlines. Either timer order must leave no detached live cue.
      s.context.advance(2); const expire = [...timers.values()][0]!.callback;
      if (order === 'aggregate-first') { s.flush(); assert.equal(s.active.length, 1); expire(); }
      else { expire(); s.flush(); }
      assert.equal(s.active.length, 0); assert.equal(listeners, 0); assert.equal(timers.size, 0);
      battle.abort(); s.flush(); assert.equal(s.active.length, 0);
      s.audio.playEvent(transform(), resolution, 0); s.flush(); assert.equal(s.active.length, 0);
      s.audio.destroy();
    }
  } finally {
    Object.defineProperty(AbortSignal, 'any', anyDescriptor); globalThis.setTimeout = originalSetTimeout; globalThis.clearTimeout = originalClearTimeout;
  }
});
