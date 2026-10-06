import {trophySkillIds} from '../src/next/core/skillCatalog.ts';
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {createProfile,characterGrowth,legacyLevelInfo,migrateProfile,gainCharacterXp,useXpEnergy,validateProfile,ProfileStore,freezeRunMeta,settleProfile,changeTreeRank} from '../src/next/meta/profile.ts';
import type {Profile} from '../src/next/meta/profile.ts';import {rosterIds,roster} from '../src/next/meta/roster.ts';import {createProfileImportReader} from '../src/next/meta/profileImport.ts';import {prepareDeparture} from '../src/next/meta/departure.ts';import {BattleController} from '../src/next/app/BattleController.ts';import {encodeSave,decodeSave,LATE_SAVE_RULES} from '../src/next/app/saveCheckpoint.ts';import type {RunCheckpoint} from '../src/next/app/saveCheckpoint.ts';
const fixtures=JSON.parse(readFileSync(new URL('./fixtures/talent-legacy-site90.json',import.meta.url),'utf8')).cases as Array<{name:string;profile:Profile;checkpoint?:RunCheckpoint;terminalCheckpoint?:RunCheckpoint}>;
const view={render(){},async animate(){}};
function oldProfile(){const p=createProfile(1);delete p.growthVersion;for(const c of Object.values(p.characters))delete c.treeCostVersion;return p;}
class Storage{data=new Map<string,string>();writes=0;failAt=0;mode='';getItem(k:string){return this.data.get(k)??null;}setItem(k:string,v:string){this.writes++;const hit=this.writes===this.failAt;if(hit&&this.mode==='before')throw Error('before');if(hit&&this.mode==='drop')return;this.data.set(k,v);if(hit&&this.mode==='after')throw Error('after');}}
test('all25 real Site90 fixtures reset only allocations once and retain earned XP, currency, inventories and run records',()=>{
 assert.equal(fixtures.length,25);
 for(const f of fixtures){const raw=JSON.stringify(f.profile),n=migrateProfile(f.profile);assert.equal(n.schema,2);assert.equal(n.growthVersion,3);assert.equal(n.pendingDraw,false);
  for(const key of ['coins','energy','ownedCharacters','trophies','receipts','launches','rng','drawCount'] as const)assert.deepEqual(n[key],f.profile[key]);
  assert.deepEqual(n.ownedSkills.filter(id=>!trophySkillIds.includes(id as never)),f.profile.ownedSkills);
  for(const id of rosterIds){const old=legacyLevelInfo(f.profile.characters[id].xp),g=characterGrowth(n.characters[id]);assert(g.level>=old.level);assert(g.points>=old.points);assert.equal(g.storedXp,f.profile.characters[id].xp);assert.equal(g.spent,0);assert.equal(g.allocatable,g.points);assert.equal(n.characters[id].board,roster[id].board);assert.deepEqual(n.characters[id].pool,f.profile.characters[id].pool);}
  assert.equal(JSON.stringify(f.profile),raw);assert.equal(migrateProfile(n),n);validateProfile(n);
 }
});
test('schema2 used points are fully returned once; current allocations survive reread and same old backup import',async()=>{
 const p=oldProfile();p.characters.blue.xp=1540;p.characters.blue.tree={three:5,four:5,five:5,rewardHeal:0,slots:2,board:1};p.characters.blue.board='blue-plumb';
 const storage=new Storage(),store=new ProfileStore(storage,()=>true),raw=JSON.stringify(p);storage.data.set(store.key,raw);
 const n=store.read();assert.equal(storage.getItem(store.key+'.before-growth-v3'),raw);assert.equal(characterGrowth(n.characters.blue).allocatable,24);
 store.update(p=>{changeTreeRank(p.characters.blue,'rewardHeal',1);p.treeTutorial={step:7,completed:false};return p;});
 const after=storage.getItem(store.key);assert.equal(new ProfileStore(storage,()=>true).read().characters.blue.tree.rewardHeal,1);assert.equal(storage.getItem(store.key),after);
 assert.equal(await store.importBackup(p),false);assert.equal(storage.getItem(store.key),after);assert.equal(store.current.treeTutorial!.step,7);
});
test('imported legacy backups persist their migration fingerprint and preserve completed guide on repeated import',async()=>{
 const storage=new Storage(),store=new ProfileStore(storage,()=>true);store.read();store.update(p=>{p.treeTutorial={step:21,completed:true};return p;});const old=oldProfile();old.characters.blue.xp=1540;old.characters.blue.tree.three=5;
 assert.equal(await store.importBackup(old),true);assert.equal(store.current.characters.blue.tree.three,0);assert(store.current.treeTutorial!.completed);
 store.update(p=>{changeTreeRank(p.characters.blue,'three',1);return p;});const resumed=new ProfileStore(storage,()=>true);resumed.read();assert.equal(await resumed.importBackup(old),false);assert.equal(resumed.current.characters.blue.tree.three,1);assert.equal(characterGrowth(resumed.current.characters.blue).points,24);
});
test('cap-crossing energy retains all XP and stops at50; old level30 may grow again',()=>{
 const p=createProfile();p.energy=2;p.characters.blue.xp=25460;const n=useXpEnergy(p,'blue');assert.equal(n.characters.blue.xp,25510);assert.equal(n.energy,1);assert.equal(characterGrowth(n.characters.blue).level,50);assert.throws(()=>useXpEnergy(n,'blue'));assert.equal(p.energy,2);
 const old=oldProfile();old.characters.blue.xp=9280;old.energy=2;assert.equal(characterGrowth(useXpEnergy(old,'blue').characters.blue).level,30);assert.throws(()=>gainCharacterXp({...p.characters.blue,xp:Number.MAX_SAFE_INTEGER},1));
});
test('all backup and main-write before/after/drop failures preserve usable bytes and retry migration once',()=>{
 for(const failAt of [1,2,3,4,5])for(const mode of ['before','after','drop']){const s=new Storage(),store=new ProfileStore(s,()=>true),old=fixtures.find(f=>f.name==='legacy-xp-9280')!.profile,raw=JSON.stringify(old);s.data.set(store.key,raw);s.failAt=failAt;s.mode=mode;assert.throws(()=>store.read());const durable=s.getItem(store.key)!;assert(durable===raw||JSON.parse(durable).growthVersion===3);s.failAt=0;const retry=new ProfileStore(s,()=>true),n=retry.read();assert.equal(s.getItem(store.key+'.before-growth-v3'),raw);assert.equal(characterGrowth(n.characters.blue).points,60);assert.equal(characterGrowth(n.characters.blue).allocatable,60);const saved=s.getItem(store.key),writes=s.writes;retry.read();assert.equal(s.writes,writes);assert.equal(s.getItem(store.key),saved);}
});
test('old active snapshots and equipment stay byte-exact after home reset and terminal settlement is once only',()=>{
 const f=fixtures.find(x=>x.name==='legacy-active-before-cap')!,cp=f.terminalCheckpoint!,oldRaw=JSON.stringify(cp),p=migrateProfile(f.profile),settled=settleProfile(p,cp,33),g=characterGrowth(settled.characters.blue);assert.equal(g.storedXp,2289);assert.equal(g.level,14);assert.equal(g.points,28);assert.equal(settled.coins,4771);assert.equal(settleProfile(settled,cp,99),settled);assert.equal(JSON.stringify(cp),oldRaw);
 if(f.checkpoint){const encoded=encodeSave(f.checkpoint,1,1),restored=BattleController.restore(decodeSave(encoded).checkpoint,view);assert.equal(encodeSave(restored.exportCheckpoint(),1,1),encoded);assert.deepEqual(restored.snapshot.config.meta,f.checkpoint.initialConfig.meta);}
 const setup=prepareDeparture(freezeRunMeta(settled,'blue',true),77),c=new BattleController(setup.config,view,setup.options),next=structuredClone(c.exportCheckpoint());settled.launches[next.runId]={character:'blue',snapshot:JSON.stringify(next.initialConfig.meta)};Object.assign(next,{run:{...next.run!,stage:50,defeatedCount:50,status:'cleared'},state:{...next.state,hp:{...next.state.hp,player:{...next.state.hp.player,current:10},enemy:{...next.state.hp.enemy,current:0}},result:{winner:'player',reason:'hp-zero'}}});const current=settleProfile(settled,next,100);assert.equal(current.characters.blue.xp,3039);assert.equal(characterGrowth(current.characters.blue).level,16);assert.equal(decodeSave(encodeSave(next,1)).rules,LATE_SAVE_RULES);
});
test('legacy/new backup validation retains version gates and rejects malformed floors or future growth versions',async()=>{
 let candidate:Profile|null=null;const reader=createProfileImportReader(x=>{candidate=x.profile;});for(const p of [fixtures[0]!.profile,migrateProfile(fixtures[0]!.profile)]){await reader.select({size:100,text:async()=>JSON.stringify({format:'game1-profile-backup',version:p.schema,profile:p})});assert.deepEqual(candidate,p);}
 const storage=new Storage(),store=new ProfileStore(storage,()=>true);store.read();const raw=storage.getItem(store.key);for(const edit of [(p:Profile)=>p.characters.blue.legacyLevelFloor=30,(p:Profile)=>{p.characters.blue.legacyLevelFloor=1;p.characters.blue.legacyPointFloor=60;},(p:Profile)=>{p.characters.blue.legacyLevelFloor=31;p.characters.blue.legacyPointFloor=62;},(p:Profile)=>{(p as any).growthVersion=4;}]){const p=store.current;edit(p);assert.throws(()=>store.write(p));assert.equal(storage.getItem(store.key),raw);await reader.select({size:100,text:async()=>JSON.stringify({format:'game1-profile-backup',version:2,profile:p})});assert.equal(candidate,null);}
});

test('legacy import backup and commit failures recover without a second reset or point credit',async()=>{
 for(const failAt of [1,2,3])for(const mode of ['before','after','drop']){
  const storage=new Storage(),store=new ProfileStore(storage,()=>true);store.read();storage.writes=0;storage.failAt=failAt;storage.mode=mode;
  const old=oldProfile();old.characters.blue.xp=1540;old.characters.blue.tree.three=5;
  await assert.rejects(()=>store.importBackup(old));storage.failAt=0;
  const resumed=new ProfileStore(storage,()=>true);resumed.read();await resumed.importBackup(old);
  assert.equal(characterGrowth(resumed.current.characters.blue).allocatable,24);
  resumed.update(p=>{changeTreeRank(p.characters.blue,'three',1);return p;});
  assert.equal(await resumed.importBackup(old),false);assert.equal(characterGrowth(resumed.current.characters.blue).allocatable,23);
 }
});
