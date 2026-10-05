/** Sample URLs are versioned public assets. No synthesized fallback is permitted. */
export type AttackSample = 'strike' | 'crush' | 'breaker';
export type EffectSample = AttackSample | 'shapeDamage' | 'directDamage' | 'transformation';
export type EffectAssets = Readonly<Record<AttackSample, SampleAsset> & Partial<Record<'shapeDamage' | 'directDamage' | 'transformation', SampleAsset>>>;
export interface SampleAsset { readonly url: string }
export interface MusicAsset extends SampleAsset {
  readonly fallbackUrl?: string;
  readonly loopStartSeconds: number;
  readonly loopEndSeconds: number;
  /** Defaults to the beginning, allowing an intro before the loop region. */
  readonly startOffsetSeconds?: number;
  /** Use the decoded frame count after device-rate resampling for a whole-file loop. */
  readonly loopWholeBuffer?: boolean;
}
export interface AttackSampleRule { readonly minLinks: number; readonly sample: AttackSample }
export const ATTACK_SAMPLE_RULES: readonly AttackSampleRule[] = [
  { minLinks: 5, sample: 'breaker' }, { minLinks: 4, sample: 'crush' }, { minLinks: 3, sample: 'strike' },
];
export interface SampleAudioAssets {
  readonly effects: EffectAssets;
  readonly music: MusicAsset;
}
export type SampleFetcher = (url: string) => Promise<Pick<Response, 'ok' | 'arrayBuffer'>>;
export const defaultSampleFetcher: SampleFetcher = url => globalThis.fetch(url);

// Scope by transport identity as well as URL: an injected loader never reads another
// loader's response. Decode promises are additionally scoped to their AudioContext.
const bytes = new WeakMap<SampleFetcher, Map<string, Promise<ArrayBuffer>>>();
const decoded = new WeakMap<AudioContext, WeakMap<SampleFetcher, Map<string, Promise<AudioBuffer>>>>();
export function loadSample(context: AudioContext, asset: SampleAsset, fetcher: SampleFetcher): Promise<AudioBuffer> {
  let transports = decoded.get(context);
  if (!transports) { transports = new WeakMap(); decoded.set(context, transports); }
  let buffers = transports.get(fetcher);
  if (!buffers) { buffers = new Map(); transports.set(fetcher, buffers); }
  const existing = buffers.get(asset.url);
  if (existing) return existing;
  let requests = bytes.get(fetcher);
  if (!requests) { requests = new Map(); bytes.set(fetcher, requests); }
  let request = requests.get(asset.url);
  if (!request) {
    request = Promise.resolve().then(() => fetcher(asset.url)).then(response => {
      if (!response.ok) throw new Error('Audio asset could not be loaded');
      return response.arrayBuffer();
    });
    requests.set(asset.url, request);
    const owned = request;
    void request.catch(() => { if (requests.get(asset.url) === owned) requests.delete(asset.url); });
  }
  const pending = request.then(data => context.decodeAudioData(data.slice(0)));
  buffers.set(asset.url, pending);
  void pending.catch(() => {
    if (buffers.get(asset.url) === pending) buffers.delete(asset.url);
    // A corrupt response must be refetched on a user retry, too.
    if (requests.get(asset.url) === request) requests.delete(asset.url);
  });
  return pending;
}

/** Structural input keeps this presentation module independent from combat logic. */
export interface SampleBattleEvent {
  readonly type: string;
  readonly actor?: string;
  readonly character?: string;
  readonly target?: string;
  readonly linkCount?: number;
  readonly source?: string;
  readonly damage?: number;
  readonly hpBefore?: number;
  readonly hpAfter?: number;
}
export function sampleForBattleEvent(event: SampleBattleEvent, rules: readonly AttackSampleRule[] = ATTACK_SAMPLE_RULES): AttackSample | null {
  // Core's 'attack' event is the primary link hit. Its 'damage' event is a
  // separate shape/direct/self/reflect hit and deliberately has no sample.
  if (event.type !== 'attack' || (event.actor !== 'player' && event.actor !== 'enemy') ||
      (event.target !== 'player' && event.target !== 'enemy') || event.actor === event.target ||
      !Number.isFinite(event.damage) || (event.damage ?? 0) <= 0 ||
      !Number.isInteger(event.linkCount) || (event.linkCount ?? 0) < 3) return null;
  if (!hasActualHpLoss(event)) return null;
  let winner: AttackSampleRule | undefined;
  for (const rule of rules) if (rule.minLinks <= event.linkCount! && (!winner || rule.minLinks > winner.minLinks)) winner = rule;
  return winner?.sample ?? null;
}

/** Zero HP cannot be lost again, even when core retains negative overkill HP. */
export function hasActualHpLoss(event: SampleBattleEvent): boolean {
  if (!Number.isFinite(event.damage) || (event.damage ?? 0) <= 0) return false;
  // Structural legacy integrations may omit HP; the game itself always supplies both.
  if (event.hpBefore === undefined && event.hpAfter === undefined) return true;
  return Number.isFinite(event.hpBefore) && Number.isFinite(event.hpAfter) &&
    Math.max(0, event.hpBefore!) - Math.max(0, event.hpAfter!) > 0;
}

/** Only damage-result events produce a cue. Activation, shape visuals and healing
 * do not, avoiding a second cue for the same shape hit or healing reaction. */
export function damageSampleForBattleEvent(event: SampleBattleEvent): EffectSample | null {
  if (event.type !== 'damage' || !hasActualHpLoss(event) ||
    (event.actor !== 'player' && event.actor !== 'enemy') ||
    (event.target !== 'player' && event.target !== 'enemy')) return null;
  // A reaction belongs to Blue even when it arose during an enemy resolution.
  // Source + damaged target are authoritative, not the current action owner.
  if (event.source === 'blue-transformation') return event.target === 'enemy' ? 'directDamage' : null;
  if (event.actor === event.target) return null;
  switch (event.source) {
    case 'corner-strike': case 'square-strike': return 'shapeDamage';
    case 'pain-shared': case 'magic-bullet': case 'boss-fixed': return 'directDamage';
    default: return null; // New sources require an explicit presentation mapping.
  }
}

/** Declarative priority within the existing 80ms strongest-hit aggregation. */
export const EFFECT_SAMPLE_PRIORITY: Readonly<Record<EffectSample, number>> = {
  strike: 1, crush: 2, breaker: 3, directDamage: 4, shapeDamage: 5, transformation: 6,
};
