import test from 'node:test';
import assert from 'node:assert/strict';
import {forecastAction,forecastPrimary,forecastSecondary,forecastDetailsHtml} from '../src/next/ui/actionForecast.ts';
import type {ForecastAction} from '../src/next/ui/actionForecast.ts';
import {readabilityReviewFixture} from '../src/next/ui/readabilityReviewFixture.ts';
import {applyAction,createBattle} from '../src/next/core/index.ts';
import {trialFixture} from '../src/next/config.ts';
import type {BattleState,Box} from '../src/next/core/types.ts';
import {saveNamespace} from '../src/next/app/localSave.ts';
import {presentationSettingsKey} from '../src/next/audio/presentationSettings.ts';
const drop={type:'drop',candidateId:'ceiling:1:0'} as const;
function health(hp=30,enemy=60,active=true):BattleState{
 const c=readabilityReviewFixture('health').config;
 const s=createBattle({...c,combatants:{...c.combatants,player:{...c.combatants.player,initialHp:hp},enemy:{...c.combatants.enemy,initialHp:enemy}}});
 return active?applyAction(s,{type:'transform'}).state:s;
}
const box=(row:number,col:number,owner:Box['owner']='player'):Box=>({id:`p:${row}:${col}`,row,col,owner,type:'normal',status:'normal'});
test('full HP Blue forecast separates zero actual healing, nominal healing and reflection included once',()=>{
 const s=health(),view=forecastAction(s,drop)!;
 assert.deepEqual(view,{enemyLoss:19,selfLoss:0,healed:0,nominalHeal:15,damage:19,reflection:15,overkill:0,result:null});
 assert.match(forecastPrimary(view),/敵HP −19 \/ 回復 ＋0/);assert.match(forecastSecondary(view),/回復予定15 · 反射ダメ15/);
 assert.match(forecastDetailsHtml(view),/攻撃の合計 19（うち青の反射 15）/);
});
test('limited and uncapped healing show true recovered HP without changing nominal reflection',()=>{
 for(const [hp,healed] of [[27,3],[10,15]]){const v=forecastAction(health(hp),drop)!;assert.equal(v.healed,healed);assert.equal(v.nominalHeal,15);assert.equal(v.reflection,15);assert.equal(v.damage,19);}
 const normal=forecastAction(health(27,60,false),drop)!;assert.equal(normal.healed,3);assert.equal(normal.reflection,0);assert.equal(normal.enemyLoss,4);
});
test('overkill following shape reflection remains attack total19 but actual enemy HP loss10',()=>{
 const v=forecastAction(health(30,10),drop)!;assert.equal(v.enemyLoss,10);assert.equal(v.damage,19);assert.equal(v.reflection,15);assert.equal(v.overkill,9);assert.equal(v.result,'win');assert.match(forecastPrimary(v),/敵HP −10/);assert.match(forecastSecondary(v),/超過9/);
});
test('repeated previews leave original state, build, RNG and resolution exactly equal to real input',()=>{
 for(const s of [health(),health(27),health(30,10)]){
  const original=JSON.stringify(s),committed=applyAction(s,drop);
  for(let i=0;i<20;i++)forecastAction(s,drop);
  assert.equal(JSON.stringify(s),original);assert.deepEqual(applyAction(s,drop),committed);assert.equal(committed.state.actor,committed.state.result?'player':'enemy');assert.equal(committed.state.enemyTurnCount,s.enemyTurnCount);
 }
});
test('row-clear simultaneous KO reports both bounded losses and loss, no next enemy simulation',()=>{
 const c=readabilityReviewFixture('health').config,s=createBattle({...c,initialBoxes:[box(7,0),box(7,1,'enemy')],combatants:{...c.combatants,player:{...c.combatants.player,initialHp:1},enemy:{...c.combatants.enemy,initialHp:1}}});
 const v=forecastAction(s,{type:'board-skill',skillId:'pain-shared',row:7})!;
 assert.equal(v.enemyLoss,1);assert.equal(v.selfLoss,1);assert.equal(v.result,'loss');assert.match(forecastPrimary(v),/敵HP −1 \/ 自HP −1 \/ 敗北/);
});
test('Ember random conversion predicts self cost but cannot consume original RNG',()=>{
 const c=trialFixture('normal','red','marujiro',8,'manual'),s=createBattle({...c,initialBoxes:[box(7,0,'enemy'),box(7,1,'enemy'),box(7,2,'enemy'),box(7,3,'enemy')]});
 const before=JSON.stringify(s),action={type:'board-skill',skillId:'ember'} as const,expected=applyAction(s,action);
 assert.notEqual(expected.state.rngState,s.rngState);assert.equal(forecastAction(s,action)!.selfLoss,3);assert.equal(forecastAction(s,action)!.enemyLoss,0);assert.equal(JSON.stringify(s),before);assert.deepEqual(applyAction(s,action),expected);
});
test('Potion and Bullet previews do not consume use or change equipment',()=>{
 for(const kind of ['consumable-potion','consumable-bullet'] as const){const s=createBattle(readabilityReviewFixture(kind).config),before=JSON.stringify(s),v=forecastAction(s,{type:'instant-skill',slot:1})!;assert.equal(v.healed,kind==='consumable-potion'?5:0);assert.equal(v.enemyLoss,kind==='consumable-bullet'?14:0);assert.equal(JSON.stringify(s),before);assert.equal(s.build!.slots[1]!.uses,1);}
});
test('automatic six-link transforms after healing, so no retroactive reflection is forecast',()=>{
 const c=trialFixture('charged','blue','marujiro',1,'automatic');
 const boxes=[...Array.from({length:5},(_,i)=>box(i+3,1)),...Array.from({length:6},(_,i)=>[box(i+2,0),box(i+2,2)]).flat()];
 const s=createBattle({...c,initialBoxes:boxes});const r=applyAction(s,drop);assert.ok(r.accepted);assert.equal(r.state.transformation?.character,'blue');
 const v=forecastAction(s,drop)!;assert.ok(v.nominalHeal>0);assert.equal(v.reflection,0);assert.equal(v.damage,15);assert.deepEqual(r.resolution!.events.filter(e=>e.type==='attack').map(e=>e.damage),[11,4]);
});
test('enemy/turn-start/transform and invalid player inputs have no forecast',()=>{
 const s=health();for(const type of ['enemy','start-turn','transform'])assert.equal(forecastAction(s,{type} as ForecastAction),null);
 assert.equal(forecastAction({...s,actor:'enemy'},drop),null);assert.equal(forecastAction(s,{type:'drop',candidateId:'invalid'}),null);assert.equal(forecastAction(s,{type:'instant-skill',slot:1}),null);assert.equal(forecastDetailsHtml(null),'');
});
test('night QA has independent save, ownership and presentation keys, and no lookalike collision',()=>{
 const paths=['/next/','/audio-asset-preview/','/night-qa/','/save-preview/','/build-ui-preview/'],names=paths.map(saveNamespace);
 assert.equal(new Set(names.map(x=>x.key)).size,5);assert.equal(new Set(names.map(x=>x.lock)).size,5);assert.equal(new Set(paths.map(presentationSettingsKey)).size,5);
 assert.deepEqual(saveNamespace('/night-qa'),names[2]);assert.deepEqual(saveNamespace('/night-qa-other/'),names[0]);assert.equal(presentationSettingsKey('/night-qa'),presentationSettingsKey('/night-qa/'));
});
