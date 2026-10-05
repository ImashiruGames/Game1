import {resolveBattlePace,type BattlePace} from '../ui/animationTimeline.ts';
import {renderBattleSpeed,type BattleSpeedControls} from '../ui/battleSpeed.ts';
import type { AudioDirector } from './AudioDirector.ts';

export function presentationSettingsKey(pathname:string):string{const route=['save-preview','build-ui-preview','audio-asset-preview','night-qa','energy-qa'].find(name=>pathname===`/${name}`||pathname.startsWith(`/${name}/`));return `game1-${route??'next'}-presentation-settings-v1`;}
export const PRESENTATION_SETTINGS_KEY=presentationSettingsKey(typeof window==='undefined'?'/next/':window.location.pathname);
export interface PresentationSettings {
  readonly version:1;
  readonly musicEnabled?:boolean;
  readonly effectVolume:number;
  readonly musicVolume:number;
  readonly lowMotion:boolean;
  readonly shortAnimations:boolean;
  readonly speed?:BattlePace;
}
export interface SettingsStorage {getItem(key:string):string|null;setItem(key:string,value:string):void;}
export const DEFAULT_PRESENTATION_SETTINGS:PresentationSettings={version:1,effectVolume:1,musicVolume:1,lowMotion:false,shortAnimations:false};
export function parsePresentationSettings(raw:string|null,fallback:PresentationSettings=DEFAULT_PRESENTATION_SETTINGS):PresentationSettings{
  if(raw===null)return {...fallback};
  try{
    const s=JSON.parse(raw) as Partial<PresentationSettings>|null;
    if(!s||s.version!==1||typeof s.effectVolume!=='number'||!Number.isFinite(s.effectVolume)||s.effectVolume<0||s.effectVolume>1||typeof s.musicVolume!=='number'||!Number.isFinite(s.musicVolume)||s.musicVolume<0||s.musicVolume>1||typeof s.lowMotion!=='boolean'||typeof s.shortAnimations!=='boolean')return {...fallback};
    return {...(typeof s.musicEnabled==='boolean'?{musicEnabled:s.musicEnabled}:{}),version:1,effectVolume:s.effectVolume,musicVolume:s.musicVolume,lowMotion:s.lowMotion,shortAnimations:s.speed==='fast'||(!['slow','medium','fast'].includes(s.speed??'')&&s.shortAnimations),...(s.speed==='slow'||s.speed==='medium'||s.speed==='fast'?{speed:s.speed}:{})};
  }catch{return {...fallback};}
}
export function readPresentationSettings(storage:SettingsStorage|null,fallback=DEFAULT_PRESENTATION_SETTINGS):PresentationSettings{
  try{return parsePresentationSettings(storage?.getItem(PRESENTATION_SETTINGS_KEY)??null,fallback);}catch{return {...fallback};}
}
export function savePresentationSettings(storage:SettingsStorage|null,settings:PresentationSettings):boolean{
  try{if(!storage)return false;storage.setItem(PRESENTATION_SETTINGS_KEY,JSON.stringify(settings));return true;}catch{return false;}
}
export function shouldReduceMotion(settings:Pick<PresentationSettings,'lowMotion'>,systemReducedMotion:boolean):boolean{return settings.lowMotion||systemReducedMotion;}
/** New settings key only. Initialization reads without writing or migrating game saves. */
export function mountPresentationSettings(audio:Pick<AudioDirector,'getVolume'|'setVolume'>&{readonly musicEnabled?:boolean;setMusicEnabled?(enabled:boolean):void;subscribe?(listener:()=>void):()=>void},host:HTMLElement,shortCheckbox:HTMLInputElement,speed?:BattleSpeedControls):()=>void{
  let storage:SettingsStorage|null=null;try{storage=localStorage;}catch{/* Storage denied: controls stay usable. */}
  const fallback:PresentationSettings={version:1,effectVolume:audio.getVolume('effect'),musicVolume:audio.getVolume('music'),lowMotion:document.body.dataset.reducedMotion==='true',shortAnimations:shortCheckbox.checked};
  let settings=readPresentationSettings(storage,fallback);
  const system=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):null;
  const section=document.createElement('section');section.className='settings';section.id='presentation-settings';
  section.innerHTML='<h3>サウンドと演出</h3><label class="volume-row" for="effect-volume"><span>効果音</span><input id="effect-volume" type="range" min="0" max="100" step="5" aria-label="効果音の音量"><output id="effect-volume-value"></output></label><label class="volume-row" for="music-volume"><span>BGM</span><input id="music-volume" type="range" min="0" max="100" step="5" aria-label="BGMの音量"><output id="music-volume-value"></output></label><label><input id="low-motion" type="checkbox"> 光・揺れを抑える</label><p id="motion-system-note"></p><p id="presentation-settings-status" role="status"></p>';
  host.append(section);
  const effect=section.querySelector<HTMLInputElement>('#effect-volume')!,music=section.querySelector<HTMLInputElement>('#music-volume')!,lowMotion=section.querySelector<HTMLInputElement>('#low-motion')!,status=section.querySelector<HTMLElement>('#presentation-settings-status')!;
  const apply=()=>{
    audio.setVolume('effect',settings.effectVolume);audio.setVolume('music',settings.musicVolume);
    effect.value=String(Math.round(settings.effectVolume*100));music.value=String(Math.round(settings.musicVolume*100));lowMotion.checked=settings.lowMotion;shortCheckbox.checked=settings.shortAnimations;
    section.querySelector('output#effect-volume-value')!.textContent=`${effect.value}%`;section.querySelector('output#music-volume-value')!.textContent=`${music.value}%`;
    const reduced=shouldReduceMotion(settings,system?.matches??false);document.body.dataset.reducedMotion=String(reduced);
    const pace=resolveBattlePace({speed:settings.speed,short:settings.shortAnimations});document.body.dataset.battleSpeed=pace;
    if(speed)renderBattleSpeed(speed,pace,settings.lowMotion,system?.matches??false);
    section.querySelector('#motion-system-note')!.textContent=system?.matches?'端末の「視差効果を減らす」設定も適用中です。':'';
    document.dispatchEvent(new CustomEvent('game1:presentation-settings',{detail:{speed:pace,short:pace==='fast',lowMotion:reduced}}));
  };
  const persist=()=>{status.textContent=savePresentationSettings(storage,settings)?'':'保存できませんでした。この画面では設定が有効です';};
  const volumeChange=()=>{settings={...settings,effectVolume:Number(effect.value)/100,musicVolume:Number(music.value)/100};apply();};
  effect.addEventListener('input',volumeChange);music.addEventListener('input',volumeChange);effect.addEventListener('change',persist);music.addEventListener('change',persist);
  lowMotion.addEventListener('change',()=>{settings={...settings,lowMotion:lowMotion.checked};apply();persist();});
  const shortChange=()=>{settings={...settings,speed:shortCheckbox.checked?'fast':'medium',shortAnimations:shortCheckbox.checked};apply();persist();};shortCheckbox.addEventListener('change',shortChange);
  const speedChange=()=>{if(!speed||!['slow','medium','fast'].includes(speed.select.value))return;settings={...settings,speed:speed.select.value as BattlePace,shortAnimations:speed.select.value==='fast'};apply();persist();};
  speed?.select.addEventListener('change',speedChange);
  system?.addEventListener('change',apply);apply();
  // 日本語: 同じ音声状態をホームと戦闘で共有。保存ONも操作前は再生しない。
  // English: Both surfaces observe the same director; restored intent never unlocks playback.
  if(settings.musicEnabled!==undefined)audio.setMusicEnabled?.(settings.musicEnabled);
  const unsubscribe=audio.subscribe?.(()=>{
    const effectVolume=audio.getVolume('effect'),musicVolume=audio.getVolume('music'),musicEnabled=audio.musicEnabled;
    if(settings.effectVolume===effectVolume&&settings.musicVolume===musicVolume&&settings.musicEnabled===musicEnabled)return;
    settings={...settings,effectVolume,musicVolume,...(musicEnabled===undefined?{}:{musicEnabled})};
    effect.value=String(Math.round(effectVolume*100));music.value=String(Math.round(musicVolume*100));
    section.querySelector('output#effect-volume-value')!.textContent=`${effect.value}%`;section.querySelector('output#music-volume-value')!.textContent=`${music.value}%`;
    persist();
  });
  return ()=>{speed?.select.removeEventListener('change',speedChange);unsubscribe?.();shortCheckbox.removeEventListener('change',shortChange);system?.removeEventListener('change',apply);section.remove();};
}
