import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import type {Profile,DrawResult} from '../src/next/meta/profile.ts';
import {createProfile,drawGacha,characterDrawPool,ProfileStore,META,validateProfile} from '../src/next/meta/profile.ts';import {rosterIds} from '../src/next/meta/roster.ts';import {characterGachaOdds,percentLabel} from '../src/next/meta/gachaOdds.ts';
import {sampleUniformIndex} from '../src/next/core/random.ts';import {normalSkillIds,skillCatalog} from '../src/next/core/skillCatalog.ts';import {LEGACY_BOARDS} from '../src/next/meta/kits.ts';import {roster} from '../src/next/meta/roster.ts';
const all=rosterIds.filter(id=>id!=='blue'&&id!=='red');
// Frozen pre-redesign algorithm with the pre-priority character pool.
// Keep this independent of the current implementation to catch RNG/reward regressions.
function baseline(p:Profile):Profile {if(p.pendingDraw)throw new Error('先に前回のガチャ結果を確認してください');if(p.coins<META.gachaCost)throw new Error(`コインが${META.gachaCost}枚必要です`);const n=structuredClone(p);let r=sampleUniformIndex(n.rng,100);n.rng=r.rngState;n.coins-=META.gachaCost;const result:DrawResult={id:++n.drawCount,kind:'energy',item:'経験値エナジー ×2',duplicate:false,coins:0,energy:0};if(r.index<META.characterRate){const candidates=rosterIds.filter(id=>id!=='blue'&&id!=='red');r=sampleUniformIndex(n.rng,candidates.length);n.rng=r.rngState;const id=candidates[r.index]!;result.kind='character';result.item=id;result.duplicate=n.ownedCharacters.includes(id);if(result.duplicate){result.energy=META.duplicateCharacterEnergy;n.energy+=result.energy;}else {n.ownedCharacters.push(id);if(n.characters[id].board===LEGACY_BOARDS[id])n.characters[id].board=roster[id].board;}}else if(r.index<META.characterRate+META.skillRate){const candidates=normalSkillIds.filter(id=>!['starter-upgrade-only','never','trophy'].includes(skillCatalog[id].rewardAccess??'shared'));r=sampleUniformIndex(n.rng,candidates.length);n.rng=r.rngState;const id=candidates[r.index]!;result.kind='skill';result.item=id;result.duplicate=n.ownedSkills.includes(id);if(result.duplicate){result.coins=META.duplicateSkillCoins;n.coins+=result.coins;}else n.ownedSkills.push(id);}else{result.energy=2;n.energy+=2;}n.lastDraw=result;n.pendingDraw=true;return n;}
test('all64 collection states select only missing characters until complete, with accurate next-draw odds',()=>{
 for(let mask=0;mask<64;mask++){const p=createProfile(1972);p.coins=100;p.ownedCharacters.push(...all.filter((_,i)=>mask&(1<<i)));const before=JSON.stringify(p),pool=characterDrawPool(p),missing=all.filter(id=>!p.ownedCharacters.includes(id)),odds=characterGachaOdds(p);assert.deepEqual(pool,missing.length?missing:all);assert.deepEqual(odds.candidates,pool);assert.equal(odds.missingCount,missing.length);assert.equal(odds.eachOverallPercent*pool.length,20);const n=drawGacha(p);assert.equal(n.lastDraw!.kind,'character');assert(pool.includes(n.lastDraw!.item as typeof all[number]));assert.equal(n.lastDraw!.duplicate,missing.length===0);assert.equal(n.energy-p.energy,missing.length?0:3);assert.equal(n.coins,0);assert.equal(n.drawCount,1);assert.equal(n.pendingDraw,false);assert.equal(JSON.stringify(p),before);validateProfile(n);if(!missing.length)assert.deepEqual(n,{...baseline(p),pendingDraw:false});}
});
test('non-character outcomes are identical to the previous rule, with no RNG reset or coin/skill/energy changes',()=>{let checked=0;for(let i=0;i<2000;i++){const p=createProfile((Math.imul(i,2654435761)+123)>>>0);p.coins=1000;p.ownedCharacters.push('mint','amber');const old=baseline(p),next=drawGacha(p);if(old.lastDraw!.kind!=='character'){assert.deepEqual(next,{...old,pendingDraw:false});checked++;}}assert(checked>1500);});
test('old committed pending duplicates normalize on load without retroactive conversion',()=>{
 const p=createProfile(1972);p.coins=100;p.ownedCharacters.push('mint');const old=baseline(p);
 assert.equal(old.lastDraw!.kind,'character');assert(old.lastDraw!.duplicate);assert(old.pendingDraw);
 const raw=JSON.stringify(old),data=new Map<string,string>();
 const storage={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);}};
 const store=new ProfileStore(storage,()=>true);data.set(store.key,raw);const loaded=store.read();
 assert.deepEqual(loaded,{...old,pendingDraw:false,revision:old.revision+1});assert.equal(JSON.stringify(old),raw);
 const saved=storage.getItem(store.key);store.read();assert.equal(storage.getItem(store.key),saved);
 store.update(x=>{x.coins=100;return x;});store.update(drawGacha);assert.equal(store.current.drawCount,2);
});
test('before-write failures and uncertain complete writes retain one atomic draw without pending locks',()=>{
 for(const fault of ['before','after'] as const){
  const data=new Map<string,string>();let fail=false;
  const storage={getItem:(k:string)=>data.get(k)??null,setItem(k:string,v:string){if(fail&&fault==='before')throw Error('quota');data.set(k,v);if(fail&&fault==='after'){fail=false;throw Error('uncertain');}}};
  const store=new ProfileStore(storage,()=>true);store.read();store.update(p=>{p.coins=500;p.rng=1972;p.ownedCharacters.push('mint');return p;});
  const old=store.current,expected=drawGacha(old);fail=true;assert.throws(()=>store.update(drawGacha));assert.deepEqual(store.current,old);
  fail=false;store.guard();if(store.current.drawCount===old.drawCount)store.update(drawGacha);
  const current=store.current;assert.equal(current.coins,expected.coins);assert.equal(current.rng,expected.rng);assert.equal(current.drawCount,1);assert.deepEqual(current.lastDraw,expected.lastDraw);assert.deepEqual(current.ownedCharacters,expected.ownedCharacters);assert.equal(current.pendingDraw,false);
  store.update(drawGacha);assert.equal(store.current.drawCount,2);
 }
});
test('insufficient coins leave the input unchanged and legacy pending no longer blocks a funded draw',()=>{
 const p=createProfile(2),raw=JSON.stringify(p);assert.throws(()=>drawGacha(p));assert.equal(JSON.stringify(p),raw);
 p.coins=100;const old=drawGacha(p);old.coins=100;old.pendingDraw=true;const pending=JSON.stringify(old),next=drawGacha(old);
 assert.equal(next.drawCount,2);assert.equal(next.pendingDraw,false);assert.equal(JSON.stringify(old),pending);
});
test('probability copy rounds honestly and never claims fixed individual rates or a draw-count guarantee',()=>{assert.equal(percentLabel(20/6),'約3.33%');assert.equal(percentLabel(20/3),'約6.67%');assert.equal(percentLabel(10),'10%');const p=createProfile();assert.match(characterGachaOdds(p).summary,/未所持の6人/);p.ownedCharacters.push(...all.slice(0,5));assert.match(characterGachaOdds(p).summary,/各20%/);p.ownedCharacters.push(all[5]!);assert.match(characterGachaOdds(p).summary,/全6人/);const home=readFileSync(new URL('../src/next/meta/home.ts',import.meta.url),'utf8');assert.match(home,/<summary>排出確率/);assert.match(home,/percentLabel\(odds.eachOverallPercent\)/);assert.match(home,/class="gacha-odds"/);assert.doesNotMatch(home,/確率は全抽選で一定/);});

test('a new character result preserves accumulated XP, builds, pools, trophies and settlement records',()=>{
 const p=createProfile(1972);p.coins=500;p.energy=9;p.characters.blue.xp=1234;p.characters.red.xp=70;p.receipts['previous-run']={runId:'previous-run',character:'blue',xp:20,coins:10,defeated:2,clear:false,trophies:[],at:12};p.launches['active-run']={character:'red',snapshot:'{"version":1}'};p.trophies['clear50:first']=1;validateProfile(p);
 const n=drawGacha(p);assert.equal(n.lastDraw!.kind,'character');assert.deepEqual(n.characters,p.characters);assert.deepEqual(n.receipts,p.receipts);assert.deepEqual(n.launches,p.launches);assert.deepEqual(n.trophies,p.trophies);assert.deepEqual(n.ownedSkills,p.ownedSkills);assert.equal(n.selected,p.selected);assert.equal(n.energy,9);assert.equal(n.coins,400);assert.notEqual(n.rng,p.rng);
});
