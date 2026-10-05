import test from 'node:test';
import assert from 'node:assert/strict';
import { CoreMusic, musicTonesForStep, midiFrequency, CORE_MUSIC_STEP_SECONDS, CORE_MUSIC_CYCLE_STEPS } from '../src/next/audio/CoreMusic.ts';
import type { MusicAudio } from '../src/next/audio/CoreMusic.ts';
import type { Tone } from '../src/next/audio/audioEventMap.ts';
function setup(){
 const calls:readonly Tone[][]=[];const played=calls as Tone[][];const listeners=new Set<()=>void>();let tick=()=>{};let timerCount=0;let stops=0;
 const audio:MusicAudio={status:'ready',currentTime:0,async enableGesture(){return true;},playTones(tones,group){assert.equal(group,'music');played.push([...tones]);},stop(group){assert.equal(group,'music');stops++;},subscribe(listener){listeners.add(listener);return()=>{listeners.delete(listener);};}};
 const music=new CoreMusic(audio,callback=>{tick=callback;timerCount++;return()=>{timerCount--;};});
 return {audio,music,played,tick:()=>tick(),notify:()=>listeners.forEach(fn=>fn()),get timers(){return timerCount;},get stops(){return stops;}};
}
test('original motif is deterministic and bounded, with quiet gain',()=>{
 assert.equal(midiFrequency(69),440);assert.ok(CORE_MUSIC_STEP_SECONDS>.3);
 for(let i=0;i<192;i++){const notes=musicTonesForStep(i);assert.deepEqual(notes,musicTonesForStep(i%CORE_MUSIC_CYCLE_STEPS));for(const n of notes){assert.ok(n.gain<=.02);assert.ok(n.duration<=.8);assert.ok(n.frequency>50);}}
});
test('music defaults off, explicit gesture starts exactly one timer',async()=>{
 const s=setup();assert.equal(s.timers,0);assert.equal(s.played.length,0);
 await s.music.enableGesture();assert.equal(s.timers,1);assert.equal(s.played.length,1);s.notify();s.notify();assert.equal(s.timers,1);
 s.music.setEnabled(false);assert.equal(s.timers,0);assert.equal(s.music.enabled,false);
});
test('audio interruption or mute stops music; resume starts present phrase only',async()=>{
 const s=setup();await s.music.enableGesture();(s.audio as {status:string}).status='resume';s.notify();assert.equal(s.timers,0);
 (s.audio as {currentTime:number}).currentTime=100;(s.audio as {status:string}).status='ready';s.notify();assert.equal(s.timers,1);assert.equal(s.played.length,2);assert.ok(s.played[1]!.every(t=>t.delay!<.1));
});
test('large timer delay drops missed notes instead of burst catchup',async()=>{
 const s=setup();await s.music.enableGesture();(s.audio as {currentTime:number}).currentTime=1000;s.tick();assert.equal(s.played.length,2);
});
test('restart preserves preference with one timer, destroy cancels all scheduling',async()=>{
 const s=setup();await s.music.enableGesture();s.music.restart();assert.equal(s.timers,1);assert.ok(s.music.enabled);s.music.destroy();assert.equal(s.timers,0);s.notify();assert.equal(s.timers,0);
});

test('three phrases differ, feature syncopation and retain silent steps',()=>{
 const parts=[0,32,64].map(offset=>Array.from({length:32},(_,i)=>musicTonesForStep(i+offset)));
 assert.notDeepEqual(parts[0],parts[1]);assert.notDeepEqual(parts[1],parts[2]);
 for(const part of parts){assert.ok(part.some(notes=>notes.length===0));assert.ok(part.some(notes=>notes.some(n=>(n.delay??0)>0)));assert.ok(part.some(notes=>notes.some(n=>n.filter&&n.wave==='sawtooth')));}
 for(let i=0;i<96;i++){const tones=musicTonesForStep(i);assert.ok(tones.length<=3);assert.ok(tones.reduce((n,t)=>n+t.gain,0)<=.035);for(const t of tones)assert.ok(t.frequency<1000);}
});
test('sequencer preserves intentional within-step swing',async()=>{
 const s=setup();await s.music.enableGesture();(s.audio as {currentTime:number}).currentTime=CORE_MUSIC_STEP_SECONDS*5;s.tick();
 // A continuous clock must retain odd-step delay (the mock above jumped and may restart).
 s.music.restart();const base=s.audio.currentTime;
 for(let i=1;i<=8;i++){(s.audio as {currentTime:number}).currentTime=base+i*CORE_MUSIC_STEP_SECONDS;s.tick();}
 assert.ok(s.played.some(tones=>tones.some(t=>(t.delay??0)>.055)));
});
