import test from 'node:test';
import assert from 'node:assert/strict';
import {createProfile,availableBoards,freezeRunMeta,migrateProfile,validateProfile,ProfileStore} from '../src/next/meta/profile.ts';
import type {Profile} from '../src/next/meta/profile.ts';
import {BOARD_CATALOG_VERSION,UNLOCK_BOARDS,NATIVE_BOARDS,EXTRA_BOARDS} from '../src/next/meta/kits.ts';
import {CURRENT_BOARD_BALANCE,expandedBoardIds,validateBoardBalance} from '../src/next/meta/kitBalance.ts';
import {prepareDeparture} from '../src/next/meta/departure.ts';
import {rosterIds,roster} from '../src/next/meta/roster.ts';
import type {RosterId} from '../src/next/meta/roster.ts';
import {createBattle,applyAction} from '../src/next/core/index.ts';
import {kitBoardTargets,kitBoardOrientations,canUseKitBoard,resolveKitBoard,kitBoardDefinition,isCharacterBoard} from '../src/next/core/kitBoards.ts';
import {poisonDamageSummary} from '../src/next/core/boxTypes.ts';
import {IMASHIRU} from '../src/next/core/shiny.ts';
import {BattleController} from '../src/next/app/BattleController.ts';
import {encodeSave,decodeSave} from '../src/next/app/saveCheckpoint.ts';
import type {BoardSkillId,Box,BattleConfig} from '../src/next/core/types.ts';
import type {BoardTarget} from '../src/next/core/kitBoards.ts';
const b=(row:number,col:number,owner:Box['owner']='enemy',type:Box['type']='normal',poisonSource?:Box['poisonSource']):Box=>({id:`${row}:${col}`,row,col,owner,type,status:'normal',...(poisonSource?{poisonSource}:{})});
function setup(id:RosterId,board:BoardSkillId){const p=createProfile(7);p.ownedCharacters=[...rosterIds];p.characters[id].xp=100;p.characters[id].tree.board=1;p.characters[id].board=board;return prepareDeparture(freezeRunMeta(p,id,false),23);}
function config(id:RosterId,board:BoardSkillId,boxes:Box[],gauge=100):BattleConfig{return {...setup(id,board).config,initialBoxes:boxes,initialGauge:gauge};}
const cases:{id:RosterId;board:typeof expandedBoardIds[number];boxes:Box[];target:BoardTarget;remove?:true;owner?:Box['owner'];type?:Box['type'];source?:Box['poisonSource']}[]=[
 {id:'blue',board:'blue-crosscut',boxes:[b(3,2),b(4,1,'player'),b(4,2,'neutral'),b(4,3),b(5,2)],target:{row:3,col:2},remove:true},
 {id:'blue',board:'blue-plumb',boxes:[b(3,2),b(4,2,'player'),b(5,2,'neutral')],target:{row:3,col:2},remove:true},
 {id:'red',board:'red-frontline',boxes:[b(7,1,'enemy','shiny'),b(7,2,'enemy','poison','enemy')],target:{row:7,col:1},owner:'player'},
 {id:'red',board:'red-brand',boxes:[b(7,2,'enemy','poison','enemy')],target:{row:7,col:2},owner:'player',type:'thorn'},
 {id:'mint',board:'mint-diagonal',boxes:[b(3,1),b(4,2,'player'),b(5,3,'neutral')],target:{row:3,col:1},remove:true},
 {id:'mint',board:'mint-frame',boxes:[b(6,1),b(6,2,'player'),b(7,1,'neutral'),b(7,2)],target:{row:6,col:1},remove:true},
 {id:'amber',board:'amber-squarepress',boxes:[b(6,1,'enemy','shiny'),b(6,2,'enemy','frozen'),b(7,1,'enemy','poison','enemy'),b(7,2,'enemy','thorn')],target:{row:6,col:1},owner:'player'},
 {id:'amber',board:'amber-rubble',boxes:[b(7,2,'enemy','poison','enemy')],target:{row:7,col:2},type:'rubble'},
 {id:'violet',board:'violet-venom',boxes:[b(7,2,'enemy','poison','enemy')],target:{row:7,col:2},type:'deadly-poison',source:'player'},
 {id:'violet',board:'violet-sting',boxes:[b(7,1,'enemy','shiny'),b(7,2,'enemy','thorn')],target:{row:7,col:1},type:'poison',source:'player'},
 {id:'silver',board:'silver-frostbind',boxes:[b(6,1,'enemy','poison','player'),b(7,2,'enemy','thorn')],target:{row:6,col:1},type:'frozen'},
 {id:'silver',board:'silver-thornwall',boxes:[b(7,1,'player','poison','enemy'),b(7,2,'player','frozen')],target:{row:7,col:1},type:'thorn'},
 {id:'rose',board:'rose-longcut',boxes:[b(7,1),b(7,2,'player'),b(7,3,'neutral'),b(7,4)],target:{row:7,col:1},remove:true},
 {id:'rose',board:'rose-twincut',boxes:[b(6,2,'player'),b(7,2)],target:{row:6,col:2},remove:true},
 {id:'imashiru',board:'imashiru-polish',boxes:[b(7,1,'player','poison','enemy'),b(7,2,'player','frozen')],target:{row:7,col:1},type:'shiny'},
 {id:'imashiru',board:'imashiru-reset',boxes:[b(7,2,'neutral','deadly-poison','enemy')],target:{row:7,col:2},type:'normal'},
];
test('all eight characters receive two genuinely exclusive new unlocks and keep their native starters',()=>{
 assert.equal(new Set(Object.values(UNLOCK_BOARDS).flat()).size,16);
 for(const id of rosterIds){const p=createProfile(1),c=p.characters[id];assert.deepEqual(availableBoards(c.tree,id),[roster[id].board]);assert.equal(c.board,NATIVE_BOARDS[id]);c.tree.board=1;
  const choices=availableBoards(c.tree,id);assert.equal(choices.length,EXTRA_BOARDS[id]?4:3);assert(UNLOCK_BOARDS[id].every(b=>choices.includes(b)));
  for(const other of rosterIds.filter(x=>x!==id))for(const board of [...UNLOCK_BOARDS[other],NATIVE_BOARDS[other]])assert(!choices.includes(board),`${id} must not borrow ${board}`);
  for(const board of choices)assert(isCharacterBoard(board,id));
 }
 assert.deepEqual([...cases.map(x=>x.board)].sort(),[...expandedBoardIds].sort());
});
for(const c of cases)test(`${c.board}: exact pattern, frozen cost, exclusive effect and no active-link side effects`,()=>{
 const s=createBattle(config(c.id,c.board,c.boxes)),before=JSON.stringify(s),d=kitBoardDefinition(s.config,c.board)!;
 assert.equal(kitBoardTargets(s,c.board,c.target).length,c.boxes.length);assert(canUseKitBoard(s,c.board,c.target));
 const r=resolveKitBoard(s,c.board,c.target);assert.equal(JSON.stringify(s),before);assert.equal(r.events.find(e=>e.type==='gauge-spent')!.amount,d.gauge);assert.equal(r.state.hp.player.current,s.hp.player.current-d.hp);assert.equal(r.state.rngState,s.rngState);
 if(c.remove)assert.deepEqual(r.state.boxes,[]);else for(const [i,box] of r.state.boxes.entries()){assert.equal(box.owner,c.owner??c.boxes[i]!.owner);assert.equal(box.type,c.type??c.boxes[i]!.type);assert.equal(box.poisonSource,c.type?c.source:c.boxes[i]!.poisonSource);}
 assert(!r.events.some(e=>e.type==='attack'||e.type==='heal'||e.type==='link-growth'));assert.equal(r.events.filter(e=>e.type==='kit-board-changed').length,1);
 const action=applyAction(s,{type:'board-skill',skillId:c.board,target:c.target});assert(action.accepted);assert.equal(action.state.actor,'enemy');assert(!action.resolution!.events.some(e=>e.type==='attack'||e.type==='heal'));assert(Object.isFrozen(action.state.config.meta!.boardBalance));
});
test('shape rotation is explicit, partial shapes/foreign owners/no-op types reject without paying',()=>{
 for(const c of cases){const s=createBattle(config(c.id,c.board,c.boxes)),badTargets=[{row:-1,col:0},{row:3.5,col:1},{row:99,col:99},{...c.target,orientation:kitBoardOrientations(c.board)},{...c.target,orientation:NaN}];
  for(const target of badTargets){assert(!canUseKitBoard(s,c.board,target));assert.equal(resolveKitBoard(s,c.board,target).state,s);const r=applyAction(s,{type:'board-skill',skillId:c.board,target});assert(!r.accepted);assert.equal(r.state,s);}
  const empty={...s,boxes:[]};assert(!canUseKitBoard(empty,c.board));assert.equal(resolveKitBoard(empty,c.board,c.target).state,empty);
  const short={...s,gauge:CURRENT_BOARD_BALANCE.boards[c.board].gauge-1};assert(!canUseKitBoard(short,c.board,c.target));assert.equal(resolveKitBoard(short,c.board,c.target).state,short);
  if(c.boxes.length>1)assert(!canUseKitBoard({...s,boxes:c.boxes.slice(1)},c.board,c.target));
  const d=kitBoardDefinition(s.config,c.board)!;if(d.owner)assert(!canUseKitBoard({...s,boxes:s.boxes.map(b=>({...b,owner:'neutral'}))},c.board,c.target));
  if(c.type)assert(!canUseKitBoard({...s,boxes:s.boxes.map(b=>({...b,type:c.type!}))},c.board,c.target)||c.board==='red-brand');
 }
 for(const [id,board,boxes] of [['mint','mint-diagonal',[b(4,3),b(5,2),b(6,1)]],['silver','silver-frostbind',[b(6,2),b(7,1)]]] as const){const s=createBattle(config(id,board,[...boxes]));assert.equal(kitBoardOrientations(board),2);assert(canUseKitBoard(s,board,{row:boxes[0].row,col:boxes[0].col,orientation:1}));assert(!canUseKitBoard(s,board,{row:boxes[0].row,col:boxes[0].col,orientation:0}));}
 const venom=createBattle(config('violet','violet-venom',[b(7,2)]));assert(!canUseKitBoard(venom,'violet-venom',{row:7,col:2}));
});
test('HP costs precede all changes; lethal costs lose normally without capturing or stacking types',()=>{
 for(const c of cases.filter(x=>x.id==='red')){const base=config(c.id,c.board,c.boxes),hp=CURRENT_BOARD_BALANCE.boards[c.board].hp,s=createBattle({...base,combatants:{...base.combatants,player:{...base.combatants.player,initialHp:hp}}}),r=applyAction(s,{type:'board-skill',skillId:c.board,target:c.target});assert(r.accepted);assert.equal(r.state.result?.winner,'enemy');assert.deepEqual(r.state.boxes,s.boxes);assert(!r.resolution!.events.some(e=>e.type==='kit-board-changed'));}
});
test('new poison boards use Poisoning Art at poison tick, with overlapping current own squares',()=>{
 const own=Array.from({length:6},(_,i)=>b(6+Math.floor(i/3),i%3,'player')),s=createBattle(config('violet','violet-venom',[...own,b(7,4,'enemy','poison','enemy')]));const r=resolveKitBoard(s,'violet-venom',{row:7,col:4});assert.equal(r.state.hp.enemy.current,s.hp.enemy.current);assert.deepEqual(poisonDamageSummary(r.state,'enemy'),{boxes:1,base:2,bonus:2,squares:2,damage:4});
 const changed={...r.state,boxes:r.state.boxes.filter(b=>b.id!=='6:1')};assert.equal(poisonDamageSummary(changed,'enemy').damage,2);
 assert.equal(IMASHIRU.insightCost,30);assert.equal(IMASHIRU.transformationCost,200);assert.equal(s.config.meta!.kitBalance!.roseHorizontalBonus,12);
});
test('catalog2 requires known version, all exact balance entries, sufficient unlock and owner-specific board',()=>{
 const c=cases[0]!,base=config(c.id,c.board,c.boxes);for(const mutate of [(x:any)=>x.version=2,(x:any)=>delete x.boards['blue-plumb'],(x:any)=>x.boards.foreign={gauge:1,hp:0},(x:any)=>x.boards['blue-plumb'].gauge=-1,(x:any)=>x.boards['blue-plumb'].hp=1.5,(x:any)=>x.boards=[]]){const balance=structuredClone(CURRENT_BOARD_BALANCE);mutate(balance);assert.throws(()=>validateBoardBalance(balance));assert.throws(()=>createBattle({...base,meta:{...base.meta!,boardBalance:balance}}));}
 for(const meta of [{...base.meta!,boardCatalogVersion:9},{...base.meta!,boardBalance:undefined},{...base.meta!,board:'ember'},{...base.meta!,tree:{...base.meta!.tree,board:0}}])assert.throws(()=>createBattle({...base,meta:meta as never}));
 const p=createProfile();p.characters.blue.xp=100;p.characters.blue.tree.board=1;p.characters.blue.board='ember';assert.throws(()=>validateProfile(p));
});
test('new departures detach the complete board snapshot and resume the exact selected cost',()=>{
 const x=setup('imashiru','imashiru-polish'),balance=structuredClone(CURRENT_BOARD_BALANCE);(balance.boards['imashiru-polish'] as {gauge:number}).gauge=7;
 const config={...x.config,meta:{...x.config.meta!,boardBalance:balance},initialGauge:7,initialBoxes:[b(7,0,'player'),b(7,1,'player')]},controller=new BattleController(config,{render(){},async animate(){}},x.options),raw=encodeSave(controller.exportCheckpoint(),1,1),restored=BattleController.restore(decodeSave(raw).checkpoint,{render(){},async animate(){}}),s=restored.snapshot;
 assert.equal(s.config.meta!.boardCatalogVersion,BOARD_CATALOG_VERSION);assert(Object.isFrozen(s.config.meta!.boardBalance!.boards));assert.equal(encodeSave(restored.exportCheckpoint(),1,1),raw);assert.equal(kitBoardDefinition(s.config,'imashiru-polish')!.gauge,7);const r=applyAction({...s,shinyNextDrop:true},{type:'board-skill',skillId:'imashiru-polish',target:{row:7,col:0}});assert(r.accepted);assert.equal(r.resolution!.events.find(e=>e.type==='gauge-spent')!.amount,7);assert(r.state.shinyNextDrop);assert.equal(CURRENT_BOARD_BALANCE.boards['imashiru-polish'].gauge,65);
});
const foreign:Record<RosterId,BoardSkillId>={blue:'ember',red:'pain-shared',mint:'ember',amber:'pain-shared',violet:'ember',silver:'ember',rose:'pain-shared',imashiru:'pain-shared'};
function oldProfile():Profile{const p=createProfile(55);delete p.boardCatalogVersion;p.coins=1234;p.energy=4;p.ownedCharacters=[...rosterIds];for(const id of rosterIds){p.characters[id].xp=777;p.characters[id].tree.board=1;p.characters[id].board=foreign[id];}p.trophies={'clear50:first':42};p.receipts['prior-run']={runId:'prior-run',character:'blue',xp:10,coins:5,defeated:1,clear:false,trophies:[],at:2};p.launches['active-run']={character:'blue',snapshot:'unchanged-old-run-snapshot'};return p;}
test('saved cross-character selections migrate once without losing XP, currency, ranks or old run records',()=>{
 const p=oldProfile(),raw=JSON.stringify(p);validateProfile(p);const n=migrateProfile(p);assert.equal(JSON.stringify(p),raw);assert.equal(n.boardCatalogVersion,2);assert.equal(migrateProfile(n),n);
 for(const id of rosterIds){assert.equal(n.characters[id].board,roster[id].board);assert.deepEqual({...n.characters[id],board:p.characters[id].board},p.characters[id]);}
 const {boardCatalogVersion:_v,characters:_c,...other}=n,{characters:_old,...prior}=p;assert.deepEqual(other,prior);assert.equal(freezeRunMeta(p,'blue',true).board,'pain-shared');
 const own=oldProfile();own.characters.red.board='red-capture';assert.equal(migrateProfile(own).characters.red.board,'red-capture');
});
class Storage {data=new Map<string,string>();failOnMain=false;getItem(k:string){return this.data.get(k)??null;}setItem(k:string,v:string){if(this.failOnMain&&!k.endsWith('.before-board-catalog-v2'))throw new Error('write failed');this.data.set(k,v);}}
test('profile read backs up exact pre-catalog bytes and migration write failure preserves the usable old profile',()=>{
 const p=oldProfile(),raw=JSON.stringify(p),storage=new Storage(),store=new ProfileStore(storage,()=>true);storage.data.set(store.key,raw);storage.failOnMain=true;assert.throws(()=>store.read());assert.equal(storage.getItem(store.key),raw);assert.equal(storage.getItem(store.key+'.before-board-catalog-v2'),raw);storage.failOnMain=false;const restored=new ProfileStore(storage,()=>true).read();validateProfile(restored);assert.equal(restored.coins,p.coins);assert.equal(restored.characters.blue.board,'pain-shared');assert.deepEqual(restored.launches,p.launches);
});
test('legacy active runs keep borrowed boards and serialize byte-for-byte while future departures migrate',()=>{
 const x=setup('blue','blue-plumb'),meta={...x.config.meta!,boardCatalogVersion:undefined,boardBalance:undefined,board:'ember' as const},legacy={...x.config,meta},controller=new BattleController(legacy,{render(){},async animate(){}},x.options),cp=controller.exportCheckpoint(),raw=encodeSave(cp,1,1);const p=oldProfile();p.launches[cp.runId]={character:'blue',snapshot:JSON.stringify(meta)};const migrated=migrateProfile(p);assert.equal(migrated.launches[cp.runId]!.snapshot,JSON.stringify(meta));assert.equal(encodeSave(decodeSave(raw).checkpoint,1,1),raw);const restored=BattleController.restore(decodeSave(raw).checkpoint,{render(){},async animate(){}});assert.equal(restored.snapshot.config.meta!.board,'ember');assert.equal(restored.snapshot.config.meta!.boardCatalogVersion,undefined);assert.equal(freezeRunMeta(migrated,'blue',true).board,'pain-shared');
});
