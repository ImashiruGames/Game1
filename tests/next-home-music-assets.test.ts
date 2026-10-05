import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {HOME_MUSIC} from '../src/next/audio/musicScene.ts';
const validation=JSON.parse(readFileSync(new URL('../docs/home-music-v1/checks/validation.json',import.meta.url),'utf8'));
const sha=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
test('native home exports retain hashes, exact stereo frames and complete 48-second loop',()=>{
 for(const url of [HOME_MUSIC.url,HOME_MUSIC.fallbackUrl!]){
  const bytes=readFileSync(new URL(`../public${url}`,import.meta.url)),contract=validation.files[`audio/${url.split('/').at(-1)}`];assert(contract);assert.equal(bytes.length,contract.bytes);assert.equal(sha(bytes),contract.sha256);
 }
 const flac=readFileSync(new URL(`../public${HOME_MUSIC.url}`,import.meta.url));assert.equal(flac.toString('ascii',0,4),'fLaC');assert.equal(flac[4]!&127,0);assert.equal(flac.readUIntBE(5,3),34);const stream=flac.readBigUInt64BE(18);
 assert.equal(Number(stream>>44n),48000);assert.equal(Number((stream>>41n)&7n)+1,2);assert.equal(Number((stream>>36n)&31n)+1,16);assert.equal(Number(stream&((1n<<36n)-1n)),2304000);
 const wav=readFileSync(new URL(`../public${HOME_MUSIC.fallbackUrl}`,import.meta.url));assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.toString('ascii',8,12),'WAVE');let frames=0;
 for(let offset=12;offset+8<=wav.length;){const chunk=wav.toString('ascii',offset,offset+4),length=wav.readUInt32LE(offset+4);assert(offset+8+length<=wav.length);if(chunk==='fmt '){assert.equal(wav.readUInt16LE(offset+8),1);assert.equal(wav.readUInt16LE(offset+10),2);assert.equal(wav.readUInt32LE(offset+12),48000);assert.equal(wav.readUInt16LE(offset+22),16);}if(chunk==='data')frames=length/4;offset+=8+length+length%2;}
 assert.equal(frames,2304000);assert.equal(HOME_MUSIC.loopStartSeconds,0);assert.equal(HOME_MUSIC.loopEndSeconds,48);assert.equal(HOME_MUSIC.loopWholeBuffer,true);
 assert.equal(validation.clippedSamples,0);assert.equal(validation.nonfiniteSamples,0);for(let channel=0;channel<2;channel++)assert(validation.loopBoundaryDelta[channel]<validation.ordinary99thPercentileAdjacentDelta[channel]);
});
test('home music retains native editable source and official renderer provenance',()=>{
 const project=readFileSync(new URL('../docs/home-music-v1/projects/home_starlight_terminal_v1.jummbox.json',import.meta.url));const provenance=JSON.parse(readFileSync(new URL('../docs/home-music-v1/checks/render-provenance.json',import.meta.url),'utf8'));
 assert.equal(sha(project),provenance.sourceSha256);assert.equal(provenance.nativeCompactRoundtripPassed,true);assert.equal(provenance.bars,16);assert.equal(provenance.bpm,80);assert.equal(provenance.renderer,'Unmodified official JummBox Synth');
});
