import test from 'node:test';
import assert from 'node:assert/strict';
import {createProfile,drawGacha,drawGachaBatch,META,migrateProfile,ProfileStore,validateProfile} from '../src/next/meta/profile.ts';
import type {DrawResult,Profile} from '../src/next/meta/profile.ts';
import {rosterIds} from '../src/next/meta/roster.ts';

const discoverable=rosterIds.filter(id=>id!=='blue'&&id!=='red');
const funded=(seed:number,coins=1000):Profile=>({...createProfile(seed),coins});
const totals=(results:DrawResult[])=>results.reduce((sum,r)=>({coins:sum.coins+r.coins,energy:sum.energy+r.energy}),{coins:0,energy:0});

test('ten sequential draws match ten singles across every collection state, with only the 100-coin discount differing',()=>{
 for(let mask=0;mask<64;mask++)for(const seed of [0,1,4,9,42,1972,0xffffffff]){
  const p=funded(seed);p.ownedCharacters.push(...discoverable.filter((_,i)=>mask&(1<<i)));
  const original=JSON.stringify(p),batch=drawGachaBatch(p,10),singleResults:DrawResult[]=[];
  let single=p;
  for(let i=0;i<10;i++){single=drawGacha(single);singleResults.push(single.lastDraw!);}
  assert.deepEqual(batch.results,singleResults,`mask ${mask} / seed ${seed}`);
  assert.deepEqual(batch.profile,{...single,coins:single.coins+100});
  assert.equal(batch.profile.rng,single.rng);assert.equal(batch.profile.drawCount,10);
  assert.deepEqual(batch.results.map(r=>r.id),[1,2,3,4,5,6,7,8,9,10]);
  assert.equal(JSON.stringify(p),original);validateProfile(batch.profile);
 }
});

test('exactly 900 coins funds the whole batch once and compensation totals match the credited balance',()=>{
 for(const seed of [1,4,9,42,1972]){
  const p=funded(seed,META.gachaBatchCost),{profile,results}=drawGachaBatch(p,10),gains=totals(results);
  assert.equal(profile.coins,p.coins-META.gachaBatchCost+gains.coins);
  assert.equal(profile.energy,p.energy+gains.energy);
  assert.equal(profile.pendingDraw,false);assert.deepEqual(profile.lastDraw,results.at(-1));
  assert.equal(profile.drawCount,p.drawCount+10);
 }
 const p=funded(42,META.gachaCost),single=drawGachaBatch(p,1);
 assert.deepEqual(single.profile,drawGacha(p));assert.deepEqual(single.results,[single.profile.lastDraw]);
 assert.equal(single.profile.coins,20); // The existing duplicate skill compensation remains +20.
});

test('one newly acquired character can become a duplicate later in the same batch after the unowned pool empties',()=>{
 const p=funded(9,900);p.ownedCharacters=rosterIds.filter(id=>id!=='mint');
 const {profile,results}=drawGachaBatch(p,10),characters=results.filter(r=>r.kind==='character');
 assert.deepEqual(characters.map(r=>[r.item,r.duplicate,r.energy]),[['mint',false,0],['mint',true,3],['rose',true,3]]);
 assert.equal(profile.ownedCharacters.filter(id=>id==='mint').length,1);
 assert.equal(profile.ownedCharacters.length,rosterIds.length);
 assert.equal(profile.energy,totals(results).energy);
});

test('a skill gained early in a batch grants the current +20 compensation on its next occurrence',()=>{
 const p=funded(4,900),{profile,results}=drawGachaBatch(p,10);
 assert(!p.ownedSkills.includes('crossfire'));
 assert.deepEqual(results.filter(r=>r.item==='crossfire').map(r=>[r.duplicate,r.coins]),[[false,0],[true,20]]);
 assert.equal(profile.ownedSkills.filter(id=>id==='crossfire').length,1);assert.equal(profile.coins,20);
});

test('99/899 coins and unsupported counts fail before any debit, grant or RNG change',()=>{
 for(const [coins,count] of [[99,1],[899,10]] as const){
  const p=funded(42,coins),before=JSON.stringify(p);
  assert.throws(()=>drawGachaBatch(p,count),new RegExp(String(count===10?900:100)));
  assert.equal(JSON.stringify(p),before);
 }
 const p=funded(1),before=JSON.stringify(p);
 for(const count of [0,2,9,11,100,NaN])assert.throws(()=>drawGachaBatch(p,count as 1|10));
 assert.equal(JSON.stringify(p),before);
});

test('presentation results cannot mutate the retained final result and are not a new save field',()=>{
 const {profile,results}=drawGachaBatch(funded(1),10),saved=JSON.stringify(profile);
 results.at(-1)!.energy=999;results.reverse();
 assert.equal(JSON.stringify(profile),saved);assert(!Object.hasOwn(profile,'results'));
 const again=drawGachaBatch({...profile,coins:900},10);
 assert.equal(again.profile.drawCount,20);assert.equal(again.results[0]!.id,11);
});

test('legacy pending migration clears only the flag, never regrants or rerolls',()=>{
 const previous=drawGacha(funded(9));previous.pendingDraw=true;
 const original=JSON.stringify(previous),migrated=migrateProfile(previous);
 assert.deepEqual(migrated,{...previous,pendingDraw:false});assert.equal(JSON.stringify(previous),original);
 assert.equal(migrateProfile(migrated),migrated);
 const next=drawGachaBatch(previous,10);assert.equal(next.profile.drawCount,11);assert.equal(next.profile.pendingDraw,false);
});

