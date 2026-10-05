import assert from 'node:assert/strict';
import {createProfile,freezeRunMeta} from '../../src/next/meta/profile.ts';
import {prepareDeparture} from '../../src/next/meta/departure.ts';
import {LEGACY_KIT_BALANCE,amberPowerCandidate} from '../../src/next/meta/kitBalance.ts';
import {createBattle,applyAction} from '../../src/next/core/index.ts';
import type {KitBalanceSnapshot} from '../../src/next/meta/kitBalance.ts';
import type {RosterId} from '../../src/next/meta/roster.ts';
/** Synthetic ability comparison, not a natural-run win-rate measurement. */
function example(character:RosterId,balance:KitBalanceSnapshot,activate:boolean){
 const p=createProfile(1);if(!p.ownedCharacters.includes(character))p.ownedCharacters.push(character);
 const base=prepareDeparture({...freezeRunMeta(p,character,false),kitBalance:balance},23).config;
 let state=createBattle({...base,initialGauge:100,initialBoxes:[0,1].map(col=>({id:`base:${col}`,row:7,col,owner:'player' as const,type:'normal' as const,status:'normal' as const})),combatants:{...base.combatants,enemy:{...base.combatants.enemy,maxHp:1000,initialHp:1000}}});
 const trace=[];
 for(const action of [...(activate?[{type:'transform'} as const]:[]),{type:'drop',candidateId:'ceiling:2:0'} as const,{type:'enemy'} as const,{type:'drop',candidateId:'ceiling:3:0'} as const]){
  const next=applyAction(state,action);assert(next.accepted);trace.push({action,events:next.resolution!.events});state=next.state;
 }
 const attacks=trace.flatMap(t=>t.events).filter(e=>e.type==='attack'&&e.actor==='player'),damage=attacks.reduce((sum,e)=>sum+Math.max(0,Math.max(0,e.hpBefore)-Math.max(0,e.hpAfter)),0);
 return {character,activated:activate,mode:balance.amber.mode,ownTurns:balance.amber.ownTurns,linkDamage:attacks.map(e=>e.damage),totalActualDamage:damage,endingGauge:state.gauge,remainingForm:state.transformation,endingPlayerHp:state.hp.player.current,trace};
}
const results={amberNoForm:example('amber',LEGACY_KIT_BALANCE,false),amberGaugeBaseline:example('amber',LEGACY_KIT_BALANCE,true),amberPowerOne:example('amber',amberPowerCandidate(1),true),amberPowerTwo:example('amber',amberPowerCandidate(2),true),roseExistingForm:example('rose',LEGACY_KIT_BALANCE,true)};
assert.deepEqual(results.amberNoForm.linkDamage,[6,9]);assert.deepEqual(results.amberGaugeBaseline.linkDamage,[6,9]);assert.deepEqual(results.amberPowerOne.linkDamage,[12,9]);assert.deepEqual(results.amberPowerTwo.linkDamage,[12,18]);assert.deepEqual(results.roseExistingForm.linkDamage,[19,8]);
assert.equal(results.amberGaugeBaseline.endingGauge,10);assert.equal(results.amberNoForm.endingGauge,108);assert.equal(results.amberPowerOne.endingGauge,8);assert.equal(results.amberPowerTwo.endingGauge,8);
console.log(JSON.stringify({kind:'controlled-mechanics-example',sourceBase:'b02d76dc106aeb4d0b365d3d1f37132a27f1e3cb',notes:['Synthetic charged fixture with2 existing own boxes and1000 enemyHP; not natural stage1 or a win-rate result','Two ordinary own drops with one real seeded enemy insertion between them','All candidates keep form cost100/cap150; only Amber mode/duration varies','No shape, shiny, frozen, poison or direct damage in this case; those exclusions have separate regressions','Rose is an existing specialist reference, not a controlled same-character balance verdict'],results},null,2));
