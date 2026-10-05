import { CHARACTER_TRANSFORMATION_ASSETS, withTransformationAsset } from './transformationAssets.ts';
import { characterEffectAssets, effectActor, transformationIsValid, transformationSoundCharacter } from './characterSoundThemes.ts';
import type { EffectsMode, EffectActorContext, SoundCharacter } from './characterSoundThemes.ts';
import { defaultSampleFetcher, loadSample, sampleForBattleEvent, damageSampleForBattleEvent, EFFECT_SAMPLE_PRIORITY } from './sampleAssets.ts';
import type { EffectSample, EffectAssets, AttackSampleRule, SampleAudioAssets, SampleBattleEvent, SampleFetcher, MusicAsset } from './sampleAssets.ts';

export type AudioStatus = 'off' | 'loading' | 'ready' | 'resume' | 'unavailable';
export type AudioGroup = 'effect' | 'music';
export const SAMPLE_MASTER_GAIN = 10 ** (-3 / 20);
export const SAMPLE_MUSIC_GAIN = 10 ** (-4.5 / 20);
export const SAMPLE_EFFECT_GAIN = 1;
export const EFFECT_CROSSFADE_SECONDS = .005;
export const MUSIC_FADE_SECONDS = .012;
export const DEFAULT_AGGREGATION_MS = 80;
// Fast presentation may emit axes 15ms apart; keep the same 80ms strongest-hit window.
export const FAST_AGGREGATION_MS = DEFAULT_AGGREGATION_MS;

export interface SampleAudioOptions {
  readonly createContext?: () => AudioContext;
  readonly fetch?: SampleFetcher;
  readonly aggregationWindowMs?: number;
  readonly attackSampleRules?: readonly AttackSampleRule[];
  readonly setTimer?: (callback: () => void, milliseconds: number) => unknown;
  readonly clearTimer?: (id: unknown) => void;
}
interface GroupState { wanted: boolean; loading: boolean; needsGesture: boolean; error: string | null; epoch: number }
interface Envelope { from: number; to: number; start: number; end: number }
interface Voice { source: AudioBufferSourceNode; gain: GainNode; envelope: Envelope; group: AudioGroup; cleanup: () => void }
interface Candidate { buffer: AudioBuffer; priority: number; signal?: AbortSignal; cleanup: () => void }
const groupState = (): GroupState => ({ wanted: false, loading: false, needsGesture: true, error: null, epoch: 0 });

/** Presentation-only sample player. Playback errors never escape into game logic. */
export class SampleAudioDirector {
  private musicAsset: MusicAsset;
  private effectAssets: EffectAssets;
  private effectTheme = 'neon';
  private effectMode: EffectsMode = 'global';
  private playerCharacter: SoundCharacter = 'blue';
  private readonly options: SampleAudioOptions;
  private readonly fetcher: SampleFetcher;
  private readonly groups: Record<AudioGroup, GroupState> = { effect: groupState(), music: groupState() };
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private buses = new Map<AudioGroup, GainNode>();
  private volumes = new Map<string, number>();
  private effects = new Map<string, AudioBuffer>();
  private musicBuffer: AudioBuffer | null = null;
  private voices = new Set<Voice>();
  private seen = new WeakMap<object, Set<number>>();
  private listeners = new Set<() => void>();
  private pending = new Set<Candidate>();
  private aggregateTimer: unknown = null;
  private aggregateEpoch = 0;
  private aggregationWindowMs = DEFAULT_AGGREGATION_MS;
  private lifecycleEpoch = 0;
  private hidden = false;
  private destroyed = false;

