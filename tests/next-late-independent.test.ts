import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectEncounter} from '../src/next/app/encounters.ts';
import {BattleController} from '../src/next/app/BattleController.ts';
import {decodeSave} from '../src/next/app/saveCheckpoint.ts';
import {validateProfile,migrateProfile} from '../src/next/meta/profile.ts';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/late-growth-baseline-90cf0b.json',import.meta.url),'utf8'));
const view={render(){},async animate(){}};
test('independent pristine90cf0b: historical bands-v1 matches 750 captured encounters',()=>{
 for(const {seed,ids} of fixture.encounters)for(let i=0;i<ids.length;i++)assert.equal(selectEncounter(i+1,seed,'bands-v1'),ids[i],`seed ${seed} stage ${i+1}`);
});
test('independent pristine90cf0b: legacy profile and departure remain accepted without rewriting frozen meta',()=>{
 validateProfile(fixture.profile);validateProfile(migrateProfile(fixture.profile));const cp=decodeSave(fixture.departure).checkpoint;const c=BattleController.restore(cp,view);assert.deepEqual(c.snapshot.config.meta,cp.initialConfig.meta);
});
test('independent pristine90cf0b: old reward saves preserve exact heal and next-enemy/RNG state',async()=>{
 for(const f of fixture.rewards){const c=BattleController.restore(decodeSave(f.raw).checkpoint,view);assert(await c.chooseCategory(c.runSnapshot!.offer!.id,'heal'));assert.deepEqual(JSON.parse(JSON.stringify(c.exportCheckpoint())),f.expected,`stage ${f.stage}`);}
});
import {createBattle,applyAction,getEnemyIntent,getEnemyDefinition} from '../src/next/core/index.ts';
import {createTrialConfig} from '../src/next/config.ts';
import {resolveActiveDrop} from '../src/next/core/activeDrop.ts';
import {getDropOptions} from '../src/next/core/board.ts';
import {devilmonFourLink} from '../src/next/core/monsterBehavior.ts';
import {createProfile,freezeRunMeta,treeRankCap,characterGrowth,spentPoints} from '../src/next/meta/profile.ts';
import {prepareDeparture} from '../src/next/meta/departure.ts';
import {applyRunReward} from '../src/next/app/rewards.ts';
import {encodeSave} from '../src/next/app/saveCheckpoint.ts';
import type {Box,EnemyId} from '../src/next/core/types.ts';
const box=(row:number,col:number,owner:Box['owner']='enemy',type:Box['type']='normal'):Box=>({id:`ind:${row}:${col}`,row,col,owner,type,status:'normal'});
function state(id:EnemyId='devilmon',boxes:Box[]=[]){const config=createTrialConfig('blue',id);return createBattle({...config,firstActor:'enemy',initialBoxes:boxes,combatants:{...config.combatants,player:{...config.combatants.player,maxHp:200,initialHp:200}}});}
function vertical(count:number,id:EnemyId='devilmon',types:Box['type'][]=['normal']){return state(id,[...Array.from({length:count-1},(_,i)=>box(7-i,0)),...types.map((type,i)=>box(7,i+1,'player',type))]);}
function drop0(s:ReturnType<typeof state>){return resolveActiveDrop(s,getDropOptions(s).find(o=>o.landing?.col===0)!);}
test('independent Devilmon: exact four only, Shashark stays normal and requested attack tables are exact',()=>{
 assert.deepEqual(getEnemyDefinition('devilmon').attacks,{3:4,4:8,5:12});assert.deepEqual(getEnemyDefinition('shashark').attacks,{3:4,4:12,5:20});
 for(const count of [3,4,5,6]){const r=drop0(vertical(count));assert.equal(r.state.boxes.filter(b=>b.type==='poison').length,count===4?1:0);}
 for(let n=0;n<30;n++)assert.deepEqual(getEnemyIntent({...state('shashark'),enemyTurnCount:n}),{type:'drop'});
 assert.equal(drop0(vertical(4,'shashark')).state.boxes.filter(b=>b.type==='poison').length,0);
});
test('independent Devilmon: one conversion per four-link axis, no overwrite and enemy provenance',()=>{
 let s=state();s={...s,boxes:[box(5,2),box(6,2),box(7,2),box(4,0),box(4,1),box(4,3),box(7,4,'player'),box(7,5,'player')]};
 const option={id:'independent',edge:{row:0,col:2,side:'top' as const},available:true,landing:{row:4,col:2},spawn:{row:0,col:2},path:[],segmentEndRow:7};const r=resolveActiveDrop(s,option);
 assert.equal(r.links.filter(l=>l.count===4).length,2);assert.equal(r.state.boxes.filter(b=>b.type==='poison').length,2);assert(r.state.boxes.filter(b=>b.type==='poison').every(b=>b.poisonSource==='enemy'));
 const mixed=vertical(4,'devilmon',['shiny','frozen','deadly-poison','thorn','normal']);const out=drop0(mixed);for(const b of mixed.boxes.filter(b=>b.owner==='player'&&b.type!=='normal'))assert.deepEqual(out.state.boxes.find(x=>x.id===b.id),b);assert.equal(out.state.boxes.find(b=>b.id==='ind:7:5')!.poisonSource,'enemy');
});
test('independent Devilmon: no eligible target consumes no RNG and does not rewrite source',()=>{
 const s=vertical(4,'devilmon',['shiny','frozen','deadly-poison','thorn']);const r=drop0(s);assert.equal(r.state.rngState,s.rngState);assert.equal(r.state.boxes.filter(b=>b.type==='poison').length,0);const empty=devilmonFourLink(state());assert.equal(empty.events.length,0);
});
test('independent Devilmon: poison starts at player turn end, and actor killed by thorn never attacks/converts',()=>{
 let resolved;for(let seed=1;seed<300;seed++){const s={...vertical(4),rngState:seed*777777};const r=applyAction(s,{type:'enemy'});if(r.state.boxes.some(b=>b.type==='poison')){resolved=r;break;}}
 assert(resolved);assert(!resolved.resolution!.events.some(e=>e.type==='type-damage'&&e.source==='poison'));assert.equal(resolved.state.hp.player.current,192);const option=getDropOptions(resolved.state).find(o=>o.available)!;const next=applyAction(resolved.state,{type:'drop',candidateId:option.id});assert(next.accepted);assert.equal(next.resolution!.events.filter(e=>e.type==='type-damage'&&e.source==='poison').length,1);
 let s=vertical(4,'devilmon',['normal']);s={...s,boxes:[...s.boxes,box(4,1,'enemy','thorn')]};const low={...s,hp:{...s.hp,enemy:{...s.hp.enemy,current:1}}};const r=drop0(low);assert.equal(r.state.hp.enemy.current,0);assert(!r.events.some(e=>e.type==='attack'));assert(!r.state.boxes.some(b=>b.type==='poison'));
});
test('independent growth: L4/L5/L9/L10 caps, no gifted ranks/points, validation and restore boundaries',()=>{
 for(const [level,cap] of [[4,5],[5,6],[9,6],[10,7]] as const)for(const node of ['three','four','five','rewardHeal'] as const)assert.equal(treeRankCap(node,level),cap);
 assert.equal(treeRankCap('slots',30),2);assert.equal(treeRankCap('board',30),3);
 const p=createProfile(1);p.characters.blue.xp=280;const c=p.characters.blue;assert.equal(characterGrowth(c).level,5);assert.equal(characterGrowth(c).points,10);assert.equal(spentPoints(c.tree),0);c.tree.three=5;validateProfile(p);const s=prepareDeparture(freezeRunMeta(p,'blue',true),7);const original=new BattleController(s.config,view,s.options);assert.deepEqual(BattleController.restore(decodeSave(encodeSave(original.exportCheckpoint(),1)).checkpoint,view).snapshot.config.meta,original.snapshot.config.meta);
 c.tree.three=7;assert.throws(()=>validateProfile(p));c.tree.three=6;c.tree.four=5;assert.throws(()=>validateProfile(p));c.tree.three=0;c.tree.four=0;assert.equal(characterGrowth(c).allocatable,10);
});
test('independent reward heal: frozen bonus survives restore, caps at max HP and never mutates profile or defaults',()=>{
 const p=createProfile(8);p.characters.blue.xp=280;p.characters.blue.tree.rewardHeal=3;const meta=freezeRunMeta(p,'blue',true),s=prepareDeparture(meta,3),base=prepareDeparture(freezeRunMeta(createProfile(8),'blue',true),3);assert.equal(s.config.tuning!.rewards.immediateHeal,base.config.tuning!.rewards.immediateHeal+6);
 const c=new BattleController(s.config,view,s.options);const restored=BattleController.restore(decodeSave(encodeSave(c.exportCheckpoint(),1)).checkpoint,view);p.characters.blue.tree.rewardHeal=0;assert.equal(restored.snapshot.config.tuning!.rewards.immediateHeal,s.config.tuning!.rewards.immediateHeal);
 const won={...restored.snapshot,result:{winner:'player' as const,reason:'hp-zero' as const}};const low={...won,hp:{...restored.snapshot.hp,player:{...restored.snapshot.hp.player,current:1}}};assert.equal(applyRunReward(low,'immediate-heal')!.hp.player.current,Math.min(low.hp.player.max,1+s.config.tuning!.rewards.immediateHeal));assert.equal(applyRunReward(won,'immediate-heal')!.hp.player.current,restored.snapshot.hp.player.max);
});
import {ProfileStore} from '../src/next/meta/profile.ts';
import {validateCheckpoint} from '../src/next/app/saveCheckpoint.ts';
test('independent migration: tree backup/write failures preserve legacy bytes and retry without lost points',()=>{
 for(const failAt of [1,2])for(const mode of ['before','after','drop']){
  const raw=JSON.stringify(fixture.profile);const data=new Map<string,string>();let writes=0,fail=true;const storage={getItem(k:string){return data.get(k)??null;},setItem(k:string,v:string){writes++;const hit=fail&&writes===failAt;if(hit&&mode==='before')throw Error('before');if(hit&&mode==='drop')return;data.set(k,v);if(hit&&mode==='after')throw Error('after');}};
  const store=new ProfileStore(storage,()=>true);data.set(store.key,raw);assert.throws(()=>store.read());fail=false;const resumed=new ProfileStore(storage,()=>true).read();validateProfile(resumed);assert.equal(storage.getItem(store.key+'.before-tree-v2'),raw);assert.equal(resumed.characters.blue.xp,fixture.profile.characters.blue.xp);assert(Object.values(resumed.characters.blue.tree).every(rank=>rank===0));assert.equal(characterGrowth(resumed.characters.blue).points,24);
 }
});
test('independent frozen validation: unknown tree versions, cap violations and overspend are rejected',()=>{
 const p=createProfile(5);p.characters.blue.xp=280;p.characters.blue.tree.rewardHeal=5;const s=prepareDeparture(freezeRunMeta(p,'blue',true),9),cp=new BattleController(s.config,view,s.options).exportCheckpoint();
 for(const mutate of [(m:any)=>m.treeVersion=3,(m:any)=>m.tree.rewardHeal=7,(m:any)=>{m.tree.rewardHeal=6;m.tree.three=5;}]){const x=structuredClone(cp);mutate(x.initialConfig.meta);mutate(x.state.config.meta);assert.throws(()=>validateCheckpoint(x));}
});
import {feedbackForEvent} from '../src/next/ui/battleFeedback.ts';
test('independent retained Lv15: cap8 is spendable after migration with exactly retained points',()=>{
 const legacy=structuredClone(fixture.profile);legacy.schema=1;delete legacy.progressionVersion;delete legacy.treeVersion;legacy.characters.blue.xp=2380;legacy.characters.blue.tree={three:0,four:0,five:0,slots:0,board:0};const p=migrateProfile(legacy);const c=p.characters.blue;assert.equal(characterGrowth(c).level,15);assert.equal(characterGrowth(c).points,30);assert.equal(treeRankCap('three',15),8);assert.equal(treeRankCap('rewardHeal',15),8);c.tree.three=8;c.tree.rewardHeal=5;validateProfile(p);assert.equal(characterGrowth(c).allocatable,1);const s=prepareDeparture(freezeRunMeta(p,'blue',true),1);assert.doesNotThrow(()=>new BattleController(s.config,view,s.options));c.tree.three=9;assert.throws(()=>validateProfile(p));
});
test('independent reward heal stays isolated from Health and healing-potion at both ranks',()=>{
 const plain=createProfile(12),boosted=createProfile(12);boosted.characters.blue.xp=1540;boosted.characters.blue.tree.rewardHeal=7;const a=prepareDeparture(freezeRunMeta(plain,'blue',true),1),b=prepareDeparture(freezeRunMeta(boosted,'blue',true),1);assert.equal(b.config.tuning!.rewards.immediateHeal,a.config.tuning!.rewards.immediateHeal+14);assert.deepEqual(b.config.tuning!.skills.health,a.config.tuning!.skills.health);assert.deepEqual(b.config.tuning!.skills['healing-potion'],a.config.tuning!.skills['healing-potion']);
});
test('independent Devilmon poison feedback is readable, targets changed box, and stays distinct from freeze',()=>{
 const r=drop0(vertical(4));const event=r.events.find(e=>e.type==='enemy-box-changed');assert(event);assert.equal(event.boxType,'poison');const feedback=feedbackForEvent(event,r.links);assert(feedback);assert.equal(feedback.text,'どく 1個');assert.match(feedback.detail,/デビルモンの4リンク/);assert.equal(feedback.anchor,'player');assert.deepEqual(feedback.boxIds,r.state.boxes.filter(b=>b.type==='poison').map(b=>b.id));assert.doesNotMatch(feedback.text+feedback.detail,/凍結|氷結/);
});
