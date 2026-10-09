import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultConfig} from '../src/next/core/definitions.ts';
import {createBattle,applyAction} from '../src/next/core/index.ts';
import {createSkill,acquireSkill,canReceiveSkillReward} from '../src/next/core/playerBuild.ts';
import {normalSkillIds,skillCatalog,skillValue,skillDescription} from '../src/next/core/skillCatalog.ts';
import {normalLinkBonus,normalLinkGuard} from '../src/next/core/normalSkillEffects.ts';
import {resolveActiveDrop} from '../src/next/core/activeDrop.ts';
import {resolveInstantSkill} from '../src/next/core/instantSkills.ts';
import {createTuning,validateTuning} from '../src/next/core/tuning.ts';
import {rewardPool,generateCategoryOffer} from '../src/next/app/rewards.ts';
import {createProfile,validatePool,freezeRunMeta,drawGacha} from '../src/next/meta/profile.ts';
import {BattleController} from '../src/next/app/BattleController.ts';
import {encodeSave,decodeSave} from '../src/next/app/saveCheckpoint.ts';
import type {Box,BattleState,NormalSkillId,Link} from '../src/next/core/types.ts';
const box=(row:number,col:number,owner:Box['owner']='player',type:Box['type']='normal'):Box=>({id:`${row}:${col}`,row,col,owner,type,status:'normal'});
function state(id:NormalSkillId,rank:1|2=1,boxes:Box[]=[]):BattleState {return createBattle({...defaultConfig,characterId:'blue',initialBoxes:boxes,initialBuild:{fixed:createSkill('health'),slots:[createSkill(id,rank),null],power:{3:0,4:0,5:0}}});}
const link=(boxes:Box[],count=3):Link=>({axis:'horizontal',count,tier:count>=5?5:count>=4?4:3,boxIds:boxes.map(b=>b.id)});
test('38 identities, upgrade magnitudes, shared rewards and 20-of-26 pool selection remain coherent',()=>{
 assert.equal(normalSkillIds.length,38);
 for(const id of normalSkillIds.filter(id=>id!=='poison-craft'&&skillCatalog[id].upgradeable!==false)){assert(skillDescription(id,1));assert(skillValue(id,2)>skillValue(id,1));}
 const build=state('full-power').build!;assert.equal(acquireSkill(build,'full-power')!.slots[0]!.rank,2);assert(!canReceiveSkillReward(acquireSkill(build,'full-power')!,'full-power'));
 assert(!rewardPool(build).includes('poison-craft'));assert(rewardPool(build).includes('capacitor'));
 const p=createProfile(123);p.ownedSkills=normalSkillIds.filter(id=>skillCatalog[id].rewardAccess!=='never'&&skillCatalog[id].rewardAccess!=='starter-upgrade-only');p.characters.blue.pool=normalSkillIds.filter(id=>id!=='poison-craft').slice(0,20);validatePool(p,'blue',p.characters.blue.pool);assert.equal(freezeRunMeta(p,'blue',true).pool.length,20);assert.throws(()=>validatePool(p,'blue',normalSkillIds.filter(id=>id!=='poison-craft'&&skillCatalog[id].upgradeable!==false)));
 const offered=generateCategoryOffer(build,4,'x','skills',undefined,['capacitor','solvent','t-strike']);assert.deepEqual(new Set(offered.offer.choices),new Set(['capacitor','solvent','t-strike']));
 for(let seed=1;seed<100;seed++){const q=createProfile(seed);q.coins=100;const d=drawGacha(q);assert(!['health','poison-craft'].includes(d.lastDraw!.item));}
});
test('all seven link conditions are current geometry/HP, and plus rank changes effects',()=>{
 const cells=[box(7,0),box(7,1),box(7,2)],l=link(cells),origin=cells[2]!;
 for(const [id,multiplier] of [['full-power',1],['foundation',3],['edge-strike',1],['last-stand',1],['siege',1],['snake-line',1],['crossfire',1]] as const){
  for(const rank of [1,2] as const){let s=state(id,rank,cells);if(id==='last-stand')s={...s,hp:{...s.hp,player:{...s.hp.player,current:15}}};if(id==='siege')s={...s,boxes:[...s.boxes,box(6,2,'enemy')]};const ln=id==='snake-line'?{...l,count:5,tier:5 as const}:l;assert.equal(normalLinkBonus(s,origin,ln,id==='crossfire'?[ln,{...ln,axis:'vertical'}]:[ln]),skillValue(id,rank)*multiplier,id);}
 }
 assert.equal(normalLinkBonus(state('snake-line',1,cells),origin,l,[l]),0);assert.equal(normalLinkBonus(state('crossfire',1,cells),origin,l,[l]),0);assert.equal(normalLinkBonus(state('siege',1,cells),origin,l,[l]),0);
});
test('five new shapes fire once per origin and preserve passive/no-origin exclusion',()=>{
 for(const id of ['t-strike','zigzag-strike','cup-strike','diamond-strike','cross-strike'] as const){
  const cells=skillCatalog[id].pattern!.cells,origin=cells.at(-1)!,others=cells.slice(0,-1).map(c=>box(c.row,c.col));
  // Direct insertion unit fixture isolates geometry from ceiling route choice.
  const s={...state(id),boxes:others};const r=resolveActiveDrop(s,{id:'shape',available:true,landing:origin,spawn:origin,edge:{...origin,side:'top'},segmentEndRow:origin.row,path:[origin]});
  const hits=r.events.filter(e=>e.type==='damage'&&e.source===id);assert.equal(hits.length,1,id);assert.equal(hits[0]!.type==='damage'&&hits[0]!.damage,skillValue(id,1));
  const shiny={...s,boxes:others.map(b=>({...b,type:'shiny' as const}))};const x=resolveActiveDrop(shiny,{id:'shape',available:true,landing:origin,spawn:origin,edge:{...origin,side:'top'},segmentEndRow:origin.row,path:[origin]});assert.equal(x.events.find(e=>e.type==='damage'&&e.source===id)!.type==='damage'&&(x.events.find(e=>e.type==='damage'&&e.source===id) as {damage:number}).damage,skillValue(id,1)*2);
 }
});
test('iron wall samples square existence, not count, without healing or poison mutation',()=>{
 const square=[box(6,0),box(6,1),box(7,0),box(7,1)];assert.equal(normalLinkGuard(state('iron-wall',2,square)),2);assert.equal(normalLinkGuard(state('iron-wall',2,square.slice(1))),0);
});
test('capacitor clamps and solvent deterministically clears own harmful types only; each opens its slot',()=>{
 const s={...state('capacitor'),gauge:115};const r=resolveInstantSkill(s,0);assert.equal(r.state.gauge,120);assert.equal(r.state.build!.slots[0],null);assert.equal(r.state.hp.player.current,s.hp.player.current);
 const boxes=[box(7,0,'player','poison'),box(7,1,'player','deadly-poison'),box(7,2,'player','frozen'),box(7,3,'enemy','poison'),box(7,4,'player','shiny')];const q=resolveInstantSkill(state('solvent',1,boxes),0);assert.deepEqual(q.state.boxes.map(b=>b.type),['normal','normal','frozen','poison','shiny']);assert.equal(q.state.build!.slots[0],null);const upgraded=resolveInstantSkill(state('solvent',2,boxes),0);assert.equal(upgraded.state.boxes[2]!.type,'normal');
 const action=applyAction(state('capacitor'),{type:'instant-skill',slot:0});assert(action.accepted);assert.equal(action.state.actor,'enemy');assert.equal(action.state.turn,2);
});
test('new snapshots freeze tuning; older snapshots missing new optional values remain valid',()=>{
 const tuning=structuredClone(createTuning());for(const id of ['t-strike','zigzag-strike','cup-strike','diamond-strike','cross-strike','full-power','foundation','snake-line','edge-strike','siege','crossfire','last-stand','iron-wall','capacitor','solvent'])delete (tuning.skills as Record<string,unknown>)[id];validateTuning(tuning);assert.equal(skillValue('full-power',1,tuning),2);
 for(const id of ['full-power','capacitor','t-strike'] as const){const config={...state(id).config,tuning:createTuning({skills:{'full-power':[8,9]}})};const c=new BattleController(config,{render(){},async animate(){}});const save=decodeSave(encodeSave(c.exportCheckpoint(),1)).checkpoint;assert.equal(save.state.build!.slots[0]!.id,id);assert.equal(skillValue('full-power',1,save.state.config.tuning),8);}
});
test('new link bonuses compose before one shiny multiplier and per-box frozen penalty; guards only reduce enemy links',()=>{
 const s=state('full-power',1,[box(7,0,'player','shiny'),box(7,1,'player','frozen')]);
 const r=applyAction(s,{type:'drop',candidateId:'ceiling:2:0'});assert(r.accepted);const hit=r.resolution!.events.find(e=>e.type==='attack')!;assert.equal(hit.type==='attack'&&hit.damage,(4+2)*2-1);
 const guarded=state('iron-wall',2,[box(6,0),box(6,1),box(7,0),box(7,1),box(7,3,'enemy'),box(7,4,'enemy')]);const origin={row:7,col:5};
 const e=resolveActiveDrop({...guarded,actor:'enemy'},{id:'enemy',available:true,landing:origin,spawn:origin,edge:{...origin,side:'top'},segmentEndRow:7,path:[origin]});assert.equal(e.events.find(e=>e.type==='attack')!.type==='attack'&&(e.events.find(e=>e.type==='attack') as {damage:number}).damage,1);
});