  constructor(assets: SampleAudioAssets, options: SampleAudioOptions = {}) {
    this.musicAsset = assets.music; this.effectAssets = assets.effects; this.options = options; this.fetcher = options.fetch ?? defaultSampleFetcher;
    this.setAggregationWindowMs(options.aggregationWindowMs ?? DEFAULT_AGGREGATION_MS);
  }
  /** Legacy FX controls can use status; BGM must use musicStatus independently. */
  get status(): AudioStatus { return this.effectsStatus; }
  get effectsStatus(): AudioStatus { return this.groupStatus('effect'); }
  get musicStatus(): AudioStatus { return this.groupStatus('music'); }
  get currentTime(): number { return this.context?.currentTime ?? 0; }
  get effectsThemeId(): string { return this.effectTheme; }
  get effectsMode(): EffectsMode { return this.effectMode; }
  get effectsPlayerCharacter(): SoundCharacter { return this.playerCharacter; }
  get effectsEnabled(): boolean { return this.groups.effect.wanted; }
  get musicEnabled(): boolean { return this.groups.music.wanted; }
  getError(group: AudioGroup): string | null { return this.groups[group].error; }
  private groupStatus(group: AudioGroup): AudioStatus {
    const state = this.groups[group];
    if (!state.wanted || this.destroyed) return 'off';
    if (state.error) return 'unavailable';
    if (state.loading) return 'loading';
    if (this.hidden || state.needsGesture || this.context?.state !== 'running') return 'resume';
    return 'ready';
  }
  subscribe(listener: () => void): () => void {
    if (this.destroyed) return () => {};
    this.listeners.add(listener); return () => { this.listeners.delete(listener); };
  }
  private notify(): void { for (const listener of this.listeners) { try { listener(); } catch { /* Isolate UI failures. */ } } }
  getVolume(group: string): number { return this.volumes.get(group) ?? 1; }
  setVolume(group: string, value: number): void {
    if (!Number.isFinite(value) || this.destroyed) return;
    const volume = Math.max(0, Math.min(1, value));
    if(this.getVolume(group)===volume)return;
    this.volumes.set(group, volume);
    try { this.buses.get(group as AudioGroup)?.gain.setValueAtTime(volume * (group === 'music' ? SAMPLE_MUSIC_GAIN : SAMPLE_EFFECT_GAIN), this.currentTime); } catch { /* Optional audio. */ }
    this.notify();
  }
  setAggregationWindowMs(value: number): void {
    if (Number.isFinite(value)) this.aggregationWindowMs = Math.max(0, Math.min(1000, value));
  }
  setFastMode(fast: boolean): void { this.setAggregationWindowMs(fast ? FAST_AGGREGATION_MS : DEFAULT_AGGREGATION_MS); }
  /** Select from trusted bundled manifests. OFF stays silent and does not load.
   * Switching revokes old loads, queued hits and active voices before any await.
   * BGM has its own epoch and is never restarted by an effect-theme change. */
  setEffectsTheme(id: string, assets: EffectAssets): Promise<boolean> {
    if (this.destroyed) return Promise.resolve(false);
    if (this.effectMode === 'global' && id === this.effectTheme && assets === this.effectAssets) return Promise.resolve(this.effectsStatus === 'ready');
    this.effectMode = 'global'; this.effectTheme = id; this.effectAssets = assets;
    return this.reloadEffects(true);
  }
  /** Character selection is independent from manual override. OFF never fetches. */
  setEffectsMode(mode: EffectsMode): Promise<boolean> {
    if (this.destroyed || (mode !== 'global' && mode !== 'character')) return Promise.resolve(false);
    if (mode === this.effectMode) return Promise.resolve(this.effectsStatus === 'ready');
    this.effectMode = mode; return this.reloadEffects(true);
  }
  /** Call from the existing state render/restore path. This never plays a cue and
   * cannot reopen a suspended context without a new explicit audio gesture. */
  setPlayerCharacter(character: SoundCharacter): Promise<boolean> {
    if (this.destroyed || (character !== 'blue' && character !== 'red')) return Promise.resolve(false);
    if (character === this.playerCharacter) return Promise.resolve(this.effectsStatus === 'ready');
    this.playerCharacter = character;
    const state = this.groups.effect;
    const canContinue = this.context?.state === 'running' && (!state.needsGesture || state.loading);
    return this.reloadEffects(canContinue);
  }
  private effectBanks(): readonly EffectAssets[] {
    return this.effectMode === 'global' ? [withTransformationAsset(this.effectAssets, CHARACTER_TRANSFORMATION_ASSETS[this.playerCharacter])] :
      [characterEffectAssets(this.playerCharacter), characterEffectAssets('enemy')];
  }
  private reloadEffects(continuePlayback: boolean): Promise<boolean> {
    const state = this.groups.effect;
    state.epoch++; state.loading = false; state.needsGesture = true; state.error = null;
    this.stop('effect'); this.effects.clear(); this.notify();
    return state.wanted && continuePlayback ? this.enableEffectsGesture() : Promise.resolve(false);
  }
  setEffectsEnabled(enabled: boolean): void { this.setEnabled('effect', enabled); }
  setMusicEnabled(enabled: boolean): void { this.setEnabled('music', enabled); }
  /** 日本語: 敵の種類で音源だけを変更。OFF・非表示ではロード/自動再生しない。
   * English: Music selection has its own cancellation epoch; stale boss loads never restart. */
  setMusicAsset(asset:MusicAsset):Promise<boolean>{
    if(this.destroyed||asset.url===this.musicAsset.url)return Promise.resolve(this.musicStatus==='ready');
    const state=this.groups.music,canContinue=state.wanted&&!this.hidden&&this.context?.state==='running'&&(!state.needsGesture||state.loading);
    this.musicAsset=asset;state.epoch++;state.loading=false;state.error=null;state.needsGesture=true;this.stop('music');this.musicBuffer=null;this.notify();
    return canContinue?this.enableMusicGesture():Promise.resolve(false);
  }
  get musicAssetUrl():string{return this.musicAsset.url;}
  /** 日本語: 無効になった読込から大きな代替WAVを追加取得しない。English: Revoked loads cannot start a new fallback download. */
  private async loadMusic(context:AudioContext,asset:MusicAsset,isCurrent:()=>boolean):Promise<AudioBuffer>{try{return await loadSample(context,asset,this.fetcher);}catch(error){if(!asset.fallbackUrl||!isCurrent())throw error;return loadSample(context,{url:asset.fallbackUrl},this.fetcher);}}

