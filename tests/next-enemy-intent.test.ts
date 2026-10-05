import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle } from '../src/next/core/battle.ts';
import { getEnemyIntent } from '../src/next/core/skills.ts';
import { createTrialConfig } from '../src/next/config.ts';
import { createTuning } from '../src/next/core/tuning.ts';
import { enemyActionLabel, enemyIntentView, enemyIntentDetailsHtml, renderEnemyIntent } from '../src/next/ui/enemyIntent.ts';
import type { BattleState, EnemyId } from '../src/next/core/types.ts';
const state=(id:EnemyId,count=0)=>createBattle({...createTrialConfig('blue',id),initialEnemyTurnCount:count});

test('Speed uses its own counter, configured fifth-turn pulse and current fixed bonus',()=>{
 for(let count=0;count<11;count++){
  const s={...state('speed-core',count),turn:987,config:{...state('speed-core').config,enemyFixedDamageBonus:2}},view=enemyIntentView(s);
  assert.equal(view.ownTurn,count+1);assert.equal(view.cycle!.position,count%5+1);assert.equal(view.action,count%5===4?'固定5→投入':'投入');assert.equal(view.action,enemyActionLabel(getEnemyIntent(s)));
 }
 const s=state('speed-core');const custom={...s,config:{...s.config,tuning:createTuning({bosses:{speedPulseEvery:3,speedPulseDamage:4}})},enemyTurnCount:2};assert.equal(enemyIntentView(custom).label,'次 3/3 固定4→投入');
});
test('Mother seven-step cycle and sequential double drops match existing intents',()=>{
 const expected=['投入','投入','投入','投入','待機','投入×2','投入×2'];
 for(let count=0;count<14;count++){
  const view=enemyIntentView(state('mother-core',count));assert.equal(view.action,expected[count%7]);assert.equal(view.cycle!.position,count%7+1);assert.deepEqual(view.cycle!.steps,expected);
 }
 const html=enemyIntentDetailsHtml(state('mother-core',5));assert.match(html,/投入×2は1手番の中で1回ずつ順に解決/);assert.match(html,/aria-current="step"/);assert.match(html,/敵自身の完了手番：5/);
});
test('Mother threshold changes the next enemy phase at exact ratio, without repeated resets',()=>{
 const s=state('mother-core',13),hp=(current:number)=>({...s,hp:{...s.hp,enemy:{current,max:151}}});
 assert.equal(enemyIntentView(hp(31)).cycle!.phase,'normal');const view=enemyIntentView(hp(30));assert.equal(view.cycle!.phase,'critical');assert.equal(view.cycle!.position,1);assert.equal(view.action,'固定5→投入');assert.equal(view.ownTurn,14);
 const retained:BattleState={...hp(151),enemyPhase:{phase:'critical',completedTurns:1}};assert.equal(enemyIntentView(retained).cycle!.position,2);assert.equal(enemyIntentView(retained).action,'投入');assert.deepEqual(enemyIntentView(retained).cycle!.steps,['固定5→投入','投入']);
});
test('rendering schedules is pure and never advances random state, HP, or phase counters',()=>{
 const s=state('mother-core',5),before=JSON.stringify(s);for(let i=0;i<50;i++){enemyIntentView(s);enemyIntentDetailsHtml(s);}assert.equal(JSON.stringify(s),before);
});
test('active plan uses before snapshot even when display phase has advanced; ended means no next',()=>{
 const before=state('mother-core',5),shown:BattleState={...before,enemyTurnCount:6,enemyPhase:{phase:'normal',completedTurns:6}};
 assert.equal(enemyIntentView(shown,before).label,'実行 6/7 投入×2');assert.equal(enemyIntentView(shown).label,'次 7/7 投入×2');
 const terminal:BattleState={...shown,result:{winner:'player',reason:'hp-zero'}};assert.equal(enemyIntentView(terminal).label,'戦闘終了');assert.equal(enemyIntentView(terminal).cycle,null);
 const low={...before,hp:{...before.hp,enemy:{current:30,max:150}}},advanced={...low,enemyPhase:{phase:'critical' as const,completedTurns:1}};
 assert.equal(enemyIntentView(advanced,low).label,'実行 1/2 固定5→投入');assert.equal(enemyIntentView(advanced).label,'次 2/2 投入');
});
test('normal enemies preserve ordinary heal/drop intent and DOM text updates without extra nodes',()=>{
 assert.equal(enemyIntentView(state('nigirin',4)).label,'次 HP+10');assert.equal(enemyIntentView(state('marujiro')).label,'次 投入');
 let boss=false;const attrs=new Map<string,string>();const host={textContent:'',title:'',classList:{toggle:(_name:string,value:boolean)=>{boss=value;}},setAttribute:(key:string,value:string)=>attrs.set(key,value)};
 renderEnemyIntent(host as unknown as HTMLElement,state('speed-core',4));assert.equal(host.textContent,'次 5/5 固定3→投入');assert.ok(boss);assert.match(attrs.get('aria-label')!,/敵自身の5手番目/);
 renderEnemyIntent(host as unknown as HTMLElement,state('marujiro'));assert.equal(boss,false);
});

test('very long configured cycles retain the real next action without allocating an unbounded list',()=>{
 const s=state('speed-core',999_999_999);const extended={...s,config:{...s.config,tuning:createTuning({bosses:{speedPulseEvery:1_000_000_000}})}};
 const view=enemyIntentView(extended);assert.equal(view.cycle!.position,1_000_000_000);assert.equal(view.cycle!.length,1_000_000_000);assert.equal(view.cycle!.steps.length,32);assert.equal(view.action,'固定3→投入');assert.ok(enemyIntentDetailsHtml(extended).includes('先頭32手だけ'));
});
