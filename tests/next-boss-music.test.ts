import test from 'node:test';import assert from 'node:assert/strict';
import {musicForEnemy,SPEED_MUSIC,MOTHER_MUSIC} from '../src/next/audio/bossMusic.ts';
import {NEON_AUDIO_ASSETS} from '../src/next/audio/neonAudioAssets.ts';
import {harness,deferred,tick} from './helpers/themedAudioHarness.ts';
test('ordinary, midboss and final boss select distinct original recorded music',()=>{assert.equal(musicForEnemy('marujiro'),NEON_AUDIO_ASSETS.music);assert.equal(musicForEnemy(),NEON_AUDIO_ASSETS.music);assert.equal(musicForEnemy('speed-core'),SPEED_MUSIC);assert.equal(musicForEnemy('mother-core'),MOTHER_MUSIC);assert.equal(SPEED_MUSIC.loopEndSeconds,48);assert.equal(MOTHER_MUSIC.loopEndSeconds,2560000/48000);assert(SPEED_MUSIC.fallbackUrl?.endsWith('.wav'));});
test('music selection while OFF neither fetches nor creates context, then starts selected boss after gesture',async()=>{const h=harness();await h.audio.setMusicAsset(SPEED_MUSIC);assert.equal(h.fetched.length,0);assert.equal(h.creates,0);assert.equal(h.audio.musicStatus,'off');await h.audio.enableMusicGesture();assert.equal(h.audio.musicStatus,'ready');assert.equal(h.active.length,1);assert.equal(h.active[0]!.buffer!.id,SPEED_MUSIC.url);assert.equal(h.active[0]!.loopEnd,h.active[0]!.buffer!.duration);h.audio.destroy();});
test('enemy transitions replace a single loop without touching effects, repeats do not restart',async()=>{const h=harness();await h.audio.enableEffectsGesture();await h.audio.enableMusicGesture();const first=h.active[0]!;await h.audio.setMusicAsset(SPEED_MUSIC);assert(first.disconnected);assert.equal(h.active.length,1);assert.equal(h.audio.effectsStatus,'ready');const same=h.active[0]!;await h.audio.setMusicAsset(SPEED_MUSIC);assert.equal(h.active[0],same);await h.audio.setMusicAsset(MOTHER_MUSIC);assert(same.disconnected);assert.equal(h.active.length,1);await h.audio.setMusicAsset(NEON_AUDIO_ASSETS.music);assert.equal(h.active[0]!.buffer!.id,NEON_AUDIO_ASSETS.music.url);h.audio.destroy();});
test('stale boss download cannot start after a newer enemy or after music OFF',async()=>{const held=deferred<{ok:boolean;arrayBuffer():Promise<ArrayBuffer>}>();const h=harness(url=>url===SPEED_MUSIC.url?held.promise:Promise.resolve({ok:true,arrayBuffer:async()=>new TextEncoder().encode(url).buffer}));await h.audio.enableMusicGesture();const slow=h.audio.setMusicAsset(SPEED_MUSIC);await tick();await h.audio.setMusicAsset(MOTHER_MUSIC);held.resolve({ok:true,arrayBuffer:async()=>new TextEncoder().encode(SPEED_MUSIC.url).buffer});await slow;assert.equal(h.active.length,1);assert.equal(h.active[0]!.buffer!.id,MOTHER_MUSIC.url);h.audio.setMusicEnabled(false);await h.audio.setMusicAsset(SPEED_MUSIC);h.context.advance(1);assert.equal(h.active.length,0);h.audio.destroy();});
test('hidden-page boss selection stays silent and requires the existing explicit resume gesture',async()=>{const h=harness();await h.audio.enableMusicGesture();h.audio.setHidden(true);const count=h.fetched.length;await h.audio.setMusicAsset(SPEED_MUSIC);assert.equal(h.fetched.length,count);assert.equal(h.active.length,0);h.audio.setHidden(false);assert.notEqual(h.audio.musicStatus,'ready');await h.audio.enableMusicGesture();assert.equal(h.active[0]!.buffer!.id,SPEED_MUSIC.url);h.audio.destroy();});
test('unsupported FLAC falls back to exact PCM WAV and retains whole-buffer loop',async()=>{const h=harness(url=>url.endsWith('.flac')?Promise.reject(new Error('codec')):Promise.resolve({ok:true,arrayBuffer:async()=>new TextEncoder().encode(url).buffer}));await h.audio.setMusicAsset(SPEED_MUSIC);await h.audio.enableMusicGesture();assert.equal(h.audio.musicStatus,'ready');assert(h.fetched.includes(SPEED_MUSIC.fallbackUrl!));assert.equal(h.active[0]!.buffer!.id,SPEED_MUSIC.fallbackUrl);assert.equal(h.active[0]!.loopEnd,h.active[0]!.buffer!.duration);h.audio.destroy();});

