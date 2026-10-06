import test from 'node:test';import assert from 'node:assert/strict';
import {defaultConfig,createBattle,createSkill} from '../src/next/core/index.ts';
import {resolveActiveDrop} from '../src/next/core/activeDrop.ts';
import {foundationBox,foundationBonus} from '../src/next/core/foundation.ts';
import {playerPowerView} from '../src/next/ui/playerPower.ts';
import {boxTypeRows} from '../src/next/ui/boxTypeInformation.ts';
import {skillMiniArt} from '../src/next/ui/skillHud.ts';
import {rewardCardView,rewardCardBody} from '../src/next/ui/rewardPresentation.ts';
import {BattleController} from '../src/next/app/BattleController.ts';
import type {Box,BattleState} from '../src/next/core/types.ts';
const box=(row:number,col:number,owner:Box['owner']='player',type:Box['type']='normal'):Box=>({id:`${row}:${col}`,row,col,owner,type,status:'normal'});
const state=(rank:1|2,boxes:Box[]=[])=>createBattle({...defaultConfig,characterId:'blue',initialBoxes:boxes,initialBuild:{fixed:createSkill('health'),slots:[createSkill('foundation',rank),null],power:{3:0,4:0,5:0}}});
test('foundation HUD matches actual 3/4/5 link attacks once at both ranks, including the inserted bottom box',()=>{
 for(const rank of [1,2] as const)for(const count of [3,4,5] as const){const s=state(rank,Array.from({length:count-1},(_,i)=>box(7,i))),landing={row:7,col:count-1};const r=resolveActiveDrop(s,{id:'test',available:true,landing,spawn:landing,edge:{...landing,side:'top'},segmentEndRow:7,path:[landing]});const attack=r.events.find(e=>e.type==='attack');assert(attack?.type==='attack');assert.equal(attack.damage,s.config.combatants.player.attacks[count]+count*rank);assert.equal(playerPowerView(r.state).tiers.find(t=>t.tier===count)!.current,attack.damage);}
});
test('derived firepower status follows bottom own boxes of every type and never edits saved owner/type/status',()=>{
 const boxes=[box(7,0),box(7,1,'player','frozen'),box(7,2,'player','shiny'),box(7,3,'player','thorn'),box(7,4,'enemy'),box(7,5,'neutral'),box(6,0)];const s=state(2,boxes),raw=JSON.stringify(s);assert.equal(foundationBonus(s),8);
 for(const b of boxes){const on=b.owner==='player'&&b.row===7;assert.equal(foundationBox(s,b),on);assert.equal(boxTypeRows(b,s).some(r=>r.label==='状態'&&r.text==='火力アップ'),on);}
 assert.equal(JSON.stringify(s),raw);const removed={...s,boxes:s.boxes.slice(1)};assert(!foundationBox(removed,boxes[0]!));assert.equal(foundationBonus(removed),6);const converted={...s,boxes:s.boxes.map(b=>({...b,owner:'enemy' as const}))};assert.equal(foundationBonus(converted),0);assert(!foundationBox(converted,boxes[0]!));const noSkill:BattleState={...s,build:{...s.build!,slots:[null,null]}};assert.equal(foundationBonus(noSkill),0);assert(!foundationBox(noSkill,boxes[0]!));
});
test('resume derives the same status and power, and skill card/mini art share the muscle mark',()=>{const s=state(1,[box(7,0)]),c=new BattleController(s.config,{render(){},async animate(){}}),restored=BattleController.restore(c.exportCheckpoint(),{render(){},async animate(){}});assert.deepEqual(playerPowerView(restored.snapshot),playerPowerView(c.snapshot));assert(foundationBox(restored.snapshot,restored.snapshot.boxes[0]!));const mini=skillMiniArt('foundation');assert.match(mini,/<path /);assert.doesNotMatch(mini,/💪|<text/);assert(rewardCardBody(rewardCardView(s,'foundation',true,1),false,'','').includes(mini));});
