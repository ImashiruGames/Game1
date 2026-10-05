import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,applyAction,getEnemyIntent,getEnemyDefinition} from '../src/next/core/index.ts';
import {createTrialConfig} from '../src/next/config.ts';
import {enemyIntentView} from '../src/next/ui/enemyIntent.ts';
import {monsterNotes} from '../src/next/ui/monsterPresentation.ts';
import {enemyPortraits} from '../src/next/portraits.ts';
import {deepEncounterV1,selectEncounter,DEEP_ENCOUNTER_VERSION} from '../src/next/app/encounters.ts';
import {deepTraits} from '../src/next/core/monsterBehavior.ts';
import type {EnemyId,Box} from '../src/next/core/types.ts';

const box=(row:number,col:number,owner:Box['owner']='player',type:Box['type']='normal'):Box=>({id:`b${row}:${col}`,row,col,owner,type,status:'normal'});
const enemy=(id:EnemyId,count:number,boxes:Box[]=[],hp?:number)=>{const c=createTrialConfig('blue',id);return createBattle({...c,firstActor:'enemy',initialEnemyTurnCount:count,initialBoxes:boxes,...(hp?{combatants:{...c.combatants,enemy:{...c.combatants.enemy,initialHp:hp}}}:{})});};
const DEEP:EnemyId[]=['biribiriman','hyokuru','hanabell','zeroguard-x','hoshimimi','mokousagi','hinobou'];

test('user-specified deep stats are exact and every deep monster has art and a note',()=>{
 const expected:Record<string,[number,number,number,number]>={biribiriman:[40,3,15,25],hyokuru:[35,5,7,13],hanabell:[70,4,6,12],'zeroguard-x':[150,4,6,16],hoshimimi:[45,3,7,11],mokousagi:[90,2,5,9],hinobou:[40,4,8,14]};
 for(const id of DEEP){const d=getEnemyDefinition(id),[hp,a3,a4,a5]=expected[id]!;assert.equal(d.maxHp,hp,id);assert.deepEqual(d.attacks,{3:a3,4:a4,5:a5},id);assert(monsterNotes[id].length>10);assert.match((enemyPortraits as Record<string,{src:string}>)[id]!.src,/-transparent\.webp/);}
});

test('deep bands follow the plan: zeroguard-x only from floor 40, every deep monster appears',()=>{
 const seen=new Set<EnemyId>();
 for(let seed=0;seed<300;seed++)for(let stage=1;stage<=49;stage++){if(stage===25)continue;const id=selectEncounter(stage,seed,DEEP_ENCOUNTER_VERSION);seen.add(id);if(id==='zeroguard-x')assert(stage>=40);if(id==='hinobou')assert(stage<=24);}
 for(const id of DEEP)assert(seen.has(id),id);
 assert.equal(deepEncounterV1.bands.find(b=>b.id==='deep-3')!.pool[0]!.enemyId,'zeroguard-x');
});

test('hyokuru: every 7th own turn turns one random player box to absolute zero instead of dropping',()=>{
 const boxes=[box(7,0),box(7,1),box(7,2,'enemy')];
 assert.match(enemyIntentView(enemy('hyokuru',6,boxes)).action,/絶対零度/);
 const r=applyAction(enemy('hyokuru',6,boxes),{type:'enemy'});assert(r.accepted);
 const zero=r.state.boxes.filter(b=>b.type==='absolute-zero');assert.equal(zero.length,1);assert.equal(zero[0]!.owner,'player');
 assert.equal(r.state.boxes.length,3,'no insertion on the absolute-zero turn');
 const normal=applyAction(enemy('hyokuru',5,boxes),{type:'enemy'});assert.equal(normal.state.boxes.length,4);
 // Same seed, same target: deterministic RNG.
 assert.deepEqual(applyAction(enemy('hyokuru',6,boxes),{type:'enemy'}).state.boxes,r.state.boxes);
});

