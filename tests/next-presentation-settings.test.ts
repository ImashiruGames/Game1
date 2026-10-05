import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PRESENTATION_SETTINGS as defaults, PRESENTATION_SETTINGS_KEY,presentationSettingsKey,parsePresentationSettings,readPresentationSettings,savePresentationSettings,shouldReduceMotion } from '../src/next/audio/presentationSettings.ts';
import { AudioDirector } from '../src/next/audio/AudioDirector.ts';
test('fresh settings preserve supplied current session defaults',()=>{
 const current={...defaults,effectVolume:.65,shortAnimations:true};assert.deepEqual(parsePresentationSettings(null,current),current);
});
test('settings round trip in a key isolated from battle save',()=>{
 const values=new Map<string,string>();let writes=0;
 const store={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{writes++;values.set(key,value);}};
 readPresentationSettings(store);assert.equal(writes,0);
 const settings={...defaults,musicVolume:.25,lowMotion:true};assert.equal(savePresentationSettings(store,settings),true);assert.equal(writes,1);assert.deepEqual(readPresentationSettings(store),settings);assert.equal(values.size,1);assert.ok(values.has(PRESENTATION_SETTINGS_KEY));
});
test('corrupt, unrecognized version, missing fields and invalid volumes leave defaults untouched',()=>{
 for(const raw of ['bad JSON','null','[]',JSON.stringify({...defaults,version:2}),JSON.stringify({...defaults,effectVolume:-1}),JSON.stringify({...defaults,musicVolume:2}),JSON.stringify({...defaults,lowMotion:'true'}),'{}'])assert.deepEqual(parsePresentationSettings(raw),defaults);
});
test('denied storage never breaks settings or gameplay',()=>{
 const denied={getItem(){throw Error('denied');},setItem(){throw Error('quota');}};
 assert.deepEqual(readPresentationSettings(denied),defaults);assert.equal(savePresentationSettings(denied,defaults),false);assert.equal(savePresentationSettings(null,defaults),false);
});
test('OS reduced motion always wins; user can opt into stronger reduction',()=>{
 assert.equal(shouldReduceMotion({lowMotion:false},false),false);assert.equal(shouldReduceMotion({lowMotion:true},false),true);assert.equal(shouldReduceMotion({lowMotion:false},true),true);
});
test('audio bus volumes can be set before unlock and clamp to safe range',()=>{
 const audio=new AudioDirector(()=>{throw Error('must not construct during settings');});audio.setVolume('effect',.4);audio.setVolume('music',.25);
 assert.equal(audio.getVolume('effect'),.4);assert.equal(audio.getVolume('music'),.25);assert.equal(audio.status,'off');
 audio.setVolume('effect',-10);assert.equal(audio.getVolume('effect'),0);audio.setVolume('music',10);assert.equal(audio.getVolume('music'),1);audio.setVolume('music',NaN);assert.equal(audio.getVolume('music'),1);
});
test('separate gain buses update active volume without replacing per-note envelope',async()=>{
 const gains:{values:number[];gain:{setValueAtTime(value:number):void;linearRampToValueAtTime(value:number):void;exponentialRampToValueAtTime(value:number):void};connect():void;disconnect():void}[]=[];
 const context={state:'running',currentTime:1,destination:{},onstatechange:null,
  createGain(){const values:number[]=[];const node={values,gain:{setValueAtTime(value:number){values.push(value);},linearRampToValueAtTime(value:number){values.push(value);},exponentialRampToValueAtTime(value:number){values.push(value);}},connect(){},disconnect(){}};gains.push(node);return node;},
  createOscillator(){return {type:'sine',frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},onended:null,connect(){},disconnect(){},start(){},stop(){}};},async resume(){},async close(){}
 };
 const audio=new AudioDirector(()=>context as unknown as AudioContext);audio.setVolume('effect',.8);audio.setVolume('music',.3);await audio.enableEffectsGesture();
 const tone={frequency:440,duration:.1,gain:.07};audio.playTones([tone],'effect');audio.playTones([tone],'music');
 assert.deepEqual(gains[1]!.values,[.8]);assert.deepEqual(gains[3]!.values,[.3]);const envelope=[...gains[0]!.values];
 audio.setVolume('effect',.2);assert.deepEqual(gains[1]!.values,[.8,.2]);assert.deepEqual(gains[3]!.values,[.3]);assert.deepEqual(gains[0]!.values,envelope);
 audio.destroy();
});

test('preview preferences use a different key from the production game',()=>{
 assert.equal(presentationSettingsKey('/next/'),'game1-next-presentation-settings-v1');
 for(const path of ['/save-preview','/save-preview/','/save-preview/viewport'])assert.equal(presentationSettingsKey(path),'game1-save-preview-presentation-settings-v1');
 assert.equal(presentationSettingsKey('/save-preview-other/'),'game1-next-presentation-settings-v1');
});

test('build UI review preferences never read or overwrite other route settings',()=>{
 const keys=['/next/','/save-preview/','/build-ui-preview/'].map(presentationSettingsKey);assert.equal(new Set(keys).size,3);assert.equal(presentationSettingsKey('/build-ui-preview'),keys[2]);assert.equal(presentationSettingsKey('/build-ui-preview-other/'),keys[0]);
});


test('sample audio review preserves production and other preview settings',()=>{
 const routes=['/next/','/save-preview/','/build-ui-preview/','/audio-asset-preview/'];const keys=routes.map(presentationSettingsKey);
 assert.equal(new Set(keys).size,4);assert.equal(presentationSettingsKey('/audio-asset-preview'),keys[3]);assert.equal(presentationSettingsKey('/audio-asset-preview-other/'),keys[0]);
});

test('legacy speed migrates by intent and invalid new preference safely falls back',async()=>{
 const {resolveBattlePace}=await import('../src/next/ui/animationTimeline.ts');
 for(const shortAnimations of [false,true])for(const lowMotion of [false,true]){
  const old=parsePresentationSettings(JSON.stringify({...defaults,shortAnimations,lowMotion}));
  assert.equal(resolveBattlePace({speed:old.speed,short:old.shortAnimations}),shortAnimations?'fast':'medium');
 }
 const bad=parsePresentationSettings(JSON.stringify({...defaults,speed:'turbo'}));assert.equal(bad.speed,undefined);
 const slow=parsePresentationSettings(JSON.stringify({...defaults,speed:'slow',shortAnimations:true}));assert.equal(slow.speed,'slow');assert.equal(slow.shortAnimations,false);
});
