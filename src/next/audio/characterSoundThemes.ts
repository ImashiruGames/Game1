import {isRosterId} from '../meta/roster.ts';
import type {RosterId} from '../meta/roster.ts';
import { CHARACTER_TRANSFORMATION_ASSETS, withTransformationAsset } from './transformationAssets.ts';
import { soundTheme } from './soundThemes.ts';
import type { SoundThemeId } from './soundThemes.ts';
import type { EffectAssets, SampleBattleEvent } from './sampleAssets.ts';

export type SoundCharacter = 'blue' | 'red';
export type EffectsMode = 'global' | 'character';
export interface EffectActorContext { readonly playerCharacterId?: SoundCharacter }
/** Presentation-only assignments. Change these IDs to rebalance the sound palette.
 * Enemy attacks never inherit the selected player's character palette. */
export const CHARACTER_EFFECT_THEMES: Readonly<Record<SoundCharacter | 'enemy', SoundThemeId>> = Object.freeze({
  blue: 'intellectual', red: 'fire', enemy: 'neon',
});
export function characterEffectAssets(character: SoundCharacter | 'enemy'): EffectAssets {
  const effects = soundTheme(CHARACTER_EFFECT_THEMES[character]).effects;
  return character === 'enemy' ? effects : withTransformationAsset(effects, CHARACTER_TRANSFORMATION_ASSETS[character]);
}
/** A transformation is player-only. A Blue counter can be emitted inside an enemy
 * resolution, so its semantic source and damaged side outrank action ownership. */
export function effectActor(event: SampleBattleEvent): 'player' | 'enemy' | null {
  if (event.type === 'transformation') return transformationIsValid(event) ? 'player' : null;
  if (event.type === 'damage' && event.source === 'blue-transformation' && event.target === 'enemy') return 'player';
  return event.actor === 'player' || event.actor === 'enemy' ? event.actor : null;
}
export function transformationIsValid(event: SampleBattleEvent): boolean {
  return event.type === 'transformation' && isRosterId(event.character) &&
    (event.actor === undefined || event.actor === 'player');
}

/** Existing recorded banks are explicitly reused; no new character composition is implied. */
export const ROSTER_TRANSFORMATION_BANK:Readonly<Record<RosterId,SoundCharacter>>=Object.freeze({blue:'blue',red:'red',mint:'red',amber:'red',violet:'red',silver:'red',rose:'red',imashiru:'red'});
export function transformationSoundCharacter(event:SampleBattleEvent):SoundCharacter|null{return transformationIsValid(event)&&isRosterId(event.character)?ROSTER_TRANSFORMATION_BANK[event.character]:null;}
