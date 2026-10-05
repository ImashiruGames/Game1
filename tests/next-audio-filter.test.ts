import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioDirector } from '../src/next/audio/AudioDirector.ts';
import { musicTonesForStep } from '../src/next/audio/CoreMusic.ts';
function setup(broken=false){
 const filters:{disconnected:boolean;values:number[];ramps:number[];frequency:object;Q:object;type:string;connect:()=>void;disconnect:()=>void}[]=[];
 const oscillators:{type:string;started:number;stopped:number;disconnected:boolean}[]=[];
 const param={setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}};
 const context={state:'running',currentTime:0,destination:{},onstatechange:null,
  createOscillator(){const node={type:'sine',started:0,stopped:0,disconnected:false,frequency:param,onended:null,connect(){},disconnect(){this.disconnected=true;},start(){this.started++;},stop(){this.stopped++;}};oscillators.push(node);return node;},
  createGain(){return {gain:param,connect(){},disconnect(){}};},
  createBiquadFilter(){if(broken)throw Error('optional filter unsupported');const values:number[]=[],ramps:number[]=[];const node={disconnected:false,values,ramps,frequency:{setValueAtTime(value:number){values.push(value);},exponentialRampToValueAtTime(value:number){ramps.push(value);}},Q:param,type:'',connect(){},disconnect(){this.disconnected=true;}};filters.push(node);return node;},
  async resume(){},async close(){}
 };
 const audio=new AudioDirector(()=>context as unknown as AudioContext);return {audio,filters,oscillators};
}
test('low-pass bass uses composed filter sweep and disconnects on abort',async()=>{
 const {audio,filters,oscillators}=setup();await audio.enableGesture();const abort=new AbortController();
 const bass=musicTonesForStep(0).find(t=>t.filter)!;audio.playTones([bass],'music',abort.signal);
 assert.equal(filters.length,1);assert.equal(filters[0]!.type,'lowpass');assert.deepEqual(filters[0]!.values,[480]);assert.deepEqual(filters[0]!.ramps,[150]);assert.equal(oscillators[0]!.started,1);
 abort.abort();assert.equal(filters[0]!.disconnected,true);assert.equal(oscillators[0]!.disconnected,true);
});
test('optional filter failure falls back to a quiet sine and preserves playback',async()=>{
 const {audio,oscillators}=setup(true);await audio.enableGesture();audio.playTones(musicTonesForStep(0),'music');
 assert.equal(oscillators.length,3);assert.ok(oscillators.every(o=>o.started===1));assert.ok(oscillators.every(o=>o.type==='sine'));audio.destroy();
});
test('music composition never calls global or game randomness',()=>{
 const random=Math.random;Math.random=()=>{throw Error('must not use game/global RNG');};
 try{for(let i=0;i<192;i++)assert.doesNotThrow(()=>musicTonesForStep(i));}finally{Math.random=random;}
});
