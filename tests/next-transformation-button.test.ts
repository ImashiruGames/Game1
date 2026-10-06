import test from 'node:test';import assert from 'node:assert/strict';
import {prepareTrialSetup} from '../src/next/config.ts';
import {BattleController} from '../src/next/app/BattleController.ts';
import {transformationButton} from '../src/next/ui/transformationButton.ts';
import {activateManualTransformation,canManualTransform} from '../src/next/core/transformations.ts';
import {gaugeDefinition} from '../src/next/core/gauge.ts';
import {tuningOf} from '../src/next/core/tuning.ts';
import type {BattleState} from '../src/next/core/types.ts';
const setup=()=>{const x=prepareTrialSetup({character:'blue',firstEnemy:'marujiro',seed:7,mode:'manual',stage:1,fixture:'charged',route:'boss-loop'});return new BattleController(x.config,{render(){},async animate(){}},x.options);};
const ready=(s:BattleState,interactive=true)=>transformationButton(s,interactive).includes('data-ready="true"');
test('transformation button obeys exact gauge boundary and exposes text as well as availability',()=>{
 const s=setup().snapshot,cost=gaugeDefinition(s.config.characterId,tuningOf(s.config))!.cost;
 for(const gauge of [0,cost-1,cost,cost+1]){const state={...s,gauge},markup=transformationButton(state,true);assert.equal(ready(state),gauge>=cost);assert(markup.includes('変化する'));assert(markup.includes(gauge>=cost?'変化可能！':'ゲージ不足'));assert.equal(markup.includes('disabled'),gauge<cost);}
});
test('full gauge cannot imply usable during lock, enemy turn, death, end, auto mode or active transformation',()=>{
 const s=setup().snapshot;
 assert(ready(s));assert(!ready(s,false));
 const unavailable:BattleState[]=[{...s,actor:'enemy'},{...s,hp:{...s.hp,player:{...s.hp.player,current:0}}},{...s,hp:{...s.hp,enemy:{...s.hp.enemy,current:0}}},{...s,config:{...s.config,strategy:{gauge:'bands',transformation:'automatic-link'}}}, {...s,result:{winner:'player',reason:'hp-zero'}},activateManualTransformation(s).state];
 for(const state of unavailable){assert(!canManualTransform(state));assert(!ready(state));assert(transformationButton(state,true).includes('disabled'));}
 assert(ready(s,true));
});
test('use and checkpoint restore keep button in sync with authoritative transformation state',async()=>{
 const c=setup();await c.start();assert(ready(c.snapshot));await c.transform();assert(!ready(c.snapshot));assert(transformationButton(c.snapshot,true).includes('変化中'));
 const restored=BattleController.restore(c.exportCheckpoint(),{render(){},async animate(){}});await restored.start();assert(!ready(restored.snapshot));assert.equal(transformationButton(restored.snapshot,true),transformationButton(c.snapshot,true));
 const unused=setup(),resumed=BattleController.restore(unused.exportCheckpoint(),{render(){},async animate(){}});await resumed.start();assert(ready(resumed.snapshot));
});
test('character-specific full-gauge gates suppress readiness until their effect can apply',async()=>{
 const {createProfile,freezeRunMeta}=await import('../src/next/meta/profile.ts'),{prepareDeparture}=await import('../src/next/meta/departure.ts'),{createBattle}=await import('../src/next/core/index.ts');
 const p=createProfile();p.ownedCharacters.push('violet','silver');
 for(const id of ['violet','silver'] as const){const state=createBattle({...prepareDeparture(freezeRunMeta(p,id,false),1).config,initialGauge:150});
 const blocked:BattleState=id==='violet'?{...state,boxes:[]}:{...state,barrier:999};assert(!ready(blocked));assert(transformationButton(blocked,true).includes('条件未達'));
 const usable:BattleState=id==='violet'?{...state,boxes:[{id:'target',row:7,col:0,owner:'enemy',type:'normal',status:'normal'}]}:{...state,barrier:0};assert(ready(usable));
 }
});

test('visible transformation copy stays minimal while inaccessible conditions remain described to assistive technology',()=>{const s=setup().snapshot;for(const state of [s,{...s,actor:'enemy' as const},{...s,gauge:0},activateManualTransformation(s).state])for(const interactive of [true,false]){const html=transformationButton(state,interactive),visible=html.replace(/<[^>]*>/g,'');assert(/^(変化する)(ゲージ不足|変化可能！|変化中)?$/.test(visible));assert(!html.includes('title='));assert(html.includes('aria-label='));}});
