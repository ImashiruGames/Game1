import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {saveNamespace} from '../src/next/app/localSave.ts';

const root=fileURLToPath(new URL('../',import.meta.url));
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8');
const retirement=JSON.parse(read('tests/fixtures/root-retirement.json')) as {sourceCommit:string;replacementEntries:string[];deleted:{path:string;category:string;bytes:number}[]};
const require=createRequire(import.meta.url);
const {rewrite,postbuild}=require('../scripts/pages-postbuild.mjs') as {rewrite:(text:string,base?:string)=>string;postbuild:(directory:string,base?:string)=>number};

test('root retires only the approved UI and opens next without a game bootstrap',()=>{
 const entry=read('index.html');
 assert.match(entry,/http-equiv="refresh" content="0; url=\.\/next\/"/);
 assert.match(entry,/href="\.\/next\/"/);
 assert.doesNotMatch(entry,/<script|\/src\/main\.ts/);
 assert.deepEqual(retirement.replacementEntries,['index.html']);
 assert.equal(retirement.deleted.length,37);
 assert.deepEqual(['c','old','tests'].map(c=>retirement.deleted.filter(f=>f.category===c).length),[22,12,3]);
 assert.equal(retirement.deleted.reduce((sum,f)=>sum+f.bytes,0),3398880);
 for(const file of retirement.deleted)assert.equal(fs.existsSync(path.join(root,file.path)),false,file.path);
 for(const file of ['src/core/battle.ts','src/app/BattleController.ts','src/ui/portraits.ts','src/ui/battlePresentation.ts','src/ui/shapeDiagram.ts','src/lab/baseline-manifest.json','tests/fixtures/default-v1-parity.json'])assert(fs.existsSync(path.join(root,file)),file);
 assert.match(read('src/lab/main.ts'),/href="\.\.\/next\/"/);
});

test('Pages prefixes next, lab, QA and dynamically fetched media at a repository base',()=>{
 const input='<a href="/">home</a><a href="/next/">next</a><a href="/lab/">lab</a><script src="/audio-asset-preview/assets/current.js"></script>';
 assert.equal(rewrite(input,'/Game1/'),'<a href="/Game1/next/">home</a><a href="/Game1/next/">next</a><a href="/Game1/lab/">lab</a><script src="/Game1/audio-asset-preview/assets/current.js"></script>');
 for(const url of ['/assets/audio/home-v1/music.flac','/docs/audio/audio/theme.wav','/energy-qa/','/night-qa/','/save-preview/']){
  assert.equal(rewrite(JSON.stringify(url),'/Game1/'),JSON.stringify('/Game1'+url));
 }
 assert.equal(rewrite('href=\\"/\\"','/Game1/'),'href=\\"/Game1/next/\\"');
 assert.equal(rewrite('"./assets/local.js" "https://example.org/next/"','/Game1/'),'"./assets/local.js" "https://example.org/next/"');
});

test('Pages output keeps the next redirect, is repeatable and never manufactures a legacy entry',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'game1-root-retirement-'));
 try{
  fs.writeFileSync(path.join(dir,'index.html'),read('index.html'));
  fs.mkdirSync(path.join(dir,'assets'));
  fs.writeFileSync(path.join(dir,'assets','app.js'),'const urls=["/assets/audio/test.wav","/docs/audio/audio/test.wav"];');
  const rootBefore=fs.readFileSync(path.join(dir,'index.html'));
  assert.equal(postbuild(dir,'/Game1/'),1);
  assert.deepEqual(fs.readFileSync(path.join(dir,'index.html')),rootBefore);
  assert.equal(fs.existsSync(path.join(dir,'v1.0.html')),false);
  assert(fs.existsSync(path.join(dir,'.nojekyll')));
  assert.equal(postbuild(dir,'/Game1/'),0);
  assert.throws(()=>postbuild(dir,'bad'),/PAGES_BASE/);
  fs.writeFileSync(path.join(dir,'v1.0.html'),'old');
  assert.throws(()=>postbuild(dir,'/Game1/'),/fresh Vite build/);
 }finally{
  const actual=fs.realpathSync(dir),parent=fs.realpathSync(os.tmpdir());
  assert(actual.startsWith(parent+path.sep)&&path.basename(actual).startsWith('game1-root-retirement-'));
  fs.rmSync(actual,{recursive:true});
 }
});

test('current audio and night QA entries keep their shared bundles and isolated save namespaces',()=>{
 for(const entry of ['public/audio-asset-preview/index.html','public/night-qa/index.html']){
  const html=read(entry);
  const names=[...html.matchAll(/audioAssetPreview-[A-Za-z0-9_-]+\.(?:js|css)/g)].map(m=>m[0]);
  assert.equal(names.length,2,entry);
  for(const name of names){
   assert(html.includes(name),entry);
   assert(fs.existsSync(path.join(root,'public/audio-asset-preview/assets',name)),name);
  }
 }
 const routes=['save-preview','build-ui-preview','audio-asset-preview','night-qa','energy-qa'];
 const production=saveNamespace('/next/');
 assert.equal(production.key,'game1.next.autosave.v1');
 const keys=routes.map(route=>{const n=saveNamespace('/'+route+'/');assert(n.preview);assert.notEqual(n.key,production.key);return n.key;});
 assert.equal(new Set(keys).size,routes.length);
});
