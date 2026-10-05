import { SampleAudioDirector } from '../../src/next/audio/SampleAudioDirector.ts';
import { NEON_AUDIO_ASSETS } from '../../src/next/audio/neonAudioAssets.ts';
import type { SampleFetcher, SampleBattleEvent } from '../../src/next/audio/sampleAssets.ts';

export const attack = (linkCount = 3): SampleBattleEvent => ({ type: 'attack', actor: 'player', target: 'enemy', damage: 5, hpBefore: 10, hpAfter: 5, linkCount });
export const damage = (source = 'magic-bullet'): SampleBattleEvent => ({ type: 'damage', actor: 'player', target: 'enemy', source, damage: 5, hpBefore: 10, hpAfter: 5 });
export const deferred = <T>() => { let resolve!: (value: T) => void, reject!: (reason?: unknown) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
export const tick = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
export class Parameter {
  values: { kind: string; value: number; at: number }[] = [];
  setValueAtTime(value: number, at: number) { this.values.push({ kind: 'set', value, at }); }
  linearRampToValueAtTime(value: number, at: number) { this.values.push({ kind: 'ramp', value, at }); }
  cancelScheduledValues(at: number) { this.values = this.values.filter(value => value.at < at); }
}
export class Gain {
  gain = new Parameter(); disconnected = false; destination: unknown;
  connect(destination: unknown) { this.destination = destination; }
  disconnect() { this.disconnected = true; }
}
export class Source {
  buffer: { duration: number; id: string } | null = null;
  loop = false; loopStart = 0; loopEnd = 0; onended: (() => void) | null = null;
  started = false; disconnected = false; stopAt = Infinity; offset = 0; destination: Gain | null = null;
  connect(destination: Gain) { this.destination = destination; }
  disconnect() { this.disconnected = true; }
  start(_at: number, offset = 0) { this.started = true; this.offset = offset; }
  stop(at = 0) { this.stopAt = at; if (at === 0) this.onended?.(); }
}
export class Context {
  state = 'suspended'; currentTime = 0; destination = {}; onstatechange: (() => void) | null = null;
  gains: Gain[] = []; sources: Source[] = []; resumes = 0; decodes = 0;
  createGain() { const gain = new Gain(); this.gains.push(gain); return gain; }
  createBufferSource() { const source = new Source(); this.sources.push(source); return source; }
  async decodeAudioData(data: ArrayBuffer) { this.decodes++; return { duration: 43.6376, sampleRate: 48000, id: new TextDecoder().decode(data) }; }
  async resume() { this.resumes++; this.state = 'running'; this.onstatechange?.(); }
  async suspend() { this.state = 'suspended'; this.onstatechange?.(); }
  async close() { this.state = 'closed'; this.onstatechange?.(); }
  advance(seconds: number) { this.currentTime += seconds; for (const source of this.sources) if (source.stopAt <= this.currentTime) source.onended?.(); }
}
export function harness(fetchOverride?: SampleFetcher) {
  const context = new Context(), timers = new Map<number, { callback: () => void; ms: number }>();
  let timerId = 0, creates = 0; const fetched: string[] = [];
  const fetch: SampleFetcher = async url => { fetched.push(url); return fetchOverride ? fetchOverride(url) : { ok: true, arrayBuffer: async () => new TextEncoder().encode(url).buffer }; };
  const audio = new SampleAudioDirector(NEON_AUDIO_ASSETS, { createContext: () => { creates++; return context as unknown as AudioContext; }, fetch,
    setTimer: (callback, ms) => { const id = ++timerId; timers.set(id, { callback, ms }); return id; }, clearTimer: id => { timers.delete(id as number); } });
  const flush = () => { const current = [...timers.values()]; timers.clear(); for (const timer of current) timer.callback(); };
  return { audio, context, fetched, timers, flush, get creates() { return creates; }, get active() { return context.sources.filter(source => source.started && !source.disconnected); } };
}
