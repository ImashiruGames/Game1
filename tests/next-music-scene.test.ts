import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MusicSceneController,HOME_MUSIC} from '../src/next/audio/musicScene.ts';
import {SPEED_MUSIC,MOTHER_MUSIC} from '../src/next/audio/bossMusic.ts';
import {NEON_AUDIO_ASSETS} from '../src/next/audio/neonAudioAssets.ts';
import {harness,deferred,tick} from './helpers/themedAudioHarness.ts';

const response=(url:string)=>({ok:true,arrayBuffer:async()=>new TextEncoder().encode(url).buffer});
test('boot/home ignores restored boss and background renders; OFF makes no requests',async()=>{
 const h=harness(),scene=new MusicSceneController(h.audio);
 assert.equal(scene.scene,'home');assert.equal(h.audio.musicAssetUrl,HOME_MUSIC.url);
 for(const enemy of ['speed-core','mother-core','marujiro'])await scene.updateBattle(enemy);
 assert.equal(h.audio.musicAssetUrl,HOME_MUSIC.url);assert.equal(h.creates,0);assert.deepEqual(h.fetched,[]);
 await h.audio.enableMusicGesture();assert.equal(h.active[0]!.buffer!.id,HOME_MUSIC.url);h.audio.destroy();
});
test('new/continued normal and boss battles, repeated renders, returns and fresh departure retain exactly one correct loop',async()=>{
 const h=harness(),scene=new MusicSceneController(h.audio);h.audio.setVolume('music',.31);await h.audio.enableEffectsGesture();await h.audio.enableMusicGesture();
 for(const [enemy,asset,kind] of [['marujiro',NEON_AUDIO_ASSETS.music,'battle'],['speed-core',SPEED_MUSIC,'boss'],['mother-core',MOTHER_MUSIC,'boss']] as const){
  await scene.enterBattle(enemy);assert.equal(scene.scene,kind);assert.equal(h.active.length,1);assert.equal(h.active[0]!.buffer!.id,asset.url);
  const source=h.active[0],fetches=h.fetched.length;for(let i=0;i<10;i++)await scene.updateBattle(enemy);assert.equal(h.active[0],source);assert.equal(h.fetched.length,fetches);
  // Same return path is used by retired, defeated and cleared result dialogs.
  await scene.showHome();assert.equal(scene.scene,'home');assert.equal(h.active.length,1);assert(source!.disconnected);assert.equal(h.active[0]!.buffer!.id,HOME_MUSIC.url);
  await scene.updateBattle(enemy);assert.equal(h.active[0]!.buffer!.id,HOME_MUSIC.url);assert.equal(h.audio.effectsStatus,'ready');assert.equal(h.audio.getVolume('music'),.31);
 }
 await scene.enterBattle('marujiro');await scene.updateBattle('speed-core');assert.equal(h.active[0]!.buffer!.id,SPEED_MUSIC.url);await scene.updateBattle('mother-core');assert.equal(h.active[0]!.buffer!.id,MOTHER_MUSIC.url);h.audio.destroy();
});
test('home cancels slow boss download and its fallback; later completion cannot resurrect battle music',async()=>{
 const held=deferred<ReturnType<typeof response>>(),h=harness(url=>url===MOTHER_MUSIC.url?held.promise:Promise.resolve(response(url))),scene=new MusicSceneController(h.audio);
 await h.audio.enableMusicGesture();const pending=scene.enterBattle('mother-core');await tick();await scene.showHome();held.reject(new Error('late codec failure'));await pending;
 assert.equal(h.active.length,1);assert.equal(h.active[0]!.buffer!.id,HOME_MUSIC.url);assert(!h.fetched.includes(MOTHER_MUSIC.fallbackUrl!));h.audio.destroy();
});
test('departure cancels pending home decode and home fallback',async()=>{
 const held=deferred<ReturnType<typeof response>>(),h=harness(url=>url===HOME_MUSIC.url?held.promise:Promise.resolve(response(url))),scene=new MusicSceneController(h.audio);
 const pending=h.audio.enableMusicGesture();await tick();await scene.enterBattle('speed-core');held.reject(new Error('late home failure'));assert.equal(await pending,false);
 assert.equal(h.active.length,1);assert.equal(h.active[0]!.buffer!.id,SPEED_MUSIC.url);assert(!h.fetched.includes(HOME_MUSIC.fallbackUrl!));h.audio.destroy();
});
test('hidden, OFF, reset and destroy revoke pending home decode without automatic resurrection',async()=>{
 for(const stop of ['hidden','off','reset','destroy'] as const){
  const h=harness(),scene=new MusicSceneController(h.audio),held=deferred<{id:string;sampleRate:number;duration:number}>();
  h.context.decodeAudioData=()=>held.promise;const pending=h.audio.enableMusicGesture();await tick();
  if(stop==='hidden')h.audio.setHidden(true);else if(stop==='off')h.audio.setMusicEnabled(false);else if(stop==='reset')h.audio.reset();else h.audio.destroy();
  held.resolve({id:HOME_MUSIC.url,sampleRate:44100,duration:48});assert.equal(await pending,false);assert.equal(h.active.length,0);
  if(stop==='hidden'){await scene.enterBattle('mother-core');await scene.showHome();h.audio.setHidden(false);assert.equal(h.audio.musicStatus,'resume');assert.equal(h.active.length,0);await h.audio.enableMusicGesture();assert.equal(h.active.length,1);assert.equal(h.active[0]!.buffer!.id,HOME_MUSIC.url);}
  h.audio.destroy();
 }
});
test('home FLAC decode failure uses PCM fallback and resampled whole-buffer boundary',async()=>{
 const h=harness();new MusicSceneController(h.audio);h.context.decodeAudioData=async data=>{const id=new TextDecoder().decode(data);if(id.endsWith('.flac'))throw Error('unsupported');return {id,sampleRate:44100,duration:48};};
 assert.equal(await h.audio.enableMusicGesture(),true);assert.equal(h.active.length,1);assert.equal(h.active[0]!.buffer!.id,HOME_MUSIC.fallbackUrl);assert.equal(h.active[0]!.loopStart,0);assert.equal(h.active[0]!.loopEnd,48);h.audio.destroy();
});
test('actual navigation uses explicit scenes and battle renders cannot select music directly',()=>{
 const main=readFileSync(new URL('../src/next/main.ts',import.meta.url),'utf8');
 assert.match(main,/function showHome\(\)[\s\S]*?musicScene\.showHome\(\);home\.show\(\)/);
 assert.match(main,/function render\([\s\S]*?musicScene\.updateBattle\(s\.config\.enemyId\)/);
 assert.doesNotMatch(main,/audio\.setMusicAsset|musicForEnemy/);
 assert.match(main,/continue\(\)\{saveDialog.close\(\);void musicScene.enterBattle\(controller.snapshot.config.enemyId\);void controller.start\(\)/);
 assert.match(main,/view.reset\?\.\(\);void musicScene.enterBattle\(controller.snapshot.config.enemyId\);await controller.start\(\{showInitialStage:true\}\)/);
});
