import type { EffectAssets, SampleAsset } from './sampleAssets.ts';
import type { SoundCharacter } from './characterSoundThemes.ts';

interface TransformationSampleAsset extends SampleAsset {
  readonly id: string;
  readonly provenance: 'existing-native-pcm' | 'dedicated-native-pcm';
}
/** Two dedicated native-JummBox rise/release cues. Source projects and measured
 * PCM contracts are versioned with the assets; runtime does no synthesis/gain baking. */
export const CHARACTER_TRANSFORMATION_ASSETS: Readonly<Record<SoundCharacter, TransformationSampleAsset>> = Object.freeze({
  blue: { id: 'transformation-blue', url: '/assets/audio/transformation-v1/transform_blue_v1.wav', provenance: 'dedicated-native-pcm' },
  red: { id: 'transformation-red', url: '/assets/audio/transformation-v1/transform_red_v1.wav', provenance: 'dedicated-native-pcm' },
});
/** The manual override changes attack palettes, while transformation always
 * identifies the player character. Enemy banks do not get a transformation cue. */
export function withTransformationAsset(effects: EffectAssets, transformation: SampleAsset): EffectAssets {
  return { ...effects, transformation };
}
