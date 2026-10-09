import test from 'node:test';
import assert from 'node:assert/strict';
import {createProfile,freezeRunMeta,migrateProfile,validateProfile,eligibleSkills} from '../src/next/meta/profile.ts';
import {prepareDeparture} from '../src/next/meta/departure.ts';
import {characterBoardChoices} from '../src/next/meta/kits.ts';
import {resolveActiveDrop} from '../src/next/core/activeDrop.ts';
import {getDropOptions} from '../src/next/core/board.ts';
import {createBattle,applyAction} from '../src/next/core/battle.ts';
import {canReceiveSkillReward,createSkill,validatePlayerBuild} from '../src/next/core/playerBuild.ts';
import {completePlayerTurn,carryTransformationState} from '../src/next/core/transformations.ts';
import {assignBoxType,resolvePoisonTurnEnd,resolveThornInsertion} from '../src/next/core/boxTypes.ts';
import {resolveEnemySequence} from '../src/next/core/enemySequence.ts';
import {kitBoardDefinition,kitBoardTargets,canUseKitBoard,resolveKitBoard} from '../src/next/core/kitBoards.ts';
import {sampleUniformIndex} from '../src/next/core/random.ts';
import {BattleController} from '../src/next/app/BattleController.ts';
import {encodeSave,decodeSave,CHARACTER_SAVE_RULES} from '../src/next/app/saveCheckpoint.ts';
import {createBattleAnimator,VANISH_MS} from '../src/next/ui/battleAnimator.ts';
import type {BattleAnimationHooks} from '../src/next/ui/battleAnimator.ts';
import {boardSkillName,currentBoardInformation,currentFormInformation,formInformation} from '../src/next/ui/kitInformation.ts';
import type {BattleConfig,BattleState,Box,BoardSkillId} from '../src/next/core/types.ts';
import type {RosterId} from '../src/next/meta/roster.ts';
const box=(row:number,col:number,owner:Box['owner']='player',type:Box['type']='normal'):Box=>({id:row+':'+col,row,col,owner,type,status:'normal'});
function config(id:RosterId,board?:BoardSkillId,legacy=false):BattleConfig{
 const p=createProfile(1);p.ownedCharacters=['blue','red','mint','amber','violet','silver','rose','imashiru'];
 p.characters[id].xp=2000;p.characters[id].tree.board=2;if(board)p.characters[id].board=board;
 const meta=freezeRunMeta(p,id,false);if(legacy)delete meta.characterRevision;
 const c=prepareDeparture(meta,17).config;
 return {...c,board:{width:8,height:8,gravity:'down',terrain:[],invalidCells:[]},initialBoxes:[],combatants:{...c.combatants,enemy:{maxHp:10000,initialHp:10000,attacks:{3:5,4:9,5:12}}},enemyId:undefined,enemyPattern:[{type:'heal',amount:0}]};
}
function drop(s:BattleState,success=true){const r=applyAction({...s,actor:'player',boxes:success?[box(6,0),box(7,0)]:[]},{type:'drop',candidateId:'ceiling:1:0'});assert(r.accepted);return r;}
function roundtrip(c:BattleConfig,s:BattleState){const controller=new BattleController(c,{render(){},async animate(){}});return decodeSave(encodeSave({...controller.exportCheckpoint(),state:{...s,actor:'player'}},1));}
test('revision: new Mint stats, exclusive fixed skills and preserved other character stats',()=>{
 const c=config('mint'),s=createBattle(c);assert.equal(c.combatants.player.maxHp,35);assert.deepEqual(c.combatants.player.attacks,{3:3,4:4,5:7});
 assert.equal(s.build!.fixed.id,'combo-unit');assert.equal(createBattle(config('violet')).build!.fixed.id,'death-arrow');
 assert.deepEqual(config('violet').combatants.player.attacks,{3:1,4:2,5:3});assert.equal(config('violet').combatants.player.maxHp,28);
 for(const id of ['combo-unit','death-arrow'] as const){assert(!eligibleSkills(createProfile(1),'blue').includes(id));assert(!canReceiveSkillReward(s.build!,id));assert.throws(()=>createSkill(id,2));}
 assert.throws(()=>validatePlayerBuild({...s.build!,slots:[createSkill('death-arrow'),null]},c));
});
test('revision: combo uses current four power and awards exactly on 3/6/9 own turns, with save and stage carry',()=>{
 const c=config('mint');let s=createBattle(c);
 for(let turn=1;turn<=9;turn++){
  const prior=s.build!.power[4],r=drop(s);const hit=r.resolution!.events.find(e=>e.type==='damage'&&e.source==='combo-unit');
  assert(hit?.type==='damage');assert.equal(hit.damage,4+prior);s=r.state;
  assert.equal(s.comboStreak,turn);assert.equal(s.build!.power[4],Math.floor(turn/3));
  if(turn===2){const saved=roundtrip(c,s);assert.equal(saved.rules,CHARACTER_SAVE_RULES);s=saved.checkpoint.state;}
  if(turn===4){s=carryTransformationState(createBattle(c),s);assert.equal(s.comboStreak,4);assert.equal(s.build!.power[4],1);}
 }
 s=drop(s,false).state;assert.equal(s.comboStreak,0);assert.equal(s.build!.power[4],3);
 for(let i=1;i<=3;i++){s=drop(s).state;assert.equal(s.build!.power[4],i===3?4:3);}
});
test('revision: all Mint boards spend one action, interrupt combo and do not trigger shape/link/thorn damage',()=>{
 for(const id of ['mint-observe','mint-diagonal','mint-frame'] as const){
  const c=config('mint',id);let s=createBattle({...c,initialGauge:300});s={...s,comboStreak:2,build:{...s.build!,power:{3:0,4:2,5:0}},boxes:[...Array.from({length:6},(_,col)=>box(7,col)),box(6,0,'enemy','thorn')]};
  const r=applyAction(s,{type:'board-skill',skillId:id,target:{row:0,col:0}});
  assert(r.accepted,id);assert.equal(r.state.actor,'enemy');assert.equal(r.state.comboStreak,0);assert.equal(r.state.build!.power[4],2);assert.deepEqual(r.state.hp,s.hp);
  assert(!r.resolution!.events.some(e=>['attack','damage','type-damage','power-boost'].includes(e.type)));
  const drops=r.resolution!.events.filter(e=>e.type==='drop');if(id!=='mint-frame'){assert.equal(drops.length,id==='mint-observe'?3:2);assert.equal(new Set(drops.map(e=>e.candidateId)).size,drops.length);assert(drops.every(e=>e.box.type===(id==='mint-diagonal'?'shiny':'normal')));}
  assert.equal(r.state.gauge,300-kitBoardDefinition(c,id)!.gauge+1);
 }
});
test('revision: comet uses a seeded random playable center and Manhattan radius two, at most 13 boxes',()=>{
 const c=config('mint','mint-frame'),all=Array.from({length:64},(_,n)=>box(Math.floor(n/8),n%8,n%2?'player':'enemy'));
 const s=createBattle({...c,initialBoxes:all,initialGauge:100});const roll=sampleUniformIndex(s.rngState,64),center={row:Math.floor(roll.index/8),col:roll.index%8};
 const expected=all.filter(b=>Math.abs(b.row-center.row)+Math.abs(b.col-center.col)<=2).map(b=>b.id);
 const r=resolveKitBoard(s,'mint-frame',{row:0,col:0});const event=r.events.find(e=>e.type==='kit-board-changed');assert(event?.type==='kit-board-changed');assert.deepEqual(event.boxIds,expected);assert(expected.length<=13);
});
test('revision: Revelation costs 300, lasts seven own turns and does not repaint existing boxes',()=>{
 const c=config('mint');let s=createBattle({...c,initialGauge:300,initialBoxes:[box(7,7)]});
 s=applyAction(s,{type:'transform'}).state;assert.equal(s.gauge,0);assert.equal(s.boxes[0]!.type,'normal');
 for(let i=1;i<=7;i++){const r=applyAction({...s,actor:'player',boxes:[]},{type:'drop',candidateId:'ceiling:1:0'});assert(r.accepted);assert.equal(r.resolution!.events.find(e=>e.type==='drop')!.box.type,'shiny');s=r.state;if(i===3)s=roundtrip(c,s).checkpoint.state;}
 assert.equal(s.transformation,null);const next=drop(s,false);assert.equal(next.resolution!.events.find(e=>e.type==='drop')!.box.type,'normal');
 const b=config('mint','mint-observe');const shining={...createBattle({...b,initialGauge:300}),transformation:{character:'mint' as const,scope:'stage' as const,remainingOwnTurns:7}};
 assert(resolveKitBoard(shining,'mint-observe',{row:0,col:0}).events.filter(e=>e.type==='drop').every(e=>e.box.type==='shiny'));
});
test('revision: Death Arrow handles all four axes and never reduces five-link power',()=>{
 for(const axis of ['horizontal','vertical','diagonal-down','diagonal-up']){
  const cells=axis==='horizontal'?[box(7,0),box(7,1),box(7,2)]:axis==='vertical'?[box(5,3),box(6,3),box(7,3)]:axis==='diagonal-down'?[box(4,0),box(5,1),box(6,2)]:[box(7,0),box(6,1),box(5,2),box(5,3,'neutral'),box(6,3,'neutral'),box(7,3,'neutral')];
  const col=axis==='vertical'?3:3;
  const r=applyAction(createBattle({...config('violet'),initialBoxes:[...cells,box(7,7,'enemy')]}),{type:'drop',candidateId:'ceiling:'+col+':0'});
  assert(r.accepted);assert(r.resolution!.events.some(e=>e.type==='attack'&&e.skillId==='death-arrow'&&e.axis===axis),axis);assert(r.state.boxes.some(b=>b.owner==='enemy'&&b.type==='deadly-poison'));
 }
 const r=applyAction(createBattle({...config('violet'),initialBoxes:[box(7,0),box(7,1),box(7,2),box(7,3),box(7,7,'enemy')]}),{type:'drop',candidateId:'ceiling:4:0'});
 assert.equal(r.resolution!.events.find(e=>e.type==='attack')!.damage,3);
});
test('revision: Violet immunity starts immediately, covers poison/thorns/fixed/link damage and expires after enemy turn',()=>{
 const c=config('violet');let s=createBattle({...c,initialGauge:80,initialBoxes:[box(7,7,'enemy'),box(7,0,'player','poison'),box(6,0,'enemy','thorn')]});
 s=applyAction(s,{type:'transform'}).state;assert.equal(s.gauge,0);assert.equal(s.boxes.find(b=>b.id==='7:7')!.type,'poison');const hp=s.hp.player.current;
 assert.equal(resolvePoisonTurnEnd(s,'player').state.hp.player.current,hp);
 assert.equal(resolveThornInsertion(s,box(6,1)).state.hp.player.current,hp);
 assert.equal(resolveEnemySequence({...s,actor:'enemy'},{type:'sequence',steps:[{type:'fixed-damage',amount:999}]}).state.hp.player.current,hp);
 s=completePlayerTurn(s).state;assert.equal(s.transformation?.character,'violet');
 const enemy=applyAction({...s,actor:'enemy'},{type:'enemy'});assert(enemy.accepted);assert.equal(enemy.state.hp.player.current,hp);assert.equal(enemy.state.transformation,null);
 assert.equal(resolvePoisonTurnEnd(enemy.state,'player').state.hp.player.current,hp-1);
});
test('revision: Violet refuses transformation when every enemy is already poisoned, without RNG or gauge change',()=>{
 const s=createBattle({...config('violet'),initialGauge:80,initialBoxes:[box(7,0,'enemy','poison'),box(7,1,'enemy','deadly-poison')]});const r=applyAction(s,{type:'transform'});assert(!r.accepted);assert.equal(r.state,s);
});
test('revision: Toxic Erosion snapshots all poison boxes, counts each owner settlement and preserves later poison',()=>{
 const c=config('violet','violet-sting');let s=createBattle({...c,initialGauge:40,initialBoxes:[box(7,0,'enemy','poison'),box(7,1,'player','deadly-poison'),box(7,2,'neutral','poison'),box(7,3,'enemy')]});
 const r=applyAction(s,{type:'board-skill',skillId:'violet-sting',target:{row:0,col:0}});assert(r.accepted);s=r.state;
 assert.equal(s.boxes[0]!.poisonCountdown,2);assert.equal(s.boxes[1]!.poisonCountdown,1);assert.equal(s.boxes[2]!.poisonCountdown,2);
 s={...s,boxes:s.boxes.map(b=>b.id==='7:3'?assignBoxType(b,'poison','player'):b)};
 s=resolvePoisonTurnEnd(s,'enemy').state;assert.equal(s.boxes.find(b=>b.id==='7:0')!.poisonCountdown,1);
 s=roundtrip(c,s).checkpoint.state;const next=resolvePoisonTurnEnd(s,'enemy');assert.equal(next.events[0]!.type,'type-damage');assert(next.events.some(e=>e.type==='poison-vanished'&&e.boxIds.includes('7:0')));assert(!next.state.boxes.some(b=>b.id==='7:0'));assert(next.state.boxes.some(b=>b.id==='7:3'));assert(next.state.boxes.some(b=>b.id==='7:2'));
 assert.equal(assignBoxType(s.boxes.find(b=>b.id==='7:1')!,'normal').poisonCountdown,undefined);
});
test('revision: Toxic Erosion uses existing marked/fading Vanish after poison damage',async()=>{
 const c=config('violet','violet-sting');const before:BattleState={...createBattle(c),actor:'enemy',boxes:[{...box(7,0,'enemy','poison'),poisonCountdown:1}]};
 const step=resolvePoisonTurnEnd(before,'enemy'),log:string[]=[];let shown:readonly Box[]=before.boxes;
 const hooks:BattleAnimationHooks={motion:()=>({short:false,lowMotion:false}),playSound(){},describe(){},observe(e){log.push(e.type);},highlight(){},drop(){},react(){},feedback:()=>({remove(){}}),transform:async()=>{},complete(){},render(s){shown=s.boxes;},vanish(ids,phase,ms){if(ids.length){assert(shown.some(b=>b.id===ids[0]));log.push(phase+':'+ms);}},pause:async()=>{}};
 await createBattleAnimator(hooks)({actor:'enemy',originBoxId:null,links:[],enemyPlannedAction:'heal',events:step.events},before,step.state,new AbortController().signal);
 assert(log.indexOf('type-damage')<log.indexOf('marked:0'));assert(log.includes('fading:'+VANISH_MS.full));assert.equal(shown.length,0);
});
test('revision: legacy departures and saved runs retain old starters, stats, forms and boards',()=>{
 for(const id of ['mint','violet'] as const){const c=config(id,undefined,true),s=createBattle(c);assert.equal(s.build!.fixed.id,id==='mint'?'corner-strike':'poison-craft');assert.equal(roundtrip(c,s).checkpoint.initialConfig.meta!.characterRevision,undefined);if(id==='mint'){assert.equal(s.hp.player.max,32);assert.equal(kitBoardDefinition(c,'mint-observe')!.name,'一点観測');}assert.match(formInformation(c),id==='mint'?/全点観測/:/毒の雨/);}
});
test('revision: Violet board ordering and old profile migration preserve progress and currency',()=>{
 assert.deepEqual(characterBoardChoices('violet',true),['violet-poison','violet-sting','violet-venom']);
 const p=createProfile(5);delete p.characterRevision;p.characters.violet.xp=2000;p.characters.violet.tree.board=1;p.characters.violet.board='violet-venom';p.coins=123;validateProfile(p);
 const n=migrateProfile(p);assert.equal(n.characters.violet.board,'violet-sting');assert.equal(n.coins,123);assert.equal(n.characters.violet.xp,2000);assert.equal(p.characters.violet.board,'violet-venom');
 const c=config('violet','violet-venom'),s=createBattle({...c,initialGauge:150,initialBoxes:[box(7,0,'enemy','poison')]});const r=resolveKitBoard(s,'violet-venom',{row:7,col:0});assert.equal(r.state.boxes[0]!.type,'deadly-poison');
});
test('revision: descriptions and deterministic seeded board outcomes reflect actual mechanics',()=>{
 assert.equal(boardSkillName('mint-observe'),'空からの恵み');assert.match(currentBoardInformation('mint-diagonal'),/77/);assert.match(currentBoardInformation('mint-frame'),/13マス/);assert.match(currentFormInformation('mint'),/300/);assert.match(currentFormInformation('violet'),/80/);
 const s=createBattle({...config('mint','mint-observe'),initialGauge:100});assert.deepEqual(resolveKitBoard(s,'mint-observe',{row:0,col:0}),resolveKitBoard(s,'mint-observe',{row:0,col:0}));assert(canUseKitBoard(s,'mint-observe'));
});