  private setEnabled(group: AudioGroup, enabled: boolean): void {
    if (this.destroyed) return;
    const state = this.groups[group]; state.wanted = enabled;
    if (!enabled) {
      state.epoch++; state.loading = false; state.needsGesture = true; state.error = null;
      if (group === 'music') this.fadeMusic(); else this.stop(group);
    }
    this.notify();
  }
  /** Invoke these directly from the corresponding click/key handler. */
  enableEffectsGesture(): Promise<boolean> { return this.enableGroupGesture('effect'); }
  enableMusicGesture(): Promise<boolean> { return this.enableGroupGesture('music'); }
  private async enableGroupGesture(group: AudioGroup): Promise<boolean> {
    if (this.destroyed || this.hidden) return false;
    const state = this.groups[group], epoch = ++state.epoch, lifecycle = this.lifecycleEpoch;
    state.wanted = true; state.loading = true; state.error = null; state.needsGesture = true;
    this.notify();
    let context: AudioContext | null = null;
    try {
      context = this.getContext(group);
      const owned = context;
      // resume() is invoked before the first await, preserving gesture activation.
      const resume = context.state === 'running' ? Promise.resolve(true) : context.resume().then(
        () => owned.state === 'running', () => owned.state === 'running');
      const buffers = group === 'effect'
        ? Promise.all(this.effectBanks().flatMap(bank => Object.values(bank)).map(async asset => [asset.url, await loadSample(owned, asset, this.fetcher)] as const))
        : this.loadMusic(owned,this.musicAsset,()=>this.isCurrent(group,epoch,lifecycle,owned));
      const [ready, loaded] = await Promise.all([resume, buffers]);
      if (!this.isCurrent(group, epoch, lifecycle, context)) return false;
      if (!ready || context.state !== 'running') throw new Error('Audio needs another gesture to resume');
      if (group === 'effect') this.effects = new Map(loaded as readonly (readonly [string, AudioBuffer])[]);
      else { this.validateMusic(loaded as AudioBuffer); this.musicBuffer = loaded as AudioBuffer; }
      state.loading = false; state.needsGesture = false;
      if (group === 'music') this.startMusic();
      this.notify(); return this.groupStatus(group) === 'ready';
    } catch {
      if (this.isCurrent(group, epoch, lifecycle, context)) {
        state.loading = false; state.needsGesture = true; state.error = 'Audio could not be started. Tap to retry.';
        this.stop(group); this.notify();
      }
      return false;
    }
  }
  private isCurrent(group: AudioGroup, epoch: number, lifecycle: number, context: AudioContext | null): boolean {
    return !this.destroyed && !this.hidden && this.groups[group].wanted && this.groups[group].epoch === epoch &&
      this.lifecycleEpoch === lifecycle && (!context || this.context === context);
  }
  private getContext(activeGroup: AudioGroup): AudioContext {
    if (this.context && this.context.state !== 'closed') return this.context;
    if (this.context) {
      this.context.onstatechange = null; this.stop();
      // The other group's buffers and in-flight decode belong to the old context.
      for (const group of ['effect', 'music'] as const) if (group !== activeGroup) {
        const state = this.groups[group]; state.epoch++; state.loading = false; state.needsGesture = true; state.error = null;
      }
    }
    this.disconnectBuses(); this.effects.clear(); this.musicBuffer = null;
    const create = this.options.createContext ?? (() => {
      const ctor = globalThis.AudioContext ?? (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!ctor) throw new Error('Web Audio unavailable');
      return new ctor();
    });
    const context = create(); this.context = context;
    context.onstatechange = () => {
      if (this.context !== context || this.destroyed) return;
      if (context.state !== 'running') {
        // Any new suspension/interruption revokes the gesture, including while
        // decode is pending. A later browser auto-resume cannot restart sound.
        this.stop();
        for (const state of Object.values(this.groups)) {
          state.epoch++; state.loading = false; state.needsGesture = true;
        }
      }
      this.notify();
    };
    return context;
  }
  private bus(group: AudioGroup): GainNode {
    const context = this.context!;
    if (!this.master) {
      const master = context.createGain();
      try { master.gain.setValueAtTime(SAMPLE_MASTER_GAIN, context.currentTime); master.connect(context.destination); this.master = master; }
      catch (error) { try { master.disconnect(); } catch { /* Optional cleanup. */ } throw error; }
    }
    let bus = this.buses.get(group);
    if (!bus) {
      bus = context.createGain();
      try {
        bus.gain.setValueAtTime(this.getVolume(group) * (group === 'music' ? SAMPLE_MUSIC_GAIN : SAMPLE_EFFECT_GAIN), context.currentTime);
        bus.connect(this.master); this.buses.set(group, bus);
      } catch (error) { try { bus.disconnect(); } catch { /* Optional cleanup. */ } throw error; }
    }
    return bus;
  }
  /** Feed only accepted animation events, never prediction/preview events. */
  playEvent(event: SampleBattleEvent, resolution: object, eventIndex: number, signal?: AbortSignal, actorContext: EffectActorContext = {}): void {
    try {
      let indexes = this.seen.get(resolution);
      if (!indexes) { indexes = new Set(); this.seen.set(resolution, indexes); }
      if (indexes.has(eventIndex)) return;
      indexes.add(eventIndex); // Even aborted, muted and loading events are consumed.
      if (signal?.aborted || this.effectsStatus !== 'ready') return;
      const actor = effectActor(event);
      if (!actor) return;
      const character = event.type === 'transformation' && transformationIsValid(event)
        ? transformationSoundCharacter(event)! : actorContext.playerCharacterId ?? this.playerCharacter;
      const bank = this.effectMode === 'global' ? withTransformationAsset(this.effectAssets, CHARACTER_TRANSFORMATION_ASSETS[character]) : characterEffectAssets(actor === 'enemy' ? 'enemy' : character);
      const transformation = transformationIsValid(event);
      // Transformation has its own event/sample identity and replaceable PCM slot.
      const sample: EffectSample | null = transformation ? 'transformation' :
        sampleForBattleEvent(event, this.options.attackSampleRules) ?? damageSampleForBattleEvent(event);
      const asset = sample ? bank[sample] : undefined, buffer = asset ? this.effects.get(asset.url) : undefined;
      if (!sample || !buffer) return;
      const candidate: Candidate = { buffer, priority: EFFECT_SAMPLE_PRIORITY[sample], signal, cleanup: () => signal?.removeEventListener('abort', abort) };
      const abort = () => { this.pending.delete(candidate); candidate.cleanup(); };
      this.pending.add(candidate); signal?.addEventListener('abort', abort, { once: true });
      if (this.aggregateTimer !== null) return;
      const lifecycle = this.lifecycleEpoch, epoch = this.groups.effect.epoch;
      const aggregateEpoch = ++this.aggregateEpoch;
      this.aggregateTimer = this.setTimer(() => {
        if (aggregateEpoch !== this.aggregateEpoch) return;
        this.aggregateTimer = null;
        const candidates = [...this.pending]; this.pending.clear();
        for (const item of candidates) item.cleanup();
        if (lifecycle !== this.lifecycleEpoch || epoch !== this.groups.effect.epoch || this.effectsStatus !== 'ready') return;
        const winner = candidates.filter(item => !item.signal?.aborted).sort((a, b) => b.priority - a.priority)[0];
        if (winner) this.startEffect(winner.buffer, winner.signal);
      }, this.aggregationWindowMs);
    } catch { this.cancelAggregation(); }
  }
  private startEffect(buffer: AudioBuffer, signal?: AbortSignal): void {
    let voice: Voice | null = null;
    try {
      const context = this.context;
      if (!context || !buffer || signal?.aborted || this.effectsStatus !== 'ready') return;
      const previous = [...this.voices].filter(item => item.group === 'effect');
      const outgoing = previous.pop();
      // A third request during the fade retires the older tail before allocating.
      for (const tail of previous) this.endVoice(tail);
      const now = context.currentTime, end = now + EFFECT_CROSSFADE_SECONDS;
      if (outgoing) {
        const level = this.envelopeValue(outgoing.envelope, now);
        outgoing.gain.gain.cancelScheduledValues(now); outgoing.gain.gain.setValueAtTime(level, now);
        outgoing.gain.gain.linearRampToValueAtTime(0, end);
        outgoing.envelope = { from: level, to: 0, start: now, end };
        outgoing.source.stop(end);
      }
      voice = this.makeVoice('effect', buffer, { from: 0, to: 1, start: now, end }, signal);
      // Complementary linear ramps keep summed voice gain <= 1 throughout fade.
      voice.gain.gain.setValueAtTime(0, now); voice.gain.gain.linearRampToValueAtTime(1, end);
      voice.source.start(now);
    } catch {
      if (voice) this.endVoice(voice);
      const state = this.groups.effect; state.epoch++; state.loading = false; state.needsGesture = true;
      state.error = 'Audio could not be played. Tap to retry.'; this.stop('effect'); this.notify();
    }
  }
  private envelopeValue(envelope: Envelope, time: number): number {
    const fraction = Math.min(1, Math.max(0, (time - envelope.start) / Math.max(.000001, envelope.end - envelope.start)));
    return envelope.from + fraction * (envelope.to - envelope.from);
  }
  private makeVoice(group: AudioGroup, buffer: AudioBuffer, envelope: Envelope, signal?: AbortSignal): Voice {
    const context = this.context!;
    let source: AudioBufferSourceNode | null = null, gain: GainNode | null = null;
    try {
      source = context.createBufferSource(); gain = context.createGain(); source.buffer = buffer;
      source.connect(gain); gain.connect(this.bus(group));
      const voice: Voice = { source, gain, group, envelope, cleanup: () => signal?.removeEventListener('abort', abort) };
      const abort = () => this.endVoice(voice);
      this.voices.add(voice); signal?.addEventListener('abort', abort, { once: true });
      source.onended = () => this.releaseVoice(voice); return voice;
    } catch (error) { try { source?.disconnect(); gain?.disconnect(); } catch { /* Optional cleanup. */ } throw error; }
  }
  private validateMusic(buffer: AudioBuffer): void {
    const { loopStartSeconds: start, loopEndSeconds: end, startOffsetSeconds: offset = 0 } = this.musicAsset;
    const frame = 1 / (buffer.sampleRate || this.context?.sampleRate || 48000);
    if (![start, end, offset, buffer.duration].every(Number.isFinite) || start < 0 || end <= start ||
      (!this.musicAsset.loopWholeBuffer && end - buffer.duration > frame + Number.EPSILON) ||
      start >= buffer.duration || offset < 0 || offset >= Math.min(end, buffer.duration)) throw new Error('Invalid audio loop bounds');
  }
  private startMusic(): void {
    if (!this.context || !this.musicBuffer || this.musicStatus !== 'ready') return;
    this.stop('music');
    const now = this.currentTime;
    const voice = this.makeVoice('music', this.musicBuffer, { from: 0, to: 1, start: now, end: now + MUSIC_FADE_SECONDS });
    try {
      voice.gain.gain.setValueAtTime(0, now); voice.gain.gain.linearRampToValueAtTime(1, now + MUSIC_FADE_SECONDS); voice.source.loop = true;
      voice.source.loopStart = this.musicAsset.loopWholeBuffer ? 0 : this.musicAsset.loopStartSeconds;
      voice.source.loopEnd = this.musicAsset.loopWholeBuffer ? this.musicBuffer.duration : Math.min(this.musicAsset.loopEndSeconds, this.musicBuffer.duration);
      voice.source.start(now, this.musicAsset.startOffsetSeconds ?? 0);
    } catch (error) { this.endVoice(voice); throw error; }
  }
  private fadeMusic(): void {
    const now = this.currentTime, end = now + MUSIC_FADE_SECONDS;
    for (const voice of [...this.voices]) if (voice.group === 'music') {
      try {
        const level = this.envelopeValue(voice.envelope, now);
        voice.gain.gain.cancelScheduledValues(now); voice.gain.gain.setValueAtTime(level, now);
        voice.gain.gain.linearRampToValueAtTime(0, end); voice.envelope = { from: level, to: 0, start: now, end };
        voice.source.stop(end);
      } catch { this.endVoice(voice); }
    }
  }
  restartMusic(): void {
    try { if (this.musicStatus === 'ready') this.startMusic(); }
    catch { this.groups.music.error = 'Audio could not be started. Tap to retry.'; this.groups.music.needsGesture = true; this.notify(); }
  }
  private releaseVoice(voice: Voice): void {
    voice.cleanup(); this.voices.delete(voice); voice.source.onended = null;
    try { voice.source.disconnect(); } catch { /* Already detached. */ }
    try { voice.gain.disconnect(); } catch { /* Already detached. */ }
  }
  private endVoice(voice: Voice): void { try { voice.source.stop(); } catch { /* Already stopped. */ } this.releaseVoice(voice); }
  private setTimer(callback: () => void, milliseconds: number): unknown { return this.options.setTimer ? this.options.setTimer(callback, milliseconds) : setTimeout(callback, milliseconds); }
  private cancelAggregation(): void {
    this.aggregateEpoch++;
    if (this.aggregateTimer !== null) {
      try { if (this.options.clearTimer) this.options.clearTimer(this.aggregateTimer); else clearTimeout(this.aggregateTimer as ReturnType<typeof setTimeout>); } catch { /* Optional cleanup. */ }
      this.aggregateTimer = null;
    }
    for (const item of this.pending) item.cleanup(); this.pending.clear();
  }
  stop(group?: string): void {
    if (group === undefined || group === 'effect') this.cancelAggregation();
    for (const voice of [...this.voices]) if (group === undefined || voice.group === group) this.endVoice(voice);
  }
  reset(): void {
    this.lifecycleEpoch++; this.stop();
    for (const state of Object.values(this.groups)) { state.epoch++; if (state.loading) state.needsGesture = true; state.loading = false; }
    // Keep the WeakMap: reset must not permit replay of a prior resolution.
    this.notify();
  }
  setHidden(hidden: boolean): void {
    if (this.destroyed || this.hidden === hidden) return;
    this.hidden = hidden;
    if (hidden) {
      this.reset(); for (const state of Object.values(this.groups)) state.needsGesture = true;
      try { void this.context?.suspend().catch(() => {}); } catch { /* Optional API. */ }
    }
    this.notify();
  }
  mute(): void {
    this.lifecycleEpoch++;
    for (const state of Object.values(this.groups)) { state.wanted = false; state.epoch++; state.loading = false; state.needsGesture = true; state.error = null; }
    this.stop(); this.notify();
  }
  private disconnectBuses(): void {
    for (const bus of this.buses.values()) { try { bus.disconnect(); } catch { /* Optional cleanup. */ } }
    this.buses.clear(); try { this.master?.disconnect(); } catch { /* Optional cleanup. */ } this.master = null;
  }
  destroy(): void {
    if (this.destroyed) return;
    this.mute(); this.destroyed = true; this.listeners.clear();
    if (this.context) { this.context.onstatechange = null; try { void this.context.close().catch(() => {}); } catch { /* Optional API. */ } }
    this.context = null; this.disconnectBuses(); this.effects.clear(); this.musicBuffer = null;
  }
}
