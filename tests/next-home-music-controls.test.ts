import test from 'node:test';
import assert from 'node:assert/strict';
import {mountHomeMusicControls} from '../src/next/audio/homeMusicControls.ts';
import {mountPresentationSettings,PRESENTATION_SETTINGS_KEY,DEFAULT_PRESENTATION_SETTINGS} from '../src/next/audio/presentationSettings.ts';
import {mountSampleControl} from '../src/next/audio/sampleAudioControls.ts';
import {SampleAudioDirector} from '../src/next/audio/SampleAudioDirector.ts';
import {MusicSceneController,HOME_MUSIC} from '../src/next/audio/musicScene.ts';
import {SampleMusic} from '../src/next/audio/SampleMusic.ts';
import {NEON_AUDIO_ASSETS} from '../src/next/audio/neonAudioAssets.ts';
class Element {
 id='';type='';value='';textContent='';title='';className='';htmlFor='';min='';max='';step='';checked=false;removed=false;
 attrs=new Map<string,string>();handlers=new Map<string,Set<()=>void>>();children:Element[]=[];queries=new Map<string,Element>();
 setAttribute(k:string,v:string){this.attrs.set(k,v);}
 addEventListener(k:string,fn:()=>void){if(!this.handlers.has(k))this.handlers.set(k,new Set());this.handlers.get(k)!.add(fn);}
 removeEventListener(k:string,fn:()=>void){this.handlers.get(k)?.delete(fn);}
 dispatch(k:string){this.handlers.get(k)?.forEach(fn=>fn());}
 append(...nodes:Element[]){this.children.push(...nodes);}
 remove(){this.removed=true;}
 set innerHTML(html:string){this.textContent=Array.from(html.matchAll(/<span[^>]*>([^<]*)<\/span>/g),m=>m[1]).join("\n");}
 querySelector(key:string){if(!this.queries.has(key))this.queries.set(key,new Element());return this.queries.get(key)!;}
}
function setup(saved?:object,successful=false){
 const oldDocument=globalThis.document,oldStorage=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 const storage=new Map<string,string>();if(saved)storage.set(PRESENTATION_SETTINGS_KEY,JSON.stringify(saved));
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v)}});
 globalThis.document={createElement:()=>new Element(),body:{dataset:{}},dispatchEvent(){}} as unknown as Document;
 let contexts=0;
 const sources:{stopped:boolean;onended:(()=>void)|null;start():void;stop():void;connect():void;disconnect():void}[]=[];
 const context={state:'suspended',currentTime:0,destination:{},onstatechange:null,
  createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},cancelScheduledValues(){}},connect(){},disconnect(){}};},
  createBufferSource(){const source={stopped:false,onended:null as (()=>void)|null,start(){},stop(){this.stopped=true;this.onended?.();},connect(){},disconnect(){}};sources.push(source);return source;},
  async decodeAudioData(){return {duration:180};},async resume(){this.state='running';},async close(){this.state='closed';}};
 const audio=new SampleAudioDirector(NEON_AUDIO_ASSETS,{createContext(){contexts++;if(successful)return context as unknown as AudioContext;throw Error('test unavailable');},fetch:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)})}),music=new SampleMusic(audio);
 const settingsHost=new Element(),short=new Element(),homeHost=new Element(),battleHost=new Element(),speed=new Element(),speedNote=new Element();
 const disposeSettings=mountPresentationSettings(audio,settingsHost as unknown as HTMLElement,short as unknown as HTMLInputElement,{select:speed as unknown as HTMLSelectElement,note:speedNote as unknown as HTMLElement});
 const disposeHome=mountHomeMusicControls(music,audio,homeHost as unknown as HTMLElement);
 const disposeBattle=mountSampleControl(music,battleHost as unknown as HTMLElement,{id:'battle-test',label:'BGM',description:''});
 return {speed,speedNote,audio,music,sources,homeHost,battleHost,settings:settingsHost.children[0]!,storage,short,get contexts(){return contexts;},close(){disposeHome();disposeBattle();disposeSettings();audio.destroy();globalThis.document=oldDocument;if(oldStorage)Object.defineProperty(globalThis,'localStorage',oldStorage);else Reflect.deleteProperty(globalThis,'localStorage');}};
}
test('home and battle share volume, persistence, intent, and do not unlock on mount',()=>{
 const s=setup();try{
 assert.equal(s.contexts,0);assert.equal(s.homeHost.children[0]!.textContent,'BGM\nOFF');
 const slider=s.homeHost.children[2]!;slider.value='35';slider.dispatch('input');
 assert.equal(s.audio.getVolume('music'),.35);assert.equal(s.settings.querySelector('#music-volume').value,'35');
 assert.equal(JSON.parse(s.storage.get(PRESENTATION_SETTINGS_KEY)!).musicVolume,.35);
 s.short.checked=true;s.short.dispatch('change');assert.equal(s.audio.getVolume('music'),.35);
 const stageSlider=s.settings.querySelector('#music-volume');stageSlider.value='65';stageSlider.dispatch('input');stageSlider.dispatch('change');
 assert.equal(slider.value,'65');assert.equal(s.homeHost.children[3]!.textContent,'65%');
 s.homeHost.children[0]!.dispatch('click');assert.equal(s.contexts,1);assert.equal(s.audio.musicEnabled,true);assert.equal(s.audio.effectsEnabled,false);assert.match(s.battleHost.children[0]!.textContent,/再試行/);
 s.audio.setMusicEnabled(false);assert.equal(s.homeHost.children[0]!.textContent,'BGM\nOFF');assert.equal(s.battleHost.children[0]!.textContent,'BGM\nOFF');
 assert.equal(JSON.parse(s.storage.get(PRESENTATION_SETTINGS_KEY)!).musicEnabled,false);
 }finally{s.close();}
});
test('saved ON restores only resumable intent with shared volume, never a context or autoplay',()=>{
 const s=setup({...DEFAULT_PRESENTATION_SETTINGS,musicVolume:.2,musicEnabled:true});try{
 assert.equal(s.contexts,0);assert.equal(s.audio.musicStatus,'resume');assert.equal(s.homeHost.children[0]!.textContent,'BGM\n再開');assert.equal(s.homeHost.children[2]!.value,'20');
 }finally{s.close();}
});
test('home controls unsubscribe and remove handlers without stopping the shared player',()=>{
 const s=setup();const slider=s.homeHost.children[2]!,button=s.homeHost.children[0]!;s.close();assert.equal(slider.removed,true);assert.equal(button.removed,true);assert.equal(slider.handlers.get('input')?.size,0);assert.equal(button.handlers.get('click')?.size,0);
});