test('revision: guard blocks real enemy links and full-board loss in ordinary and sequence paths',()=>{
 const c=config('violet'),base:BattleState={...createBattle(c),actor:'enemy',transformation:{character:'violet',scope:'turn'},boxes:[box(7,0,'enemy'),box(7,1,'enemy'),box(7,2,'enemy')]};
 const link=resolveActiveDrop(base,getDropOptions(base).find(o=>o.id==='ceiling:3:0')!);const attack=link.events.find(e=>e.type==='attack');assert(attack?.type==='attack');assert.equal(attack.damage,0);assert.equal(link.state.hp.player.current,base.hp.player.current);
 const full={...base,boxes:Array.from({length:64},(_,n)=>box(Math.floor(n/8),n%8,'enemy')),config:{...c,enemyPattern:[{type:'drop' as const}]}};
 const ordinary=applyAction(full,{type:'enemy'});assert(ordinary.accepted);assert.equal(ordinary.state.result,null);assert.equal(ordinary.state.hp.player.current,base.hp.player.current);assert.equal(ordinary.state.transformation,null);
 const sequence=resolveEnemySequence(full,{type:'sequence',steps:[{type:'drop'}]});assert.equal(sequence.state.hp.player.current,base.hp.player.current);assert(!sequence.events.some(e=>e.type==='instant-kill'));
});
test('revision: interrupted combo needs three new successes after every board, and poison overwrite cancels countdown',()=>{
 for(const id of ['mint-observe','mint-diagonal','mint-frame'] as const){
  let s=createBattle({...config('mint',id),initialGauge:300});s={...s,comboStreak:2,boxes:[box(7,0)]};
  s=applyAction(s,{type:'board-skill',skillId:id,target:{row:0,col:0}}).state;
  for(let i=1;i<=3;i++){s=drop(s).state;assert.equal(s.build!.power[4],i===3?1:0);}
 }
 const marked={...box(7,0,'enemy','poison'),poisonCountdown:1 as const};
 assert.equal(assignBoxType(marked,'frozen').poisonCountdown,undefined);
 assert.equal(assignBoxType(marked,'deadly-poison','player').poisonCountdown,1);
});
test('revision: Vanish keeps targets visible when an earlier poison conversion event exists',async()=>{
 const c=config('violet'),before:BattleState={...createBattle(c),boxes:[{...box(7,0,'player','poison'),poisonCountdown:1},box(7,1,'enemy')]};
 const step=resolvePoisonTurnEnd(before,'player'),after={...step.state,boxes:step.state.boxes.map(b=>assignBoxType(b,'deadly-poison','player'))};
 let shown=before.boxes,faded=false;
 const hooks:BattleAnimationHooks={motion:()=>({short:true,lowMotion:false}),playSound(){},describe(){},observe(){},highlight(){},drop(){},react(){},feedback:()=>({remove(){}}),transform:async()=>{},complete(){},render(s){shown=s.boxes;},vanish(_ids,phase){if(phase==='fading'){assert(shown.some(b=>b.id==='7:0'));faded=true;}},pause:async()=>{}};
 await createBattleAnimator(hooks)({actor:'player',originBoxId:null,links:[],enemyPlannedAction:null,events:[{type:'kit-board-changed',boxIds:['7:1']},...step.events]},before,after,new AbortController().signal);assert(faded);assert(!shown.some(b=>b.id==='7:0'));
});

