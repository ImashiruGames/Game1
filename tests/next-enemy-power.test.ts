import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, applyAction } from '../src/next/core/battle.ts';
import { createTrialConfig } from '../src/next/config.ts';
import { enemyPowerView, enemyPowerHudHtml, enemyPowerDetailsHtml, renderEnemyPower } from '../src/next/ui/enemyPower.ts';
import type { Box, EnemyId } from '../src/next/core/types.ts';

test('enemy HUD reads actual encounter attacks rather than base enemy definitions',()=>{
 const base=createTrialConfig('blue','speed-core'),s=createBattle({...base,combatants:{...base.combatants,enemy:{...base.combatants.enemy,attacks:{3:8,4:9,5:11}}}}),before=JSON.stringify(s);
 assert.deepEqual(enemyPowerView(s).tiers.map(v=>v.damage),[8,9,11]);assert.match(enemyPowerDetailsHtml(s),/>8<small>通常比 ＋/);assert.equal(JSON.stringify(s),before);
});
test('Hikikizan4/5+ danger is explicit; ordinary and non-increasing custom tables are not mislabeled',()=>{
 const s=createBattle(createTrialConfig('blue','hikikizan'));assert.deepEqual(enemyPowerView(s).tiers.map(v=>v.damage),[3,10,15]);assert.deepEqual(enemyPowerView(s).tiers.map(v=>v.emphasized),[false,true,true]);assert.match(enemyPowerHudHtml(s),/4連〜注意/);assert.match(enemyPowerDetailsHtml(s),/4連で10／5連以上で15/);
 assert.equal(enemyPowerView(createBattle(createTrialConfig('blue','marujiro'))).warning,'');
 assert.equal(enemyPowerView({...s,config:{...s.config,combatants:{...s.config.combatants,enemy:{...s.config.combatants.enemy,attacks:{3:10,4:7,5:8}}}}}).warning,'');
});
test('displayed enemy3/4/5+ values match actual attacks, including6-link',()=>{
 for(const enemy of ['marujiro','hikikizan','nigirin','speed-core','mother-core'] as const satisfies readonly EnemyId[])for(const count of [3,4,5,6]){
  const base=createTrialConfig('blue',enemy),boxes:Box[]=Array.from({length:count-1},(_,i)=>({id:`e${i}`,row:7-i,col:0,owner:'enemy',type:'normal',status:'normal'}));
  const s=createBattle({...base,firstActor:'enemy',board:{...base.board,width:1},initialBoxes:boxes});const view=enemyPowerView(s),result=applyAction(s,{type:'enemy'});const attack=result.resolution!.events.find(event=>event.type==='attack');assert.equal(attack?.type==='attack'&&attack.damage,view.tiers.find(value=>value.tier===Math.min(count,5))!.damage);
 }
});
test('enemy HUD mounts once, uses existing Details action, and updates after enemy changes',()=>{
 let meter:{className:string;innerHTML:string;title:string;type:string;dataset:Record<string,string>;setAttribute:(key:string,value:string)=>void}|null=null,appends=0;
 const host={querySelector:()=>meter,ownerDocument:{createElement:()=>({className:'',innerHTML:'',title:'',type:'',dataset:{},setAttribute(){}})},append:(value:typeof meter)=>{meter=value;appends++;}};
 renderEnemyPower(host as unknown as HTMLElement,createBattle(createTrialConfig('blue','marujiro')));renderEnemyPower(host as unknown as HTMLElement,createBattle(createTrialConfig('blue','hikikizan')));
 assert.equal(appends,1);const value=meter as unknown as {innerHTML:string;dataset:Record<string,string>};assert.equal(value.dataset.details,'true');assert.match(value.innerHTML,/4連〜注意/);
});

test('HP-triggered boost uses the same current power as real 3/4/5+ attacks and reloads without mutation',()=>{
 for(const hp of [40,21,20,1])for(const count of [3,4,5,6]){
  const base=createTrialConfig('blue','hinobou'),boxes:Box[]=Array.from({length:count-1},(_,i)=>({id:`e${i}`,row:7-i,col:0,owner:'enemy',type:'normal',status:'normal'}));
  const s=createBattle({...base,firstActor:'enemy',board:{...base.board,width:1},combatants:{...base.combatants,enemy:{...base.combatants.enemy,initialHp:hp}},initialBoxes:boxes}),before=JSON.stringify(s);
  const v=enemyPowerView(s),attack=applyAction(s,{type:'enemy'}).resolution!.events.find(e=>e.type==='attack');
  assert.equal(attack?.type==='attack'&&attack.damage,v.tiers.find(v=>v.tier===Math.min(count,5))!.damage);
  assert.deepEqual(v.tiers.map(v=>v.increase),hp<=20?[3,3,3]:[0,0,0]);
  assert.equal(v.boost,hp<=20?'火力↑ ＋3':'');assert.deepEqual(enemyPowerView(JSON.parse(before)),v);assert.equal(JSON.stringify(s),before);
 }
});
test('all enemies display actual scaled power and individual deltas; ordinary power omits boost labels',()=>{
 for(const id of ['marujiro','hikikizan','hinobou','mother-core'] as const){
  const s=createBattle(createTrialConfig('blue',id)),base=enemyPowerView(s);
  assert.doesNotMatch(enemyPowerHudHtml(s),/enemy-power-boost|火力↑/);
  const boosted={...s,config:{...s.config,combatants:{...s.config.combatants,enemy:{...s.config.combatants.enemy,attacks:{3:base.tiers[0]!.damage+1,4:base.tiers[1]!.damage+2,5:base.tiers[2]!.damage+3}}}}};
  assert.deepEqual(enemyPowerView(boosted).tiers.map(v=>v.increase),[1,2,3]);assert.match(enemyPowerHudHtml(boosted),/↑1\/2\/3/);assert.match(enemyPowerDetailsHtml(boosted),/通常比 ＋2/);
 }
});
test('returning above the HP threshold removes the boost rather than inventing a persistent rage state',()=>{
 const s=createBattle(createTrialConfig('blue','hinobou')),low={...s,hp:{...s.hp,enemy:{...s.hp.enemy,current:20}}};
 assert.equal(enemyPowerView(low).boost,'火力↑ ＋3');assert.equal(enemyPowerView({...low,hp:s.hp}).boost,'');
});