test('a real decode rejection falls back to PCM, with device-resampled whole-buffer boundaries',async()=>{
 for(const asset of [SPEED_MUSIC,MOTHER_MUSIC]){
  const h=harness();h.context.decodeAudioData=async data=>{h.context.decodes++;const id=new TextDecoder().decode(data);if(id.endsWith('.flac'))throw new Error('unsupported codec');return {id,sampleRate:44100,duration:asset.loopEndSeconds};};
  await h.audio.setMusicAsset(asset);assert.equal(await h.audio.enableMusicGesture(),true);assert.equal(h.context.decodes,2);assert.equal(h.active.length,1);assert.equal(h.active[0]!.buffer!.id,asset.fallbackUrl);assert.equal(h.active[0]!.loopStart,0);assert.equal(h.active[0]!.loopEnd,asset.loopEndSeconds);h.audio.destroy();
 }
});
test('delayed boss decode cannot resurrect sound after OFF, hidden, reset or destroy',async()=>{
 for(const stop of ['off','hidden','reset','destroy'] as const){
  const h=harness(),held=deferred<{id:string;sampleRate:number;duration:number}>();h.context.decodeAudioData=()=>held.promise;await h.audio.setMusicAsset(MOTHER_MUSIC);const pending=h.audio.enableMusicGesture();await tick();
  if(stop==='off')h.audio.setMusicEnabled(false);else if(stop==='hidden')h.audio.setHidden(true);else if(stop==='reset')h.audio.reset();else h.audio.destroy();
  held.resolve({id:MOTHER_MUSIC.url,sampleRate:48000,duration:MOTHER_MUSIC.loopEndSeconds});assert.equal(await pending,false);assert.equal(h.active.length,0);if(stop==='hidden'){h.audio.setHidden(false);assert.equal(h.audio.musicStatus,'resume');assert.equal(h.active.length,0);}h.audio.destroy();
 }
});
test('both boss formats failing stays silent, retry is explicit, and effects remain independent',async()=>{
 let broken=true;const h=harness(url=>broken&&url.includes('boss-v1')?Promise.reject(new Error('missing')):Promise.resolve({ok:true,arrayBuffer:async()=>new TextEncoder().encode(url).buffer}));
 await h.audio.enableEffectsGesture();await h.audio.setMusicAsset(SPEED_MUSIC);assert.equal(await h.audio.enableMusicGesture(),false);assert.equal(h.audio.musicStatus,'unavailable');assert.equal(h.audio.effectsStatus,'ready');assert.equal(h.active.length,0);
 broken=false;assert.equal(await h.audio.enableMusicGesture(),true);assert.equal(h.active.length,1);assert.equal(h.active[0]!.buffer!.id,SPEED_MUSIC.url);h.audio.destroy();
});
test('repeated boss render selection neither reloads nor restarts a decoded loop',async()=>{
 const h=harness();await h.audio.setMusicAsset(MOTHER_MUSIC);await h.audio.enableMusicGesture();const source=h.active[0],fetches=h.fetched.length,decodes=h.context.decodes;
 for(let i=0;i<100;i++)await h.audio.setMusicAsset(MOTHER_MUSIC);
 assert.equal(h.active[0],source);assert.equal(h.active.length,1);assert.equal(h.fetched.length,fetches);assert.equal(h.context.decodes,decodes);h.audio.destroy();
});

test('revoked boss load does not start a new large WAV fallback after OFF or a track change',async()=>{
 for(const cancellation of ['off','hidden','new-track','destroy'] as const){
  const held=deferred<{ok:boolean;arrayBuffer():Promise<ArrayBuffer>}>(),h=harness(url=>url===SPEED_MUSIC.url?held.promise:Promise.resolve({ok:true,arrayBuffer:async()=>new TextEncoder().encode(url).buffer}));
  await h.audio.setMusicAsset(SPEED_MUSIC);const pending=h.audio.enableMusicGesture();await tick();
  if(cancellation==='off')h.audio.setMusicEnabled(false);else if(cancellation==='hidden')h.audio.setHidden(true);else if(cancellation==='new-track')await h.audio.setMusicAsset(MOTHER_MUSIC);else h.audio.destroy();
  held.reject(new Error('late FLAC failure'));assert.equal(await pending,false);assert(!h.fetched.includes(SPEED_MUSIC.fallbackUrl!));assert.equal(h.active.length,cancellation==='new-track'?1:0);h.audio.destroy();
 }
});