class Storage {
 data=new Map<string,string>();writes=0;fault:'none'|'before'|'after'|'drop'|'read-after'|'unreadable-after'|'external'|'race-after'='none';readBlocked=false;private failRead=false;private raceRead=false;
 getItem(key:string){if(this.readBlocked)throw Error('storage unavailable');if(this.failRead){this.failRead=false;throw Error('read after commit');}const raw=this.data.get(key)??null;if(this.raceRead){this.raceRead=false;this.data.set(key,'external profile');}return raw;}
 setItem(key:string,value:string){
  this.writes++;const fault=this.fault;this.fault='none';
  if(fault==='before')throw Error('quota');
  if(fault==='drop')return;
  this.data.set(key,value);
  if(fault==='after')throw Error('committed then threw');
  if(fault==='read-after')this.failRead=true;
  if(fault==='unreadable-after')this.readBlocked=true;
  if(fault==='race-after'){this.raceRead=true;throw Error('committed then raced');}
  if(fault==='external'){this.data.set(key,'external profile');throw Error('external overwrite');}
 }
}
function storeWith(seed:number,coins=1000){const storage=new Storage(),store=new ProfileStore(storage,()=>true);store.read();store.write(funded(seed,coins));return {storage,store};}

test('one store write commits all ten draws before results are exposed, and reload preserves the interrupted presentation',()=>{
 const {storage,store}=storeWith(9),before=store.current,writes=storage.writes,expected=drawGachaBatch(before,10),actual=store.drawGacha(10);
 assert.equal(storage.writes,writes+1);assert.equal(actual.profile.revision,before.revision+1);
 assert.deepEqual(actual.results,expected.results);assert.deepEqual(actual.profile,{...expected.profile,revision:before.revision+1});
 const durable=JSON.parse(storage.getItem(store.key)!);assert.deepEqual(durable,actual.profile);
 assert(!Object.hasOwn(durable,'results'));assert.equal(durable.pendingDraw,false);
 const reload=new ProfileStore(storage,()=>true);assert.deepEqual(reload.read(),actual.profile);
 assert.deepEqual(store.current,actual.profile);
});

test('failed and dropped saves leave the complete profile unchanged, and a retry draws the same outcomes',()=>{
 for(const fault of ['before','drop'] as const)for(const count of [1,10] as const){
  const {storage,store}=storeWith(9),before=store.current,raw=storage.getItem(store.key),expected=drawGachaBatch(before,count);
  storage.fault=fault;assert.throws(()=>store.drawGacha(count));
  assert.deepEqual(store.current,before);assert.equal(storage.getItem(store.key),raw);
  const reloaded=new ProfileStore(storage,()=>true);assert.deepEqual(reloaded.read(),before);
  const retry=store.drawGacha(count);assert.deepEqual(retry.results,expected.results);
  assert.deepEqual(retry.profile,{...expected.profile,revision:before.revision+1});
 }
});

test('an exact persisted write is successful even if the adapter throws or its first read fails',()=>{
 for(const fault of ['after','read-after'] as const)for(const count of [1,10] as const){
  const {storage,store}=storeWith(9),before=store.current,expected=drawGachaBatch(before,count),writes=storage.writes;
  storage.fault=fault;const actual=store.drawGacha(count);
  assert.equal(storage.writes,writes+1);assert.deepEqual(actual.results,expected.results);
  assert.deepEqual(actual.profile,{...expected.profile,revision:before.revision+1});
  assert.deepEqual(store.current,actual.profile);assert.equal(store.current.drawCount,count);
  assert.deepEqual(new ProfileStore(storage,()=>true).read(),actual.profile);
 }
});

test('gacha failures do not restore stale bytes over an external write or bypass ownership',()=>{
 for(const fault of ['external','race-after'] as const){
  const {storage,store}=storeWith(9),before=store.current;
  storage.fault=fault;assert.throws(()=>store.drawGacha(10));
  assert.equal(storage.getItem(store.key),'external profile');assert.deepEqual(store.current,before);
  assert.throws(()=>store.drawGacha(10));assert.equal(storage.getItem(store.key),'external profile');
 }
 let owned=true;const other=new ProfileStore(new Storage(),()=>owned);other.read();owned=false;
 assert.throws(()=>other.drawGacha(1),/操作権/);
});

test('store rejects underfunded batches without writing and migration of old pending saves writes only once',()=>{
 const {storage,store}=storeWith(1,899),before=store.current,writes=storage.writes;
 assert.throws(()=>store.drawGacha(10));assert.equal(storage.writes,writes);assert.deepEqual(store.current,before);
 const old=drawGacha(funded(1));old.pendingDraw=true;storage.data.set(store.key,JSON.stringify(old));
 const reload=new ProfileStore(storage,()=>true),migrated=reload.read();
 assert.deepEqual(migrated,{...old,pendingDraw:false,revision:old.revision+1});
 const migratedWrites=storage.writes;reload.read();assert.equal(storage.writes,migratedWrites);
});

// An unavailable read cannot establish either success or failure. Block until read access returns.
test('unreadable storage after a write blocks further draws and reconciles that exact draw when access recovers',()=>{
 const {storage,store}=storeWith(9),before=store.current,expected=drawGachaBatch(before,10),writes=storage.writes;
 storage.fault='unreadable-after';assert.throws(()=>store.drawGacha(10),/storage unavailable/);
 assert.deepEqual(store.current,before);assert.equal(storage.writes,writes+1);
 assert.throws(()=>store.drawGacha(1),/storage unavailable/);assert.equal(storage.writes,writes+1);
 assert.throws(()=>new ProfileStore(storage,()=>true).read(),/storage unavailable/);
 storage.readBlocked=false;store.guard();
 assert.deepEqual(store.current,{...expected.profile,revision:before.revision+1});
 assert.equal(storage.writes,writes+1);assert.deepEqual(new ProfileStore(storage,()=>true).read(),store.current);
});
