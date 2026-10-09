import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {skillCatalog,skillHasEffect,skillValue,type SkillDefinition} from '../src/next/core/skillCatalog.ts';
import {definitionHasEffect} from '../src/next/core/skillEffects.ts';
import {kitBoardCatalog,type KitBoardDefinition} from '../src/next/core/kitBoards.ts';
import {revisedBoardCatalog} from '../src/next/core/revisedBoards.ts';
import {createSkill} from '../src/next/core/playerBuild.ts';
import {createBattle} from '../src/next/core/index.ts';
import {defaultConfig} from '../src/next/core/definitions.ts';
import {resolveActiveDrop} from '../src/next/core/activeDrop.ts';
import {resolveInstantSkill} from '../src/next/core/instantSkills.ts';
import {tuningOf} from '../src/next/core/tuning.ts';
import {skillHudHtml} from '../src/next/ui/skillHud.ts';
import {paintBlueTransformation,blueDuration} from '../src/next/ui/blueTransformationLight.ts';
import {equippedHealingSlots} from '../src/next/ui/healingSkillTargets.ts';
import {BattleController} from '../src/next/app/BattleController.ts';
import {encodeSave,decodeSave} from '../src/next/app/saveCheckpoint.ts';
import type {BattleState,Box,NormalSkillId} from '../src/next/core/types.ts';
const ids=Object.keys(skillCatalog) as NormalSkillId[];
test('definition HP-heal tags exactly cover player healing sources declared by the core contract',()=>{
 const text=readFileSync(new URL('../src/next/core/types.ts',import.meta.url),'utf8'),ast=ts.createSourceFile('types.ts',text,ts.ScriptTarget.Latest,true),event=ast.statements.find(n=>ts.isInterfaceDeclaration(n)&&n.name.text==='HealEvent') as ts.InterfaceDeclaration,source=event.members.find(n=>n.name?.getText(ast)==='source') as ts.PropertySignature;
 assert(source.type&&ts.isUnionTypeNode(source.type));const core=source.type.types.map(n=>{assert(ts.isLiteralTypeNode(n)&&ts.isStringLiteral(n.literal));return n.literal.text;}).filter(id=>Object.hasOwn(skillCatalog,id));
 assert.deepEqual(ids.filter(id=>skillHasEffect(id,'hp-heal')).sort(),core.sort());assert(!skillHasEffect('capacitor','hp-heal'));assert(skillHasEffect('capacitor','gauge-gain'));assert(!skillHasEffect('charge','hp-heal'));assert(skillHasEffect('charge','gauge-gain'));
 for(const d of [...Object.values(kitBoardCatalog),...Object.values(revisedBoardCatalog)])assert(!definitionHasEffect(d,'hp-heal'));
});
for(const id of ids.filter(id=>['shape','instant'].includes(skillCatalog[id].kind)))for(const rank of [1,2] as const){if(rank===2&&skillCatalog[id].upgradeable===false)continue;
 test('effect capability matches actual '+id+' rank '+rank+' dispatch',()=>{
  const base=createBattle({...defaultConfig,characterId:'blue'}),skill=createSkill(id,rank);let state:BattleState={...base,hp:{player:{current:1,max:1000},enemy:{current:10000,max:10000}},build:{fixed:id==='health'?skill:createSkill('health'),slots:id==='health'?[null,null]:[skill,null],power:{3:0,4:0,5:0}}};
  let result;
  if(skillCatalog[id].kind==='instant')result=resolveInstantSkill(state,0);
  else {const cells=skillCatalog[id].pattern!.cells.map(c=>({row:c.row+3,col:c.col+1})),origin=cells.at(-1)!;state={...state,boxes:cells.slice(0,-1).map((c,i):Box=>({...c,id:'shape:'+i,owner:'player',type:'normal',status:'normal'}))};result=resolveActiveDrop(state,{id:'tag-test',available:true,landing:origin,spawn:origin,edge:{...origin,side:'top'},segmentEndRow:origin.row,path:[origin]});}
  const heals=result.events.filter(e=>e.type==='heal'&&e.actor==='player'&&e.source===id);assert.equal(heals.length>0,skillHasEffect(id,'hp-heal'));
  if(skillHasEffect(id,'hp-heal')){assert.equal(heals.length,1);const heal=heals[0]!;assert(heal.type==='heal');assert.equal(heal.requestedAmount,skillValue(id,rank,tuningOf(state.config)));assert.equal(result.state.hp.player.current,state.hp.player.current+heal.amount);assert.equal(result.state.rngState,state.rngState);}
 });
}
test('composable tags ignore names, rank and activation family; board definitions use the same type',()=>{
 for(const kind of ['shape','link','passive','instant'] as const){const mixed:SkillDefinition={id:'health',name:'別名の複合効果',kind,effectTags:['damage','hp-heal','gauge-gain']};assert(definitionHasEffect(mixed,'hp-heal'));assert(definitionHasEffect(mixed,'damage'));assert(!definitionHasEffect({...mixed,effectTags:['damage','gauge-gain']},'hp-heal'));}
 const board:KitBoardDefinition={...kitBoardCatalog['blue-freeze']!,effectTags:['hp-heal','damage']};assert(definitionHasEffect(board,'hp-heal'));
 for(const rank of [1,2] as const){const s=createBattle({...defaultConfig,characterId:'blue'}),state={...s,build:{...s.build!,fixed:createSkill('health',rank),slots:[createSkill('healing-potion',rank),createSkill('magic-bullet',rank)] as const}};assert.deepEqual(equippedHealingSlots(state).map(s=>s.id),['health','healing-potion']);const html=skillHudHtml(state,false);assert.equal((html.match(/data-skill-effects="hp-heal"/g)??[]).length,2);}
});
test('skill capability tags are not serialized into skill instances or checkpoints',()=>{
 const controller=new BattleController({...defaultConfig,characterId:'blue'},{render(){},async animate(){}}),before=controller.exportCheckpoint(),encoded=encodeSave(before,1),decoded=decodeSave(encoded).checkpoint;assert(!encoded.includes('effectTags'));assert.deepEqual(decoded.state.build,before.state.build);assert.deepEqual(Object.keys(createSkill('health')).sort(),['id','rank','uses']);controller.destroy();
});
test('adopted renderer exactly matches every captured A-revised frame and duration',()=>{
 const fixture=JSON.parse(readFileSync(new URL('./fixtures/next-blue-healing-accepted-frames.json',import.meta.url),'utf8'));
 for(const {size,p,mode,hash}of fixture.frames){const scene={width:size[0],height:size[1],board:{left:50,top:114,width:240,height:320},enemy:{x:300,y:52},boxes:[{x:72,y:404},{x:112,y:364}],healingTargets:[{x:93,y:485},{x:142,y:485},{x:191,y:485}]},calls:unknown[][]=[];
  const ctx=new Proxy({createRadialGradient(...a:unknown[]){calls.push(['gradient',...a]);return {addColorStop(...b:unknown[]){calls.push(['stop',...b]);}};}},{get(o,k){return k in o?o[k as keyof typeof o]:(...a:unknown[])=>calls.push([k,...a]);},set(_o,k,v){calls.push(['set',k,typeof v==='object'?'gradient':v]);return true;}}) as unknown as CanvasRenderingContext2D;
  paintBlueTransformation(ctx,scene,'skills',p,mode==='reduced',mode==='short');assert.equal(createHash('sha256').update(JSON.stringify(calls)).digest('hex'),hash,JSON.stringify({size,p,mode}));
 }
 assert.equal(blueDuration({speed:'medium',short:false,lowMotion:false}),1300);assert.equal(blueDuration({speed:'slow',short:false,lowMotion:false}),1950);
 const preview=readFileSync(new URL('../experiments/blue-transformation/effect.ts',import.meta.url),'utf8');assert.match(preview,/export \* from.*blueTransformationLight/);
});
