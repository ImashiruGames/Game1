import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {NEON_AUDIO_ASSETS} from '../src/next/audio/neonAudioAssets.ts';
import {sampleForBattleEvent} from '../src/next/audio/sampleAssets.ts';

test('published PCM assets match the reviewed immutable hashes and loop frame contract',()=>{
 const base=new URL('../public/assets/audio/neon-v1/',import.meta.url);
 const manifest=JSON.parse(readFileSync(new URL('manifest.json',base),'utf8'));
 for(const asset of [manifest.bgm,...manifest.effects]){
  const bytes=readFileSync(new URL(asset.filename,base));assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);
  assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WAVE');
 }
 assert.equal(manifest.bgm.frames,2094545);assert.equal(manifest.bgm.sampleRate,48000);assert.equal(manifest.bgm.processing.fade_out,false);
 assert.equal(NEON_AUDIO_ASSETS.music.loopEndSeconds,manifest.bgm.frames/manifest.bgm.sampleRate);
 assert.equal(manifest.aggregation_window_ms,80);assert.equal(manifest.max_effect_voices_including_fade,2);
});
test('Neon attack mapping is primary link only and does not double-count shape, healing or self damage',()=>{
 for(const [links,id] of [[3,'strike'],[4,'crush'],[5,'breaker'],[8,'breaker']] as const){
  for(const actor of ['player','enemy'])assert.equal(sampleForBattleEvent({type:'attack',actor,target:actor==='player'?'enemy':'player',linkCount:links,damage:5,hpBefore:20,hpAfter:15}),id);
 }
 for(const type of ['damage','heal','drop','gauge','transformation','row-cleared'])assert.equal(sampleForBattleEvent({type,actor:'player',target:'enemy',damage:20,linkCount:5}),null);
});
test('normal next entry imports only recorded-sample audio classes',()=>{
 const main=readFileSync(new URL('../src/next/main.ts',import.meta.url),'utf8');
 assert.match(main,/SampleAudioDirector/);assert.match(main,/SampleMusic/);
 assert.doesNotMatch(main,/from ['"]\.\/audio\/(?:AudioDirector|CoreMusic|audioControls)\.ts/);
});
