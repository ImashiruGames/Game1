import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioDirector } from '../src/next/audio/AudioDirector.ts';
import { tonesForBattleEvent } from '../src/next/audio/audioEventMap.ts';
import type { BattleEvent } from '../src/next/core/types.ts';

const attack:BattleEvent={type:'attack',actor:'player',target:'enemy',axis:'vertical',linkCount:3,tier:3,damage:8,hpBefore:50,hpAfter:42,overkill:0};
const heal:BattleEvent={type:'heal',actor:'player',target:'player',source:'health',amount:0,requestedAmount:15,hpBefore:100,hpAfter:100};
function mockAudio(){
 const oscillators:{stops:number;starts:number;disconnected:boolean}[]=[];
 const param={setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}};
 const context={state:'running',currentTime:1,destination:{},onstatechange:null as null|(()=>void),
  createOscillator(){const node={stops:0,starts:0,disconnected:false,type:'sine',frequency:param,onended:null,start(){this.starts++;},stop(){this.stops++;},connect(){},disconnect(){this.disconnected=true;}};oscillators.push(node);return node;},
  createGain(){return {gain:param,connect(){},disconnect(){}};},
  async resume(){this.state='running';},async suspend(){this.state='suspended';},async close(){this.state='closed';}
 };
 const audio=new AudioDirector(()=>context as unknown as AudioContext);return {audio,context,oscillators};
}
test('event recipes distinguish health activation from actual healing and reflection',()=>{
 assert.equal(tonesForBattleEvent(heal).length,1);
 assert.equal(tonesForBattleEvent({...heal,amount:15,hpBefore:85}).length,3);
 const reflection:BattleEvent={type:'damage',actor:'player',target:'enemy',source:'blue-transformation',damage:15,hpBefore:30,hpAfter:15,shapeBoxIds:['same-shape']};
 assert.equal(tonesForBattleEvent(reflection).length,1);
 assert.notDeepEqual(tonesForBattleEvent(reflection),tonesForBattleEvent(heal));
});
test('each attack axis has an independent tone; zero damage remains silent',()=>{
 const tones=['vertical','horizontal','diagonal-down','diagonal-up'].map(axis=>tonesForBattleEvent({...attack,axis} as BattleEvent)[0]!.frequency);
 assert.equal(new Set(tones).size,4);assert.deepEqual(tonesForBattleEvent({...attack,damage:0}),[]);
});
test('self cost has a lower descending tone',()=>{
 const cost:BattleEvent={type:'damage',actor:'player',target:'player',source:'ember',damage:5,hpBefore:100,hpAfter:95};
 const tone=tonesForBattleEvent(cost)[0]!;assert.ok(tone.endFrequency!<tone.frequency);
});
test('off by default; muted events never replay after unlock',async()=>{
 const {audio,oscillators}=mockAudio(),resolution={};
 audio.playEvent(attack,resolution,0);assert.equal(audio.status,'off');assert.equal(oscillators.length,0);
 await audio.enableEffectsGesture();audio.playEvent(attack,resolution,0);assert.equal(oscillators.length,0);
 audio.playEvent(attack,resolution,1);assert.equal(oscillators.length,1);
});
test('event dedupe uses resolution identity and event index; reset starts new epoch',async()=>{
 const {audio,oscillators}=mockAudio(),resolution={};await audio.enableEffectsGesture();
 audio.playEvent(attack,resolution,0);audio.playEvent(attack,resolution,0);assert.equal(oscillators.length,1);
 audio.playEvent(attack,{},0);assert.equal(oscillators.length,2);audio.reset();audio.playEvent(attack,resolution,0);assert.equal(oscillators.length,3);
});
test('abort, mute, reset stop sources and no aborted events play',async()=>{
 const {audio,oscillators}=mockAudio(),abort=new AbortController();await audio.enableEffectsGesture();audio.playEvent(attack,{},0,abort.signal);
 abort.abort();assert.equal(oscillators[0]!.disconnected,true);audio.playEvent(attack,{},1,abort.signal);assert.equal(oscillators.length,1);
 audio.playEvent(attack,{},0);audio.mute();assert.equal(oscillators[1]!.disconnected,true);assert.equal(audio.status,'off');
});
test('hidden suspends and stops; explicit gesture resumes',async()=>{
 const {audio,oscillators}=mockAudio();await audio.enableEffectsGesture();audio.playEvent(attack,{},0);audio.setHidden(true);
 assert.equal(oscillators[0]!.disconnected,true);assert.equal(audio.status,'resume');audio.setHidden(false);assert.equal(audio.status,'resume');
 await audio.enableEffectsGesture();assert.equal(audio.status,'ready');
});
test('unsupported WebAudio and rejected resume are absorbed',async()=>{
 const unsupported=new AudioDirector(()=>{throw Error('unavailable');});assert.equal(await unsupported.enableGesture(),false);assert.equal(unsupported.status,'unavailable');
 const {audio,context}=mockAudio();context.state='suspended';context.resume=async()=>{throw Error('blocked');};assert.equal(await audio.enableEffectsGesture(),false);
 assert.doesNotThrow(()=>audio.playEvent(attack,{},0));
});
test('in-flight resume cannot override later mute intent',async()=>{
 const {audio,context}=mockAudio();let finish=()=>{};context.state='suspended';context.resume=()=>new Promise<void>(resolve=>{finish=()=>{context.state='running';resolve();};});
 const pending=audio.enableEffectsGesture();audio.mute();finish();assert.equal(await pending,false);assert.equal(audio.status,'off');
});
test('voice cap releases oldest voices during short presentation',async()=>{
 const {audio,oscillators}=mockAudio();await audio.enableEffectsGesture();for(let i=0;i<20;i++)audio.playEvent(attack,{},i);
 assert.equal(oscillators.filter(o=>!o.disconnected).length,12);audio.destroy();assert.equal(oscillators.filter(o=>!o.disconnected).length,0);
});
