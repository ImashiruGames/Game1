import type { EffectActorContext } from './characterSoundThemes.ts';
import type { SampleBattleEvent } from './sampleAssets.ts';
import type { TransformationRequest, TransformationResult } from '../ui/transformationCinematic.ts';

interface TransformationAudio {
  playEvent(event: SampleBattleEvent, resolution: object, eventIndex: number, signal?: AbortSignal, context?: EffectActorContext): void;
}
interface TransformationPlayer { play(request: TransformationRequest): Promise<TransformationResult> }
/** Use only on the committed animate event path. Skip/cancel retire the cue's
 * voice and pending aggregate without aborting the battle signal. Normal short
 * completion allows the 0.8s PCM tail to finish without adding a UI wait. */
export async function playTransformationWithSample(
  audio: TransformationAudio, cinematic: TransformationPlayer, request: TransformationRequest,
  resolution: object, eventIndex: number, context?: EffectActorContext,
): Promise<TransformationResult> {
  const sound = new AbortController();
  let signal = sound.signal;
  let clearRelay = () => {};
  if (request.signal) {
    if (typeof AbortSignal.any === 'function') signal = AbortSignal.any([request.signal, sound.signal]);
    else {
      // Older Safari: relay cancellation through the entire 80ms aggregation +
      // 800ms PCM tail. At expiry, abort before detaching: a main-thread stall
      // may delay aggregation/playback, and its late cue must never be orphaned.
      // The 20ms margin never delays the cinematic promise; only delayed legacy
      // cues can be shortened/dropped by this conservative fallback deadline.
      const parent = request.signal;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let released = false;
      clearRelay = () => { if (released) return; released = true; parent.removeEventListener('abort', relay); if (timer !== undefined) { clearTimeout(timer); timer = undefined; } };
      const relay = () => { sound.abort(); clearRelay(); };
      parent.addEventListener('abort', relay, { once: true });
      if (parent.aborted) relay();
      else timer = setTimeout(() => { sound.abort(); clearRelay(); }, 900);
    }
  }
  let completed = false;
  try {
    const playing = cinematic.play(request);
    try { audio.playEvent(request.event, resolution, eventIndex, signal, context); } catch { /* Optional audio cannot hold up a committed event. */ }
    const result = await playing;
    completed = result.status === 'completed';
    return result;
  } finally {
    if (!completed) { sound.abort(); clearRelay(); }
  }
}