test('hanabell heal is applied when its own drop completes the cross',async()=>{
 const {resolveActiveDrop}=await import('../src/next/core/activeDrop.ts');const {getDropOptions}=await import('../src/next/core/board.ts');
 const base=enemy('hanabell',0,[box(7,2,'enemy'),box(6,1,'enemy'),box(6,3,'enemy'),box(5,2,'enemy'),box(7,1,'player'),box(7,3,'player')],30);
 // Remove (6,2) so the drop into column 2 is blocked by (5,2)? Use an open centre instead: put the top arm via the drop.
 const open=createBattle({...base.config,initialBoxes:[box(7,2,'enemy'),box(6,2,'enemy'),box(6,1,'enemy'),box(6,3,'enemy'),box(7,1,'player'),box(7,3,'player')]});
 const option=getDropOptions(open).find(o=>o.available&&o.landing?.col===2&&o.landing.row===5)!;assert(option,'column 2 lands on row 5');
 const r=resolveActiveDrop(open,option);const heal=r.events.find(e=>e.type==='heal') as any;
 assert(heal,'cross heal fires');assert.equal(heal.actor,'enemy');assert.equal(r.state.hp.enemy.current,Math.min(open.hp.enemy.max,30+15));
 // A player-owned cross never heals Hanabell.
 const mine=createBattle({...base.config,firstActor:'player',initialBoxes:[box(7,2),box(6,2),box(6,1),box(6,3)]});
 const opt2=getDropOptions(mine).find(o=>o.available&&o.landing?.col===2)!;const r2=resolveActiveDrop(mine,opt2);
 assert(!r2.events.some(e=>e.type==='heal'&&(e as any).actor==='enemy'));
});

test('zeroguard-x: every 5th own turn drops two neutral rubble boxes without links or damage',()=>{
 const s=enemy('zeroguard-x',4,[box(7,0),box(7,1)]),hp=s.hp.player.current;
 assert.match(enemyIntentView(s).action,/ガレキ/);
 const r=applyAction(s,{type:'enemy'});assert(r.accepted);
 const rubble=r.state.boxes.filter(b=>b.owner==='neutral'&&b.type==='rubble');assert.equal(rubble.length,2);
 assert.equal(r.state.hp.player.current,hp);assert(!r.resolution!.events.some(e=>e.type==='attack'));
});

test('hoshimimi: every 4th own turn its insertion is a shiny enemy box',()=>{
 const r=applyAction(enemy('hoshimimi',3),{type:'enemy'});const dropped=r.resolution!.events.find(e=>e.type==='drop') as any;
 assert.equal(dropped.box.owner,'enemy');assert.equal(dropped.box.type,'shiny');
 const plain=applyAction(enemy('hoshimimi',2),{type:'enemy'}).resolution!.events.find(e=>e.type==='drop') as any;assert.equal(plain.box.type,'normal');
});

test('hoshimimi shiny box doubles the enemy link it joins',async()=>{
 const {resolveActiveDrop}=await import('../src/next/core/activeDrop.ts');const {getDropOptions}=await import('../src/next/core/board.ts');
 const s=enemy('hoshimimi',3,[box(7,0,'enemy'),box(7,1,'enemy')]),opt=getDropOptions(s).find(o=>o.available&&o.landing?.col===2&&o.landing.row===7)!;
 const shiny=resolveActiveDrop(s,opt,false,'shiny').events.find(e=>e.type==='attack') as any,plain=resolveActiveDrop(s,opt,false).events.find(e=>e.type==='attack') as any;
 assert.equal(plain.damage,getEnemyDefinition('hoshimimi').attacks[3]);assert.equal(shiny.damage,plain.damage*2);
});

test('mokousagi: every 5th own turn turns one player box neutral and keeps its type',()=>{
 const s=enemy('mokousagi',4,[box(7,0,'player','shiny'),box(7,1,'enemy')]);
 const r=applyAction(s,{type:'enemy'});const changed=r.state.boxes.find(b=>b.id==='b7:0')!;
 assert.equal(changed.owner,'neutral');assert.equal(changed.type,'shiny');assert.equal(r.state.boxes.length,2);
 const none=applyAction(enemy('mokousagi',4,[box(7,1,'enemy')]),{type:'enemy'});assert(none.accepted);assert.equal(none.state.boxes.length,1);
});

test('hinobou: links gain +3 once its HP is at or below half',async()=>{
 const {resolveActiveDrop}=await import('../src/next/core/activeDrop.ts');const {getDropOptions}=await import('../src/next/core/board.ts');
 const max=getEnemyDefinition('hinobou').maxHp,a3=getEnemyDefinition('hinobou').attacks[3];
 const hit=(hp:number)=>{const s=enemy('hinobou',0,[box(7,0,'enemy'),box(7,1,'enemy')],hp),opt=getDropOptions(s).find(o=>o.available&&o.landing?.col===2&&o.landing.row===7)!;return resolveActiveDrop(s,opt).events.find(e=>e.type==='attack') as any;};
 assert.equal(hit(max).damage,a3);assert.equal(hit(Math.floor(max/2)+1).damage,a3);assert.equal(hit(Math.floor(max/2)).damage,a3+deepTraits.hinobouRageBonus);
});

test('biribiriman needs no gimmick: plain drops with heavy 4/5 links',()=>{
 assert.equal(getEnemyIntent(enemy('biribiriman',3)).type,'drop');
});
