import test from 'node:test';
import assert from 'node:assert/strict';
import { SampleAudioDirector, SAMPLE_MASTER_GAIN, SAMPLE_MUSIC_GAIN, MUSIC_FADE_SECONDS } from '../src/next/audio/SampleAudioDirector.ts';
import { SampleMusic } from '../src/next/audio/SampleMusic.ts';
import { sampleForBattleEvent } from '../src/next/audio/sampleAssets.ts';
import type { SampleAudioAssets, SampleBattleEvent, SampleFetcher } from '../src/next/audio/sampleAssets.ts';

const assets: SampleAudioAssets = { effects: { strike: { url: 'strike.wav' }, crush: { url: 'crush.wav' }, breaker: { url: 'breaker.wav' } }, music: { url: 'music.wav', loopStartSeconds: 1, loopEndSeconds: 9 } };
const attack = (linkCount = 3): SampleBattleEvent => ({ type: 'attack', actor: 'player', target: 'enemy', damage: 5, hpBefore: 10, hpAfter: 5, linkCount });
const deferred = <T>() => { let resolve!: (value: T) => void, reject!: (reason?: unknown) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const tick = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

class Parameter {
  values: { kind: string; value: number; at: number }[] = [];
  setValueAtTime(value: number, at: number) { this.values.push({ kind: 'set', value, at }); }
  linearRampToValueAtTime(value: number, at: number) { this.values.push({ kind: 'ramp', value, at }); }
  cancelScheduledValues(at: number) { this.values = this.values.filter(value => value.at < at); }
}
class Gain {
  gain = new Parameter(); disconnected = false; destination: unknown;
  connect(destination: unknown) { this.destination = destination; }
  disconnect() { this.disconnected = true; }
}
class Source {
  buffer: { duration: number; id: number } | null = null;
  loop = false; loopStart = 0; loopEnd = 0; onended: (() => void) | null = null;
  started = false; disconnected = false; stopAt = Infinity; offset = 0; destination: Gain | null = null;
  connect(destination: Gain) { this.destination = destination; }
  disconnect() { this.disconnected = true; }
  start(_at: number, offset = 0) { this.started = true; this.offset = offset; }
  stop(at = 0) { this.stopAt = at; if (at === 0) this.onended?.(); }
}
class Context {
  state = 'suspended'; currentTime = 0; destination = {}; onstatechange: (() => void) | null = null;
  gains: Gain[] = []; sources: Source[] = []; resumes = 0; decodes = 0;
  createGain() { const gain = new Gain(); this.gains.push(gain); return gain; }
  createBufferSource() { const source = new Source(); this.sources.push(source); return source; }
  async decodeAudioData(data: ArrayBuffer) { this.decodes++; return { duration: 10, id: new Uint8Array(data)[0] }; }
  async resume() { this.resumes++; this.state = 'running'; this.onstatechange?.(); }
  async suspend() { this.state = 'suspended'; this.onstatechange?.(); }
  async close() { this.state = 'closed'; this.onstatechange?.(); }
  advance(seconds: number) { this.currentTime += seconds; for (const source of this.sources) if (source.stopAt <= this.currentTime) source.onended?.(); }
}
function setup(fetchOverride?: SampleFetcher) {
  const context = new Context(), timers = new Map<number, { callback: () => void; ms: number }>();
  let timerId = 0, creates = 0; const fetched: string[] = [];
  const fetch: SampleFetcher = fetchOverride ?? (async url => { fetched.push(url); return { ok: true, arrayBuffer: async () => new Uint8Array([['strike.wav', 'crush.wav', 'breaker.wav', 'music.wav'].indexOf(url) + 1]).buffer }; });
  const audio = new SampleAudioDirector(assets, { createContext: () => { creates++; return context as unknown as AudioContext; }, fetch,
    setTimer: (callback, ms) => { const id = ++timerId; timers.set(id, { callback, ms }); return id; }, clearTimer: id => { timers.delete(id as number); } });
  const music = new SampleMusic(audio);
  const flush = () => { const current = [...timers.values()]; timers.clear(); for (const timer of current) timer.callback(); };
  return { audio, music, context, fetched, timers, flush, get creates() { return creates; }, get active() { return context.sources.filter(source => source.started && !source.disconnected); } };
}

test('only positive opposing primary-link hits map to strike, crush and breaker', () => {
  assert.equal(sampleForBattleEvent(attack(3)), 'strike'); assert.equal(sampleForBattleEvent(attack(4)), 'crush'); assert.equal(sampleForBattleEvent(attack(9)), 'breaker');
  assert.equal(sampleForBattleEvent({ ...attack(), actor: 'enemy', target: 'player' }), 'strike');
  for (const type of ['damage', 'drop', 'heal', 'transformation', 'battle-end', 'instant-kill', 'gauge']) assert.equal(sampleForBattleEvent({ ...attack(), type }), null);
  for (const patch of [{ damage: 0 }, { damage: -1 }, { target: 'player' }, { hpAfter: 10 }, { linkCount: 2 }, { linkCount: 3.5 }]) assert.equal(sampleForBattleEvent({ ...attack(), ...patch }), null);
});
test('initial OFF does not create a context, fetch, or replay muted events', async () => {
  const s = setup(), resolution = {}; s.audio.playEvent(attack(), resolution, 0);
  assert.equal(s.audio.effectsStatus, 'off'); assert.equal(s.music.status, 'off'); assert.equal(s.creates, 0); assert.equal(s.fetched.length, 0);
  await s.audio.enableEffectsGesture(); s.audio.playEvent(attack(), resolution, 0); s.flush(); assert.equal(s.active.length, 0);
  s.audio.playEvent(attack(), resolution, 1); s.flush(); assert.equal(s.active.length, 1); s.audio.destroy();
});
test('BGM and FX have independent preferences, loads, failures, and stops', async () => {
  const s = setup(); await s.music.enableGesture(); assert.equal(s.audio.effectsStatus, 'off'); assert.deepEqual(s.fetched, ['music.wav']);
  const bgm = s.active[0]!; assert.equal(bgm.loop, true); assert.equal(bgm.loopStart, 1); assert.equal(bgm.loopEnd, 9);
  await s.audio.enableEffectsGesture(); s.audio.playEvent(attack(), {}, 0); s.flush(); const fx = s.active.find(source => !source.loop)!;
  s.music.setEnabled(false); assert.equal(bgm.stopAt, MUSIC_FADE_SECONDS); s.context.advance(MUSIC_FADE_SECONDS); assert.equal(bgm.disconnected, true); assert.equal(fx.disconnected, false);
  await s.music.enableGesture(); s.audio.setEffectsEnabled(false); assert.equal(fx.disconnected, true); assert.equal(s.music.status, 'ready'); assert.equal(s.active.length, 1); s.audio.destroy();
});
test('fixed gains preserve headroom at volume 1 and independent volume 0', async () => {
  const s = setup(); s.audio.setVolume('effect', .4); s.audio.setVolume('music', 0);
  await s.music.enableGesture(); const sourceGain = s.active[0]!.destination!, musicBus = sourceGain.destination as Gain, master = musicBus.destination as Gain;
  assert.equal(musicBus.gain.values.at(-1)?.value, 0); assert.equal(master.gain.values.at(-1)?.value, SAMPLE_MASTER_GAIN); assert.equal(master.destination, s.context.destination);
  s.audio.setVolume('music', 1); assert.equal(musicBus.gain.values.at(-1)?.value, SAMPLE_MUSIC_GAIN);
  await s.audio.enableEffectsGesture(); s.audio.playEvent(attack(), {}, 0); s.flush(); const effectBus = s.active.find(source => !source.loop)!.destination!.destination as Gain;
  assert.equal(effectBus.gain.values.at(-1)?.value, .4); assert.equal(effectBus.destination, master);
  s.audio.setVolume('effect', 1); assert.equal(effectBus.gain.values.at(-1)?.value, 1); s.audio.destroy();
});
test('strongest 80ms aggregate fires once; fast 15ms axis bursts keep the 80ms window', async () => {
  const s = setup(); await s.audio.enableEffectsGesture();
  for (const count of [3, 5, 4]) s.audio.playEvent(attack(count), {}, count);
  assert.equal(s.timers.size, 1); assert.equal([...s.timers.values()][0]?.ms, 80); assert.equal(s.active.length, 0); s.flush();
  assert.equal(s.active.length, 1); assert.equal(s.active[0]!.buffer!.id, 3);
  s.audio.setFastMode(true); s.audio.playEvent(attack(), {}, 0); assert.equal([...s.timers.values()][0]?.ms, 80); s.audio.destroy();
});
test('aborted candidates cannot win aggregation or replay, including after reset', async () => {
  const s = setup(); await s.audio.enableEffectsGesture(); const resolution = {}, abort = new AbortController();
  s.audio.playEvent(attack(5), resolution, 0, abort.signal); s.audio.playEvent(attack(3), resolution, 1); abort.abort(); s.flush();
  assert.equal(s.active[0]!.buffer!.id, 1); s.audio.reset(); s.audio.playEvent(attack(5), resolution, 0); s.audio.playEvent(attack(3), resolution, 1); s.flush(); assert.equal(s.active.length, 0);
  const cancelled = new AbortController(); cancelled.abort(); s.audio.playEvent(attack(), resolution, 2, cancelled.signal); s.audio.playEvent(attack(), resolution, 2); s.flush(); assert.equal(s.active.length, 0); s.audio.destroy();
});
test('crossfade never has more than two effect voices, including a preempted fade', async () => {
  const s = setup(); await s.audio.enableEffectsGesture();
  const play = () => { s.audio.playEvent(attack(), {}, 0); s.flush(); };
  play(); s.context.advance(.01); play(); assert.equal(s.active.length, 2);
  const first = s.active[0]!, incoming = s.active[1]!;
  assert.equal(first.stopAt, .015); assert.deepEqual(incoming.destination!.gain.values, [{ kind: 'set', value: 0, at: .01 }, { kind: 'ramp', value: 1, at: .015 }]);
  s.context.advance(.002); play(); assert.equal(s.active.length, 2); assert.equal(first.disconnected, true);
  const outgoing = s.active[0]!.destination!.gain.values;
  assert.ok(Math.abs(outgoing.at(-2)!.value - .4) < 1e-10); assert.equal(outgoing.at(-1)!.value, 0);
  for (let i = 0; i <= 10; i++) assert.ok(.4 * (1 - i / 10) + i / 10 <= 1);
  s.context.advance(.006); assert.equal(s.active.length, 1); s.audio.destroy(); assert.equal(s.active.length, 0);
});
test('an active effect abort disconnects the source and its gain', async () => {
  const s = setup(); await s.audio.enableEffectsGesture(); const abort = new AbortController();
  s.audio.playEvent(attack(), {}, 0, abort.signal); s.flush(); const voice = s.active[0]!; abort.abort();
  assert.equal(voice.disconnected, true); assert.equal(voice.destination!.disconnected, true); s.audio.destroy();
});
test('late asset completion is discarded after OFF, reset, hidden, mute, or destroy', async () => {
  for (const group of ['effect', 'music'] as const) for (const cancel of ['off', 'reset', 'hidden', 'mute', 'destroy'] as const) {
    const pending = deferred<ArrayBuffer>(), s = setup(async () => ({ ok: true, arrayBuffer: () => pending.promise }));
    const enabling = group === 'effect' ? s.audio.enableEffectsGesture() : s.music.enableGesture(); await tick();
    assert.equal(group === 'effect' ? s.audio.effectsStatus : s.music.status, 'loading');
    if (cancel === 'off') { if (group === 'effect') s.audio.setEffectsEnabled(false); else s.music.setEnabled(false); }
    else if (cancel === 'hidden') s.audio.setHidden(true); else s.audio[cancel]();
    pending.resolve(new Uint8Array([4]).buffer); assert.equal(await enabling, false); assert.equal(s.active.length, 0);
    s.audio.playEvent(attack(), {}, 0); s.flush(); assert.equal(s.active.length, 0); s.audio.destroy();
  }
});
test('hidden and spontaneous interruption require new per-group gestures', async () => {
  const s = setup(); await s.audio.enableEffectsGesture(); await s.music.enableGesture();
  s.audio.setHidden(true); s.audio.setHidden(false); s.context.state = 'running'; s.context.onstatechange?.();
  assert.equal(s.audio.effectsStatus, 'resume'); assert.equal(s.music.status, 'resume'); assert.equal(s.active.length, 0);
  await s.music.enableGesture(); assert.equal(s.music.status, 'ready'); assert.equal(s.audio.effectsStatus, 'resume');
  await s.audio.enableEffectsGesture(); s.context.state = 'suspended'; s.context.onstatechange?.(); s.context.state = 'running'; s.context.onstatechange?.();
  assert.equal(s.music.status, 'resume'); assert.equal(s.audio.effectsStatus, 'resume'); assert.equal(s.active.length, 0); s.audio.destroy();
});
test('pending context resume cannot revive cancelled groups', async () => {
  for (const group of ['effect', 'music'] as const) {
    const s = setup(), pending = deferred<void>(); s.context.resume = () => pending.promise;
    const result = group === 'effect' ? s.audio.enableEffectsGesture() : s.music.enableGesture();
    if (group === 'effect') s.audio.setEffectsEnabled(false); else s.music.setEnabled(false);
    s.context.state = 'running'; pending.resolve(); assert.equal(await result, false); assert.equal(s.active.length, 0); s.audio.destroy();
  }
});
test('fetch and decode failures are retryable without affecting the other group', async () => {
  let fail = true, calls = 0; const s = setup(async url => { calls++; if (fail && url !== 'music.wav') throw Error('offline'); return { ok: true, arrayBuffer: async () => new Uint8Array([1]).buffer }; });
  await s.music.enableGesture(); assert.equal(await s.audio.enableEffectsGesture(), false); assert.equal(s.audio.effectsStatus, 'unavailable'); assert.equal(s.music.status, 'ready');
  fail = false; assert.equal(await s.audio.enableEffectsGesture(), true); assert.ok(calls >= 7); assert.equal(s.active.length, 1); s.audio.destroy();
  const d = setup(); let decodeFail = true; d.context.decodeAudioData = async () => { if (decodeFail) throw Error('bad WAV'); return { duration: 10, id: 1 }; };
  assert.equal(await d.music.enableGesture(), false); decodeFail = false; assert.equal(await d.music.enableGesture(), true); assert.equal(d.fetched.length, 2); d.audio.destroy();
});
test('resume failure retries and stale rejection cannot poison newer success', async () => {
  const s = setup(); s.context.resume = async () => { throw Error('blocked'); }; assert.equal(await s.music.enableGesture(), false); assert.equal(s.music.status, 'unavailable');
  s.context.resume = async () => { s.context.state = 'running'; }; assert.equal(await s.music.enableGesture(), true); s.audio.destroy();
  const t = setup(), attempts = [deferred<void>(), deferred<void>()]; let i = 0; t.context.resume = () => attempts[i++]!.promise;
  const bgm = t.music.enableGesture(), fx = t.audio.enableEffectsGesture(); t.context.state = 'running'; attempts[1]!.resolve(); assert.equal(await fx, true);
  attempts[0]!.reject(Error('old')); assert.equal(await bgm, true); assert.equal(t.music.status, 'ready'); assert.equal(t.audio.effectsStatus, 'ready'); t.audio.destroy();
});
test('shared requests use fetch identity and decode once per context', async () => {
  let fetches = 0; const fetch: SampleFetcher = async () => { fetches++; return { ok: true, arrayBuffer: async () => new Uint8Array([1]).buffer }; };
  const s = setup(fetch), t = setup(fetch); await Promise.all([s.music.enableGesture(), t.music.enableGesture()]); assert.equal(fetches, 1); assert.equal(s.context.decodes, 1); assert.equal(t.context.decodes, 1);
  s.music.setEnabled(false); await s.music.enableGesture(); assert.equal(fetches, 1); assert.equal(s.context.decodes, 1);
  const other = setup(); await other.music.enableGesture(); assert.equal(other.fetched.length, 1); s.audio.destroy(); t.audio.destroy(); other.audio.destroy();
});
test('reset clears pending effects and music restarts once with stored volumes', async () => {
  const s = setup(); await s.audio.enableEffectsGesture(); await s.music.enableGesture(); s.audio.setVolume('music', .2);
  s.audio.playEvent(attack(), {}, 0); s.audio.reset(); s.music.restart(); s.flush(); assert.equal(s.active.length, 1); assert.equal(s.active[0]!.loop, true); assert.equal(s.audio.getVolume('music'), .2);
  s.audio.destroy(); assert.equal(await s.music.enableGesture(), false); s.music.restart(); assert.equal(s.active.length, 0);
});
test('source failures and UI listener exceptions never affect battle playback', async () => {
  const s = setup(); s.audio.subscribe(() => { throw Error('UI'); }); await s.audio.enableEffectsGesture();
  s.context.createBufferSource = () => { throw Error('device'); }; assert.doesNotThrow(() => { s.audio.playEvent(attack(), {}, 0); s.flush(); });
  assert.equal(s.audio.effectsStatus, 'unavailable'); assert.ok(s.audio.getError('effect')); assert.doesNotThrow(() => { s.audio.reset(); s.audio.mute(); s.audio.destroy(); });
});
test('sample rules are injected and strongest matching threshold wins regardless of rule order', () => {
  assert.equal(sampleForBattleEvent(attack(7), [{ minLinks: 3, sample: 'breaker' }, { minLinks: 6, sample: 'strike' }]), 'strike');
  assert.equal(sampleForBattleEvent(attack(4), []), null);
});
test('closed-context replacement revokes the other group readiness and pending load', async () => {
  for (const pendingLoad of [false, true]) {
    const old = new Context(), replacement = new Context(), delayed = deferred<ArrayBuffer>(); let creates = 0;
    const audio = new SampleAudioDirector(assets, {
      createContext: () => (creates++ === 0 ? old : replacement) as unknown as AudioContext,
      fetch: async url => ({ ok: true, arrayBuffer: () => pendingLoad && url === 'music.wav' ? delayed.promise : Promise.resolve(new Uint8Array([1]).buffer) }),
    });
    const music = new SampleMusic(audio), first = music.enableGesture();
    if (pendingLoad) await tick(); else await first;
    old.state = 'closed'; // Exercise replacement even if the platform omits its state event.
    assert.equal(await audio.enableEffectsGesture(), true); assert.equal(music.status, 'resume'); assert.equal(audio.effectsStatus, 'ready');
    delayed.resolve(new Uint8Array([4]).buffer); assert.equal(await first, !pendingLoad); assert.equal(music.status, 'resume');
    assert.ok(old.sources.every(source => source.disconnected)); assert.equal(replacement.sources.length, 0);
    assert.equal(await music.enableGesture(), true); assert.equal(music.status, 'ready'); audio.destroy();
  }
});
test('whole-buffer loops follow decoded duration and BGM starts and stops use 12ms ramps', async () => {
  const context = new Context(); context.decodeAudioData = async () => ({ duration: 9.99999, id: 4 });
  const audio = new SampleAudioDirector({ ...assets, music: { url: 'resampled.wav', loopStartSeconds: 0, loopEndSeconds: 10, loopWholeBuffer: true } }, {
    createContext: () => context as unknown as AudioContext, fetch: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) }),
  });
  assert.equal(await audio.enableMusicGesture(), true); const source = context.sources[0]!; assert.equal(source.loopEnd, 9.99999);
  assert.deepEqual(source.destination!.gain.values, [{ kind: 'set', value: 0, at: 0 }, { kind: 'ramp', value: 1, at: MUSIC_FADE_SECONDS }]);
  context.advance(.1); audio.setMusicEnabled(false); assert.equal(source.stopAt, .1 + MUSIC_FADE_SECONDS); assert.equal(source.destination!.gain.values.at(-1)!.value, 0);
  context.advance(MUSIC_FADE_SECONDS); assert.equal(source.disconnected, true); audio.destroy();
});
test('partial loop resampling tolerance clamps only one frame and rejects invalid bounds', async () => {
  for (const [loopEndSeconds, succeeds] of [[10.00001, true], [10.1, false], [0, false]] as const) {
    const context = new Context(), audio = new SampleAudioDirector({ ...assets, music: { url: 'partial.wav', loopStartSeconds: 1, loopEndSeconds } }, {
      createContext: () => context as unknown as AudioContext, fetch: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) }),
    });
    assert.equal(await audio.enableMusicGesture(), succeeds); if (succeeds) assert.equal(context.sources[0]!.loopEnd, 10); audio.destroy();
  }
});
test('a cancelled timer callback cannot consume the next resolution aggregation', async () => {
  const s = setup(); await s.audio.enableEffectsGesture(); s.audio.playEvent(attack(5), {}, 0);
  const oldCallback = [...s.timers.values()][0]!.callback; s.audio.reset(); s.audio.playEvent(attack(3), {}, 0);
  oldCallback(); s.flush(); assert.equal(s.active.length, 1); assert.equal(s.active[0]!.buffer!.id, 1); s.audio.destroy();
});
test('a failed FX start is retryable and leaves running BGM alone', async () => {
  const s = setup(); await s.music.enableGesture(); await s.audio.enableEffectsGesture(); const create = s.context.createBufferSource.bind(s.context);
  s.context.createBufferSource = () => { const source = create(); source.start = () => { throw Error('start rejected'); }; return source; };
  assert.doesNotThrow(() => { s.audio.playEvent(attack(), {}, 0); s.flush(); }); assert.equal(s.audio.effectsStatus, 'unavailable'); assert.equal(s.music.status, 'ready');
  assert.equal(s.active.length, 1); s.context.createBufferSource = create; assert.equal(await s.audio.enableEffectsGesture(), true);
  s.audio.playEvent(attack(), {}, 0); s.flush(); assert.equal(s.active.length, 2); s.audio.destroy();
});
test('context interruption during decode revokes the pending gesture even if the browser auto-resumes', async () => {
  const delayed = deferred<ArrayBuffer>(), s = setup(async () => ({ ok: true, arrayBuffer: () => delayed.promise }));
  const enabling = s.music.enableGesture(); await tick(); s.context.state = 'suspended'; s.context.onstatechange?.();
  s.context.state = 'running'; s.context.onstatechange?.(); delayed.resolve(new Uint8Array([4]).buffer);
  assert.equal(await enabling, false); assert.equal(s.music.status, 'resume'); assert.equal(s.active.length, 0);
  assert.equal(await s.music.enableGesture(), true); s.audio.destroy();
});
