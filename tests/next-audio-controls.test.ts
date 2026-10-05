import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AudioDirector } from '../src/next/audio/AudioDirector.ts';
import { CoreMusic, mountMusicControls } from '../src/next/audio/CoreMusic.ts';
import { mountAudioControls } from '../src/next/audio/audioControls.ts';
import type { BattleEvent } from '../src/next/core/types.ts';
const attack:BattleEvent={type:'attack',actor:'player',target:'enemy',axis:'vertical',linkCount:3,tier:3,damage:8,hpBefore:50,hpAfter:42,overkill:0};
const tone={frequency:440,duration:.1,gain:.05};
function setup(){
 const voices:{disconnected:boolean}[]=[];let timers=0,starts=0;
 const param={setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}};
 const context={state:'running',currentTime:0,destination:{},onstatechange:null as null|(()=>void),
  createOscillator(){const node={disconnected:false,type:'sine',frequency:param,onended:null,start(){},stop(){},connect(){},disconnect(){this.disconnected=true;}};voices.push(node);return node;},
  createGain(){return {gain:param,connect(){},disconnect(){}};},
  async resume(){this.state='running';},async suspend(){this.state='suspended';},async close(){this.state='closed';}
 };
 const audio=new AudioDirector(()=>context as unknown as AudioContext);
 const music=new CoreMusic(audio,()=>{timers++;starts++;return()=>{timers--;};});
 return {audio,music,context,voices,get timers(){return timers;},get starts(){return starts;}};
}
class Button {
 id='';type='';textContent='';title='';attrs=new Map<string,string>();listeners=new Map<string,(()=>void)[]>();removed=false;
 setAttribute(k:string,v:string){this.attrs.set(k,v);}
 addEventListener(k:string,fn:()=>void){this.listeners.set(k,[...this.listeners.get(k)??[],fn]);}
 click(){for(const fn of this.listeners.get('click')??[])fn();}
 remove(){this.removed=true;}
}
function ui(s:ReturnType<typeof setup>){
 const old=globalThis.document;const events=new Map<string,()=>void>();const buttons:Button[]=[];
 const doc={hidden:false,createElement(){return new Button();},addEventListener(k:string,fn:()=>void){events.set(k,fn);},removeEventListener(k:string){events.delete(k);}};
 globalThis.document=doc as unknown as Document;
 const host={append(b:Button){buttons.push(b);}} as unknown as HTMLElement;
 const offEffects=mountAudioControls(s.audio,host),offMusic=mountMusicControls(s.music,s.audio,host);
 return {fx:buttons[0]!,bgm:buttons[1]!,hide(value:boolean){doc.hidden=value;events.get('visibilitychange')?.();},restore(){offEffects();offMusic();s.music.destroy();s.audio.destroy();globalThis.document=old;}};
}
const settle=async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();};
test('BGM alone unlocks context without enabling any direct or event effects',async()=>{
 const s=setup();await s.music.enableGesture();const before=s.voices.length;
 s.audio.playEvent(attack,{},0);s.audio.playTones([tone],'effect');assert.equal(s.voices.length,before);assert.equal(s.audio.effectsEnabled,false);assert.equal(s.timers,1);s.music.destroy();
});
test('effects alone do not enable BGM; toggling either leaves the other voices and timer intact',async()=>{
 const s=setup();await s.audio.enableEffectsGesture();assert.equal(s.timers,0);
 s.audio.playEvent(attack,{},0);const effect=s.voices[0]!;await s.music.enableGesture();const musicVoices=s.voices.slice(1);const starts=s.starts;
 s.audio.setEffectsEnabled(false);assert.equal(effect.disconnected,true);assert.ok(musicVoices.every(v=>!v.disconnected));assert.equal(s.timers,1);assert.equal(s.starts,starts);
 await s.audio.enableEffectsGesture();s.audio.playEvent(attack,{},1);const last=s.voices.at(-1)!;s.music.setEnabled(false);assert.ok(musicVoices.every(v=>v.disconnected));assert.equal(last.disconnected,false);assert.equal(s.audio.effectsEnabled,true);s.audio.destroy();
});
test('effects muted while BGM runs discard event identity and preserve saved group volumes',async()=>{
 const s=setup(),resolution={};s.audio.setVolume('effect',.35);s.audio.setVolume('music',.2);await s.music.enableGesture();s.audio.playEvent(attack,resolution,0);
 await s.audio.enableEffectsGesture();const before=s.voices.length;s.audio.playEvent(attack,resolution,0);assert.equal(s.voices.length,before);s.audio.playEvent(attack,resolution,1);assert.equal(s.voices.length,before+1);
 s.audio.reset();assert.equal(s.audio.getVolume('effect'),.35);assert.equal(s.audio.getVolume('music'),.2);s.music.destroy();s.audio.destroy();
});
test('late context resume cannot restore cancelled effects or cancelled BGM',async()=>{
 for(const group of ['effect','music']){const s=setup();let finish=()=>{};s.context.state='suspended';s.context.resume=()=>new Promise<void>(resolve=>{finish=()=>{s.context.state='running';resolve();};});
 const pending=group==='effect'?s.audio.enableEffectsGesture():s.music.enableGesture();if(group==='effect')s.audio.setEffectsEnabled(false);else s.music.setEnabled(false);finish();assert.equal(await pending,false);assert.equal(s.timers,0);assert.equal(s.audio.effectsEnabled,false);s.music.destroy();s.audio.destroy();}
});
test('visible controls start OFF, use independent pressed states, and stop only their own group',async()=>{
 const s=setup(),u=ui(s);try{
 assert.equal(u.fx.textContent,'効果音\nOFF');assert.equal(u.bgm.textContent,'BGM\nOFF');u.bgm.click();await settle();assert.equal(u.bgm.textContent,'BGM\nON');assert.equal(u.fx.attrs.get('aria-pressed'),'false');
 u.fx.click();await settle();assert.equal(u.fx.textContent,'効果音\nON');const starts=s.starts;u.fx.click();assert.equal(u.fx.textContent,'効果音\nOFF');assert.equal(u.bgm.textContent,'BGM\nON');assert.equal(s.starts,starts);assert.equal(s.timers,1);u.bgm.click();assert.equal(s.timers,0);
 }finally{u.restore();}
});
test('controls can cancel an in-flight gesture with a second tap, without late restart',async()=>{
 for(const group of ['fx','bgm'] as const){const s=setup();let finish=()=>{};s.context.state='suspended';s.context.resume=()=>new Promise<void>(resolve=>{finish=()=>{s.context.state='running';resolve();};});const u=ui(s);try{
 u[group].click();assert.match(u[group].textContent,/開始中/);u[group].click();assert.match(u[group].textContent,/OFF/);finish();await settle();assert.match(u[group].textContent,/OFF/);assert.equal(s.timers,0);assert.equal(s.audio.effectsEnabled,false);
 }finally{u.restore();}}
});
test('each interrupted control offers its own resume gesture',async()=>{
 const s=setup(),u=ui(s);try{u.bgm.click();u.fx.click();await settle();u.hide(true);u.hide(false);assert.equal(s.timers,0);assert.match(u.bgm.textContent,/再開/);assert.match(u.fx.textContent,/再開/);
 u.bgm.click();await settle();assert.match(u.bgm.textContent,/ON/);assert.match(u.fx.textContent,/ON/);assert.equal(s.timers,1);assert.equal(s.audio.effectsEnabled,true);
 }finally{u.restore();}
});
test('failed gesture is retryable on that control and never changes the other preference',async()=>{
 const s=setup();s.context.state='suspended';s.context.resume=async()=>{throw Error('denied');};const u=ui(s);try{u.bgm.click();await settle();assert.match(u.bgm.textContent,/再試行/);assert.match(u.fx.textContent,/OFF/);
 s.context.resume=async()=>{s.context.state='running';};u.bgm.click();await settle();assert.match(u.bgm.textContent,/ON/);assert.equal(s.audio.effectsEnabled,false);
 }finally{u.restore();}
});
test('both persistent audio hosts are outside details; unchanged row height has 44px minimum control widths',()=>{
 const main=readFileSync(new URL('../src/next/main.ts',import.meta.url),'utf8'),css=readFileSync(new URL('../src/next/style.css',import.meta.url),'utf8');
 assert.equal(main.match(/id="music-controls"/g)?.length,1);assert.equal(main.match(/id="audio-controls"/g)?.length,1);
 const strip=main.slice(main.indexOf('<div class="action-strip">'),main.indexOf('<p class="meta">'));assert.ok(strip.includes('id="music-controls"'));assert.ok(strip.includes('id="audio-controls"'));assert.ok(!main.includes('音楽をまとめて止めます'));
 assert.match(css,/grid-template-columns:minmax\(0,1fr\)56px 56px/);assert.match(css,/grid-template-columns:minmax\(0,1fr\)44px 44px/);assert.match(css,/grid-template-rows:22px 44px/);assert.match(css,/#music-controls button\{padding:2px!important\}/);assert.ok(44-2*2-2>=3*12);
 // Width contract only, not rendered layout or Safari evidence: game padding16, audio gaps8, inner action gaps12/15.
 for(const [width,audioWidth,actionGaps] of [[320,44,12],[390,56,15]])assert.ok((width!-16-audioWidth!*2-8-actionGaps!)/4>=44);
});

test('an older rejected resume cannot silence a newer successful group unlock',async()=>{
 const s=setup();const attempts:{resolve:()=>void;reject:()=>void}[]=[];s.context.state='suspended';s.context.resume=()=>new Promise<void>((resolve,reject)=>{attempts.push({resolve:()=>{s.context.state='running';resolve();},reject:()=>reject(Error('stale rejection'))});});
 const bgm=s.music.enableGesture(),fx=s.audio.enableEffectsGesture();attempts[1]!.resolve();assert.equal(await fx,true);assert.equal(s.audio.status,'ready');assert.equal(s.timers,1);const starts=s.starts;attempts[0]!.reject();assert.equal(await bgm,true);assert.equal(s.audio.status,'ready');assert.equal(s.timers,1);assert.equal(s.starts,starts);s.music.destroy();s.audio.destroy();
});
test('a replaced closed context ignores old resume failure and old state events',async()=>{
 const s=setup();let rejectOld=()=>{};s.context.state='suspended';s.context.resume=()=>new Promise<void>((_,reject)=>{rejectOld=()=>reject(Error('old context'));});
 const replacement={...s.context,state:'running'};let creates=0;const audio=new AudioDirector(()=>(creates++===0?s.context:replacement) as unknown as AudioContext);
 const old=audio.enableGesture();const oldListener=s.context.onstatechange;s.context.state='closed';assert.equal(await audio.enableEffectsGesture(),true);rejectOld();assert.equal(await old,true);oldListener?.();assert.equal(audio.status,'ready');assert.equal(audio.effectsEnabled,true);audio.destroy();s.music.destroy();
});
