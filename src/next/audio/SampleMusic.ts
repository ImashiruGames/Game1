import type { SampleAudioDirector } from './SampleAudioDirector.ts';

/** Thin independent BGM preference/control over the director's decoded loop. */
export class SampleMusic {
  private readonly audio: SampleAudioDirector;
  private destroyed = false;
  constructor(audio: SampleAudioDirector) { this.audio = audio; }
  get enabled(): boolean { return !this.destroyed && this.audio.musicEnabled; }
  get status(): SampleAudioDirector['musicStatus'] { return this.destroyed ? 'off' : this.audio.musicStatus; }
  get error(): string | null { return this.audio.getError('music'); }
  subscribe(listener: () => void): () => void { return this.audio.subscribe(listener); }
  enableGesture(): Promise<boolean> { return this.destroyed ? Promise.resolve(false) : this.audio.enableMusicGesture(); }
  setEnabled(enabled: boolean): void { if (!this.destroyed) this.audio.setMusicEnabled(enabled); }
  restart(): void { if (!this.destroyed) this.audio.restartMusic(); }
  destroy(): void { if (!this.destroyed) this.audio.setMusicEnabled(false); this.destroyed = true; }
}
