import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {stripTypeScriptTypes} from 'node:module';
import {roster,rosterIds,type RosterId} from '../src/next/meta/roster.ts';
import { playerPortraits as nextPlayers, transformedPortraits as nextForms, rosterArt } from '../src/next/portraits.ts';
import { playerPortraits, transformedPortraits, resolvePlayerPortrait, monsterPortrait, enemyPortraits } from '../src/ui/portraits.ts';

/** 日本語: 外見データにゲームルールを持たせず、提供されたWebPの全寸法を維持する。
 * English: Portrait profiles are cosmetic only; supplied player WebPs keep their full dimensions. */
test('player portrait framing is character-specific and selection is cosmetic', () => {
  assert.equal(resolvePlayerPortrait('blue'), 'blue');
  assert.equal(resolvePlayerPortrait('red'), 'red');
  assert.equal(resolvePlayerPortrait('invalid'), 'blue');
  assert.notEqual(playerPortraits.blue.anchorX, playerPortraits.red.anchorX);
  assert.notEqual(playerPortraits.blue.height, playerPortraits.red.height);
  for (const portrait of Object.values(playerPortraits)) {
    assert.deepEqual(Object.keys(portrait).sort(), ['alt', 'anchorX', 'height', 'label', 'src', 'top']);
    const bytes = readFileSync(new URL(portrait.src));
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 16), 'WEBPVP8X');
    assert.equal(bytes.readUIntLE(24, 3) + 1, 876);
    assert.equal(bytes.readUIntLE(27, 3) + 1, 1280);
    assert(bytes[20]! & 0x10, 'alpha channel');
  }
  assert.ok(readFileSync(new URL(monsterPortrait.src)).length > 0);
});


test('all named enemies have readable source assets', () => {
  assert.deepEqual(Object.keys(enemyPortraits), ['marujiro', 'hikikizan', 'nigirin', 'merarun']);
  for (const enemy of Object.values(enemyPortraits)) {
    const bytes = readFileSync(new URL(enemy.src));
    assert.equal(bytes.toString('ascii', 1, 4), 'PNG');
    assert.ok(bytes.length > 0);
  }
  assert.equal(enemyPortraits.marujiro.label, 'マルジロ');
});

test('all four supplied portraits retain exact bytes and are shared by home, gacha, battle and lab', () => {
 const expected={"Aoi.webp":"4fa006550e19f85f5891a91490efd15e1a87bdb40d4fc21a2086c49155b2bfff","Aoi-transformed.webp":"4cf38cacb113a8c15532b66ce9b83e444cf6e25e60ba21434bee11df09c447b6","Akari.webp":"e5d5c53a718a9f26c650f5ba9a20518121a0d50bc40baa5d5419322293a2451c","Akari-transformed.webp":"88dadd2b30599e8d325f8aa901d07a81ac09e0bf407b849515435e3d41d704e6"};
 for (const [id,name] of [['blue','Aoi'],['red','Akari']] as const) {
  assert.equal(playerPortraits[id].label,id==='blue'?'アオイ':'アカリ');
  for(const transformed of [false,true]) {
   const portrait=(transformed?transformedPortraits:playerPortraits)[id];
   assert.deepEqual(portrait,(transformed?nextForms:nextPlayers)[id]);
   const file=`${name}${transformed?'-transformed':''}.webp` as keyof typeof expected;
   assert(portrait.src.endsWith(file));
   const bytes=readFileSync(new URL(portrait.src));
   assert.equal(createHash('sha256').update(bytes).digest('hex'),expected[file]);
   const previewFile=file.replace('.webp',`-${expected[file].slice(0,8)}.webp`);
   assert.deepEqual(readFileSync(new URL('../public/audio-asset-preview/assets/'+previewFile,import.meta.url)),bytes);
   assert.equal(bytes.toString('ascii',8,16),'WEBPVP8X');
   assert.equal(bytes.readUIntLE(24,3)+1,876); assert.equal(bytes.readUIntLE(27,3)+1,1280); assert(bytes[20]!&0x10);
  }
 }
 const manifest=JSON.parse(readFileSync(new URL('./fixtures/next-aoi-akari-source-manifest.json',import.meta.url),'utf8'));
 for(const bundle of manifest.previewBundles) {
  const bytes=readFileSync(new URL('../'+bundle.path,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),bundle.sha256,bundle.path);
  assert.doesNotMatch(bytes.toString('utf8'),/青の子|赤の子|ルビィ/);
  for(const asset of manifest.retiredAssets)assert(!bytes.toString('utf8').includes(asset.path.split('/').at(-1)),asset.path);
 }
 for(const asset of manifest.retiredAssets)assert.equal(existsSync(new URL('../'+asset.path,import.meta.url)),false,asset.path);
});

