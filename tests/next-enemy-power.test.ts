import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, applyAction } from '../src/next/core/battle.ts';
import { createTrialConfig } from '../src/next/config.ts';
import { enemyPowerView, enemyPowerHudHtml, enemyPowerDetailsHtml, renderEnemyPower } from '../src/next/ui/enemyPower.ts';
import type { Box, EnemyId } from '../src/next/core/types.ts';

test('enemy HUD reads actual encounter attacks rather than base enemy definitions',()=>{
 const base=createTrialConfig('blue','speed-core'),s=createBattle({...base,combatants:{...base.combatants,enemy:{...base.combatants.enemy,attacks:{3:8,4:9,5:11}}}}),before=JSON.stringify(s);
 assert.deepEqual(enemyPowerView(s).tiers.map(v=>v.damage),[8,9,11]);assert.match(enemyPowerDetailsHtml(s),/>8<\/td>/);assert.equal(JSON.stringify(s),before);
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
