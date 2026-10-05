import {mountSampleControl} from './sampleAudioControls.ts';
import type {SoundControl} from './sampleAudioControls.ts';
interface MusicVolume {getVolume(group:string):number;setVolume(group:string,value:number):void;subscribe(listener:()=>void):()=>void}
/** 日本語: ホーム専用の表示だけを追加。ON/OFFと音量は戦闘と同じ音声状態。
 * English: Home adds a view, never a second player or preference store. */
export function mountHomeMusicControls(music:SoundControl,audio:MusicVolume,host:HTMLElement):()=>void{
 const disposeToggle=mountSampleControl(music,host,{id:'home-music-toggle',label:'BGM',icon:'music',description:'ホームとステージで共通のBGM設定です。出発・帰還で曲が切り替わります。'});
 const label=document.createElement('label');label.htmlFor='home-music-volume';label.textContent='音量';
 const slider=document.createElement('input');slider.id='home-music-volume';slider.type='range';slider.min='0';slider.max='100';slider.step='5';slider.setAttribute('aria-label','BGMの音量（ホーム・ステージ共通）');
 const output=document.createElement('output');output.setAttribute('for',slider.id);
 const update=()=>{slider.value=String(Math.round(audio.getVolume('music')*100));output.textContent=`${slider.value}%`;slider.setAttribute('aria-valuetext',`${slider.value}%`);};
 const input=()=>audio.setVolume('music',Number(slider.value)/100);
 slider.addEventListener('input',input);host.append(label,slider,output);const off=audio.subscribe(update);update();
 return ()=>{off();disposeToggle();slider.removeEventListener('input',input);label.remove();slider.remove();output.remove();};
}