test('all eight characters use the exact supplied normal and transformed art through the real roster resolver', () => {
 const manifest=JSON.parse(readFileSync(new URL('./fixtures/next-all-portraits-source-manifest.json',import.meta.url),'utf8'));
 const source=readFileSync(new URL('../src/next/meta/home.ts',import.meta.url),'utf8');
 const resolver=source.match(/^export function rosterPortrait.*$/m)![0].replace('export ','');
 const portraitFor=new Function('roster','rosterArt','playerPortraits','transformedPortraits',stripTypeScriptTypes(resolver)+';return rosterPortrait;')(roster,rosterArt,nextPlayers,nextForms) as (id:RosterId,transformed:boolean)=>{src:string;alt:string;label:string};
 assert.equal(manifest.assets.length,16);
 const sources=new Set<string>();
 for(const id of rosterIds)for(const transformed of [false,true]) {
  const expected=manifest.assets.find((a:{id:string;transformed:boolean})=>a.id===id&&a.transformed===transformed);
  assert(expected,id);
  const portrait=portraitFor(id,transformed);
  assert.equal(portrait.label,roster[id].name);
  assert.equal(portrait.src,new URL('../'+expected.path,import.meta.url).href);
  sources.add(portrait.src);
  const bytes=readFileSync(new URL(portrait.src));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),expected.sha256);
  assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,16),'WEBPVP8X');
  assert.equal(bytes.readUIntLE(24,3)+1,expected.width);assert.equal(bytes.readUIntLE(27,3)+1,expected.height);assert(bytes[20]!&0x10);
  if(transformed&&(id==='rose'||id==='silver'))assert.deepEqual([expected.width,expected.height],[1280,853]);
 }
 assert.equal(sources.size,16);
 for(const asset of manifest.retiredAssets)assert.equal(existsSync(new URL('../'+asset.path,import.meta.url)),false,asset.path);
 assert.doesNotMatch(source,/assets\/roster\/|rosterThumbs/);
});

test('portrait display surfaces contain both tall art and wide weapons without cropping or stretching', () => {
 const css=(file:string)=>readFileSync(new URL('../src/next/'+file,import.meta.url),'utf8');
 const home=css('meta/home.css'),gacha=css('meta/gachaReveal.css'),viewer=css('ui/portraitViewer.css'),cinematic=css('ui/transformationCinematic.css');
 assert.match(home,/\.home-roster img\{[^}]*height:100%[^}]*padding-bottom:14px[^}]*object-fit:contain/);
 assert.match(home,/\.home-art-button \.home-character\{[^}]*object-fit:contain/);
 assert.match(gacha,/\.gacha-portrait img\{[^}]*object-fit:contain/);
 assert.match(viewer,/\.portrait-viewer-trigger img\{[^}]*object-fit:contain/);
 assert.match(viewer,/\.portrait-viewer-image\{[^}]*object-fit:contain/);
 assert.match(cinematic,/\.tc-before img,\.tc-silhouette img\{[^}]*object-fit:contain/);
 assert.match(cinematic,/\.tc-after-image\{[^}]*object-fit:contain/);
 assert.doesNotMatch([home,gacha,viewer,cinematic].join(''),/object-fit:(?:cover|fill)/);
});