// Verify random board previews never advertise a clicked box or consume game state.
test('revision: random Mint boards have no target highlights and previews preserve state',()=>{
 for(const id of ['mint-observe','mint-diagonal','mint-frame'] as const){
  const s=createBattle({...config('mint',id),initialGauge:300,initialBoxes:[box(0,0),box(7,7,'enemy')]}),before=structuredClone(s);
  for(const target of [{row:0,col:0},{row:7,col:7},{row:4,col:4}])assert.deepEqual(kitBoardTargets(s,id,target),[],id);
  assert.deepEqual(s,before);assert(canUseKitBoard(s,id));
 }
});

// Verify poison previews match every affected box regardless of owner or clicked cell.
test('revision: Toxic Erosion highlights all poison boxes independently of the anchor',()=>{
 const boxes=[box(0,0),box(7,0,'enemy','poison'),box(7,1,'player','deadly-poison'),box(7,2,'neutral','poison'),{...box(7,3,'enemy','deadly-poison'),poisonCountdown:1 as const},box(7,4,'enemy','frozen')];
 const s=createBattle({...config('violet','violet-sting'),initialGauge:40,initialBoxes:boxes}),before=structuredClone(s),expected=boxes.slice(1,5);
 for(const target of [{row:0,col:0},{row:7,col:0},{row:4,col:4},{row:-1,col:99,orientation:99}])assert.deepEqual(kitBoardTargets(s,'violet-sting',target),expected);
 assert.deepEqual(s,before);
 const result=resolveKitBoard(s,'violet-sting',{row:0,col:0}),event=result.events.find(e=>e.type==='kit-board-changed');
 assert(event?.type==='kit-board-changed');assert.deepEqual(event.boxIds,expected.map(b=>b.id));
});

