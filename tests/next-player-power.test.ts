import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, applyAction } from '../src/next/core/battle.ts';
import { createTrialConfig } from '../src/next/config.ts';
import { createSkill } from '../src/next/core/playerBuild.ts';
import { playerPowerView, playerPowerHudHtml, playerPowerDetailsHtml, renderPlayerPower } from '../src/next/ui/playerPower.ts';
import type { BattleState, Box } from '../src/next/core/types.ts';
const initial=()=>createBattle(createTrialConfig('red'));

test('player current power keeps base, run bonus and battle Grow separate without mutation',()=>{
 const s=initial(),grown={...s,link3Growth:7,build:{...s.build!,power:{3:2,4:4,5:6}}};const before=JSON.stringify(grown),view=playerPowerView(grown);
 assert.deepEqual(view.tiers.map(v=>v.permanent),[2,4,6]);assert.deepEqual(view.tiers.map(v=>v.growth),[7,0,0]);assert.deepEqual(view.tiers.map(v=>v.current),[13,11,17]);assert.match(view.warning,/3連 > 4連/);assert.equal(JSON.stringify(grown),before);
 assert.match(playerPowerHudHtml(grown),/火\+7/);assert.match(playerPowerDetailsHtml(grown),/基礎4 ＋ 永続2 ＋ 戦闘成長7/);assert.match(playerPowerDetailsHtml(grown),/次の戦闘で成長は0/);
});
test('monotonic and equal tiers have no warning; no Grow equipment has no vertical override',()=>{
 const s=createBattle(createTrialConfig('blue'));assert.equal(playerPowerView(s).grow,null);assert.equal(playerPowerView(s).warning,'');
 assert.equal(playerPowerView({...s,link3Growth:2}).warning,'');assert.match(playerPowerDetailsHtml(s),/成長する火は未装備/);
});
test('Grow explanation matches actual vertical3,4,5+ replacement before growth, including rank2',()=>{
 for(const count of [3,4,5,6])for(const rank of [1,2] as const){
  const s=initial();const boxes:Box[]=Array.from({length:count-1},(_,i)=>({id:`p${i}`,row:7-i,col:0,owner:'player',type:'normal',status:'normal'}));
  const start:BattleState={...s,boxes,link3Growth:4,build:{...s.build!,fixed:createSkill('grow-fire',rank),power:{3:3,4:20,5:40}}};const view=playerPowerView(start),result=applyAction(start,{type:'drop',candidateId:'ceiling:0:0'});
  const attack=result.resolution!.events.find(event=>event.type==='attack'&&event.axis==='vertical');assert.equal(attack?.type==='attack'&&attack.damage,view.grow!.damage);assert.equal(result.state.link3Growth,4+view.grow!.growthPerActivation);
  assert.match(playerPowerDetailsHtml(start),/通常の4連・5\+連火力への上乗せではありません/);assert.match(playerPowerDetailsHtml(start),/次の攻撃から反映/);
 }
});
test('player HUD mounts once and updates facts on repeated renders',()=>{
 let meter:{className:string;innerHTML:string;title:string;setAttribute:(key:string,value:string)=>void}|null=null,appends=0;
 const host={querySelector:()=>meter,ownerDocument:{createElement:()=>({className:'',innerHTML:'',title:'',setAttribute(){}})},append:(value:typeof meter)=>{meter=value;appends++;}};
 renderPlayerPower(host as unknown as HTMLElement,initial());renderPlayerPower(host as unknown as HTMLElement,{...initial(),link3Growth:9});
 assert.equal(appends,1);assert.match((meter as unknown as {innerHTML:string}).innerHTML,/火\+9/);
});