test('home gesture unlocks the same player across departure, boss and return; battle OFF stops all scenes',async()=>{
 const s=setup(undefined,true),scene=new MusicSceneController(s.audio);
 const settle=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
 try{
 s.homeHost.children[0]!.dispatch('click');await settle();assert.equal(s.audio.musicStatus,'ready');assert.equal(s.audio.musicAssetUrl,HOME_MUSIC.url);
 assert.equal(s.battleHost.children[0]!.textContent,'BGM\nON');
 s.homeHost.children[2]!.value='40';s.homeHost.children[2]!.dispatch('input');
 await scene.enterBattle('marujiro');assert.equal(s.audio.musicStatus,'ready');assert.equal(s.audio.getVolume('music'),.4);
 await scene.enterBattle('speed-core');assert.equal(s.sources.filter(x=>!x.stopped).length,1);
 await scene.showHome();assert.equal(s.audio.musicAssetUrl,HOME_MUSIC.url);assert.equal(s.sources.filter(x=>!x.stopped).length,1);
 s.battleHost.children[0]!.dispatch('click');assert.equal(s.audio.musicEnabled,false);assert.equal(s.sources.filter(x=>!x.stopped).length,0);
 await scene.enterBattle('mother-core');assert.equal(s.audio.musicStatus,'off');assert.equal(s.homeHost.children[0]!.textContent,'BGM\nOFF');assert.equal(s.audio.effectsEnabled,false);
 }finally{s.close();}
});


test('visible speed shares settings persistence without resetting volume or music; old saves reload unchanged',()=>{
 const saved={...DEFAULT_PRESENTATION_SETTINGS,shortAnimations:true,musicVolume:.35,musicEnabled:true};
 const s=setup(saved);let roundtrip:object;try{
 assert.equal(s.speed.value,'fast');assert.equal(s.short.checked,true);assert.equal(s.contexts,0);
 s.speed.value='medium';s.speed.dispatch('change');assert.equal(s.short.checked,false);
 const stored=JSON.parse(s.storage.get(PRESENTATION_SETTINGS_KEY)!);assert.equal(stored.shortAnimations,false);assert.equal(stored.musicVolume,.35);assert.equal(stored.musicEnabled,true);assert.equal(s.contexts,0);
 s.short.checked=true;s.short.dispatch('change');assert.equal(s.speed.value,'fast');
 s.settings.querySelector('#low-motion').checked=true;s.settings.querySelector('#low-motion').dispatch('change');
 assert.equal(s.speedNote.textContent,'動き低減');assert.match(s.speed.title,/光・揺れの低減/);
 s.speed.value='medium';s.speed.dispatch('change');assert.equal(s.speed.value,'medium');assert.equal(s.speedNote.textContent,'動き低減');assert.equal(s.settings.querySelector('#low-motion').checked,true);
 roundtrip=JSON.parse(s.storage.get(PRESENTATION_SETTINGS_KEY)!);
 }finally{s.close();}
 const restored=setup(roundtrip!);try{assert.equal(restored.speed.value,'medium');assert.equal(restored.speedNote.textContent,'動き低減');assert.equal(restored.audio.getVolume('music'),.35);assert.equal(restored.contexts,0);}finally{restored.close();}
});

test('all three speed selections persist while visual reduction remains independent',()=>{
 for(const speed of ['slow','medium','fast'])for(const lowMotion of [false,true]){
  const s=setup({...DEFAULT_PRESENTATION_SETTINGS,lowMotion});let stored:object;
  try{s.speed.value=speed;s.speed.dispatch('change');assert.equal(s.speed.value,speed);assert.equal(s.short.checked,speed==='fast');assert.equal(s.settings.querySelector('#low-motion').checked,lowMotion);stored=JSON.parse(s.storage.get(PRESENTATION_SETTINGS_KEY)!);assert.equal((stored as {speed:string}).speed,speed);}
  finally{s.close();}
  const restored=setup(stored!);try{assert.equal(restored.speed.value,speed);assert.equal(restored.settings.querySelector('#low-motion').checked,lowMotion);}finally{restored.close();}
 }
});
