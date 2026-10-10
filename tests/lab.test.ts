import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createBattle as baselineCreate, applyAction as baselineAction } from '../src/core/battle.ts';
import { battleFixtures } from '../src/core/definitions.ts';
import { createBattle, applyAction } from '../src/lab/engine/battle.ts';
import { getDropOptions } from '../src/lab/engine/board.ts';
import { fixtureConfig } from '../src/lab/fixtures.ts';
import { LabSession } from '../src/lab/session.ts';
import { ownsSquare } from '../src/lab/mechanics.ts';
import type { BattleConfig } from '../src/lab/engine/types.ts';
const attack=(r:ReturnType<typeof applyAction>)=>r.resolution!.events.filter(e=>e.type==='attack');
const drop=(s:ReturnType<typeof createBattle>,col:number)=>applyAction(s,{type:'drop',candidateId:`ceiling:${col}:0`});
// Keep the original baseline manifest unchanged; only explicitly retired UI paths are absent.
const retirement=JSON.parse(readFileSync(new URL('./fixtures/root-retirement.json',import.meta.url),'utf8')) as {deleted:{path:string;category:string}[];replacementEntries:string[]};
const retiredUi=new Set(retirement.deleted.filter(f=>f.category==='old').map(f=>f.path));
test('lab preserves retained release sources and explicitly retired UI stays absent',()=>{
 const portraits=JSON.parse(readFileSync(new URL('./fixtures/next-aoi-akari-source-manifest.json',import.meta.url),'utf8'));
 const manifest=JSON.parse(readFileSync(new URL('../src/lab/baseline-manifest.json',import.meta.url),'utf8'));
 for(const [file,hash] of Object.entries({...manifest.files,...Object.fromEntries(Object.entries(portraits.files).filter(([file])=>file in manifest.files))})){
  if(retiredUi.has(file)){assert.equal(existsSync(new URL('../'+file,import.meta.url)),false,file);continue;}
  if(retirement.replacementEntries.includes(file)){assert.equal(file,'index.html');assert.match(readFileSync(new URL('../'+file,import.meta.url),'utf8'),/url=\.\/next\//);continue;}
  const raw=readFileSync(new URL('../'+file,import.meta.url));
  const bytes=raw;
  assert.equal(createHash('sha256').update(bytes).digest('hex'),hash,file);
 }
});
test('unequipped lab matches original engine states and events over deterministic traces',()=>{for(const fixture of battleFixtures){let base=baselineCreate(fixture),lab=createBattle(fixture);for(let i=0;i<30&&!base.result;i++){const legal=getDropOptions(lab).filter(o=>o.available);const action=lab.actor==='enemy'?{type:'enemy' as const}:lab.transformation?.character==='red'&&!lab.playerTurnStarted&&lab.transformation.remainingStarts>0?{type:'start-turn' as const}:legal.length?{type:'drop' as const,candidateId:legal[i%legal.length]!.id}:{type:'skip' as const};const a=baselineAction(base,action),b=applyAction(lab,action);assert.deepEqual(b,a,`${fixture.id} step ${i}`);base=a.state;lab=b.state;if(!a.accepted)break;}}});
test('A061 includes the newly inserted bottom box and adds three once',()=>{const config=fixtureConfig('foundation-on','blue','marujiro',1,'A061'),state=createBattle(config);const r=drop(state,2);assert.equal(attack(r)[0]!.damage,7);assert.equal(state.boxes.length,2);assert.equal(r.resolution!.events.filter(e=>e.type==='experiment'&&e.triggered).length,1);});
test('A061 does not count elevated own boxes or neutral bottom supports',()=>assert.equal(attack(drop(createBattle(fixtureConfig('foundation-off','blue','marujiro',1,'A061')),2))[0]!.damage,4));
test('A061 caps at three and only first axis is modified',()=>{const f=battleFixtures.find(f=>f.id==='cross-attack')!;const c:BattleConfig={...f,experiment:'A061',initialBoxes:f.initialBoxes.map(b=>b.row===2?{...b,owner:'player'}:b)};const r=drop(createBattle(c),1);assert.deepEqual(attack(r).map(e=>e.damage),[7,4]);});
test('A062 counts a distant square and reduces a seeded incoming hit',()=>{const r=applyAction(createBattle(fixtureConfig('ironwall-on','blue','hikikizan',1112,'A062')),{type:'enemy'});assert.equal(r.resolution!.events.find(e=>e.type==='drop')!.landing.col,4);assert.equal(attack(r)[0]!.damage,8);});
test('A062 mixed owner square does not mitigate',()=>{const r=applyAction(createBattle(fixtureConfig('ironwall-off','blue','hikikizan',1112,'A062')),{type:'enemy'});assert.equal(attack(r)[0]!.damage,10);});
test('A062 low incoming damage is clamped at zero',()=>{const c=fixtureConfig('ironwall-on','blue','marujiro',1112,'A062');const r=applyAction(createBattle({...c,combatants:{...c.combatants,enemy:{...c.combatants.enemy,attacks:{3:1,4:1,5:1}}}}),{type:'enemy'});assert.equal(attack(r)[0]!.damage,0);});
test('A062 never protects against blocked-board replacement',()=>{const f=battleFixtures.find(f=>f.id==='blocked-player')!;const r=applyAction(createBattle({...f,firstActor:'enemy',experiment:'A062'}),{type:'enemy'});assert.equal(r.state.hp.player.current,0);assert.equal(r.resolution!.events.some(e=>e.type==='experiment'),false);});
test('rejected action is immutable and replay reset is deterministic',()=>{const config=fixtureConfig('foundation-on','blue','marujiro',1,'A061');const a=new LabSession(config),b=new LabSession(config);const invalid=a.act({type:'drop',candidateId:'bad'});assert.equal(invalid.accepted,false);assert.deepEqual(a.state,b.state);a.act({type:'drop',candidateId:'ceiling:2:0'});b.act({type:'drop',candidateId:'ceiling:2:0'});assert.deepEqual(a.state,b.state);});
test('square existence rejects a single missing box',()=>{const s=createBattle(fixtureConfig('ironwall-on','blue','marujiro',1112,'A062'));assert.equal(ownsSquare(s),true);assert.equal(ownsSquare({...s,boxes:s.boxes.filter(b=>b.id!=='lab:6:1')}),false);});

import { parityCases as labParityCases } from './helpers/labParityCases.ts';
test('all102 unequipped lab gameplay traces match frozen pre-refactor reference',()=>{const baseline=JSON.parse(readFileSync(new URL('./fixtures/default-v1-parity.json',import.meta.url),'utf8'));assert.deepEqual(labParityCases(),baseline.cases);});