// Verify unavailable global boards cannot expose misleading target highlights.
test('revision: Toxic Erosion has no highlights when unavailable or unequipped',()=>{
 const s=createBattle({...config('violet','violet-sting'),initialGauge:40,initialBoxes:[box(0,0,'enemy','poison')]});
 assert.deepEqual(kitBoardTargets({...s,gauge:39},'violet-sting',{row:0,col:0}),[]);
 assert.deepEqual(kitBoardTargets({...s,boxes:[box(0,0)]},'violet-sting',{row:0,col:0}),[]);
 for(const meta of [{...s.config.meta!,board:'violet-poison' as const},{...s.config.meta!,kitVersion:undefined}])assert.deepEqual(kitBoardTargets({...s,config:{...s.config,meta}},'violet-sting',{row:0,col:0}),[]);
});

// Verify saved legacy shapes and current single-box boards keep their target selection.
test('revision: target highlighting preserves legacy patterns and targeted Violet boards',()=>{
 const legacyCases:[BoardSkillId,Box[]][]=[['mint-observe',[box(0,0),box(1,0),box(1,1)]],['mint-diagonal',[box(0,0),box(1,1),box(2,2)]],['mint-frame',[box(0,0),box(0,1),box(1,0),box(1,1)]],['violet-sting',[box(0,0,'enemy'),box(0,1,'enemy')]]];
 for(const [id,boxes] of legacyCases){const s=createBattle({...config(id==='violet-sting'?'violet':'mint',id,true),initialGauge:100,initialBoxes:boxes});assert.deepEqual(kitBoardTargets(s,id,{row:0,col:0}),boxes,id);assert.deepEqual(kitBoardTargets(s,id,{row:4,col:4}),[],id);}
 for(const id of ['violet-poison','violet-venom'] as const){const boxes=[box(0,0,'enemy',id==='violet-poison'?'normal':'poison'),box(0,1,'player')],s=createBattle({...config('violet',id),initialGauge:150,initialBoxes:boxes});assert.deepEqual(kitBoardTargets(s,id,{row:0,col:0}),[boxes[0]]);assert.deepEqual(kitBoardTargets(s,id,{row:0,col:1}),[]);}
});
