import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BattleController} from '../src/next/app/BattleController.ts';
import {prepareTrialSetup} from '../src/next/config.ts';
import {stageCue,stageSealHtml} from '../src/next/ui/stagePresentation.ts';
import {runResultHtml} from '../src/next/ui/runResult.ts';
import type {BattleState} from '../src/next/core/types.ts';
async function win(stage=1,ending?:'legacy-endless'){
 const setup=prepareTrialSetup({character:'blue',firstEnemy:'marujiro',seed:1,mode:'manual',stage,fixture:'reward',route:'boss-loop',ending});const controller=new BattleController(setup.config,{render(){},async animate(){}},setup.options);await controller.drop('ceiling:2:0');return controller;
}
test('normal victory seal precedes existing reward and reports only actual carried boxes',async()=>{
 const c=await win();const cue=stageCue(c.snapshot,c.runSnapshot,c.runOrigin)!;assert.equal(cue.kind,'reward');assert.equal(cue.title,'STAGE 1 突破');assert.match(cue.detail,/報酬を選んで次の階へ/);assert.match(cue.detail,/自箱3個を引継ぎ/);
 const cp=JSON.stringify(c.exportCheckpoint());for(let i=0;i<10;i++)stageSealHtml(stageCue(c.snapshot,c.runSnapshot,c.runOrigin)!);assert.equal(JSON.stringify(c.exportCheckpoint()),cp);assert.equal(c.runSnapshot?.status,'reward');
});
test('full stage50 and stage50 fixture have distinct honest seals and unchanged saved result facts',async()=>{
 const c=await win(50);const fixture=stageCue(c.snapshot,c.runSnapshot,c.runOrigin)!;assert.equal(fixture.kind,'test-clear');assert.equal(fixture.title,'STAGE 50 検証完了');assert.match(fixture.detail,/50階から開始/);assert.doesNotMatch(stageSealHtml(fixture),/50階 踏破/);
 const full=stageCue(c.snapshot,{...c.runSnapshot!,defeatedCount:50},{seed:1,startStage:1})!;assert.equal(full.kind,'clear');assert.equal(full.title,'50階 踏破');assert.doesNotMatch(full.detail,/引継ぎ|報酬/);
 const result=runResultHtml(c.snapshot,c.runSnapshot,c.runOrigin);assert.match(result,/検証ラン終了/);assert.match(result,/18 \/ 30/);assert.match(result,/開始seed/);assert.equal(c.runSnapshot?.offer,undefined);
});
test('loss, unresolved damage, and transition never get a victory seal',async()=>{
 const c=await win();assert.equal(stageCue({...c.snapshot,result:null},c.runSnapshot,c.runOrigin),null);
 const loss={...c.snapshot,result:{winner:'enemy',reason:'hp-zero'}} as BattleState;
 assert.equal(stageCue(loss,{...c.runSnapshot!,status:'lost'},c.runOrigin),null);
 assert.equal(stageCue(c.snapshot,{...c.runSnapshot!,status:'transitioning'},c.runOrigin),null);
 assert.equal(stageCue(c.snapshot,null,c.runOrigin),null);
});
test('legacy endless stage50 keeps a normal reward seal, never a false final clear',async()=>{
 const c=await win(50,'legacy-endless');const cue=stageCue(c.snapshot,c.runSnapshot,c.runOrigin)!;assert.equal(cue.kind,'reward');assert.equal(cue.title,'STAGE 50 突破');await c.chooseCategory(c.runSnapshot!.offer!.id,'heal');assert.equal(c.runSnapshot?.stage,51);assert.equal(stageCue(c.snapshot,c.runSnapshot,c.runOrigin),null);
});
test('seal markup is deterministic, local, reduced-motion safe, and adds no gameplay or delay',async()=>{
 const c=await win();const cue=stageCue(c.snapshot,c.runSnapshot,c.runOrigin)!;assert.equal(stageSealHtml(cue),stageSealHtml(cue));assert.equal((stageSealHtml(cue).match(/<i>/g)??[]).length,6);assert.match(stageSealHtml(cue),/<svg/);
 const source=readFileSync(new URL('../src/next/ui/stagePresentation.ts',import.meta.url),'utf8');assert.doesNotMatch(source,/setTimeout|setInterval|Math\.random|applyAction|controller\.|localStorage|showModal/);
 const css=readFileSync(new URL('../src/next/ui/stagePresentation.css',import.meta.url),'utf8');assert.match(css,/180ms/);assert.match(css,/prefers-reduced-motion/);assert.match(css,/data-reduced-motion=true/);assert.doesNotMatch(css,/infinite|grid-template|--cell|position:fixed/);
});

import {createStagePresentation} from '../src/next/ui/stagePresentation.ts';
import {presentationDom} from './helpers/presentationDom.ts';
import type {PresentationNode} from './helpers/presentationDom.ts';
test('victory animates once only when existing dialog is visible; restored checkpoint stays static',async t=>{
 const dom=presentationDom();t.after(()=>dom.restore());const presentation=createStagePresentation(dom.root.asElement()),c=await win(),normal={short:false,lowMotion:false};
 presentation.update({...c.snapshot,result:null},{...c.runSnapshot!,status:'active'},c.runOrigin,normal);
 presentation.update(c.snapshot,c.runSnapshot,c.runOrigin,normal);let seal=dom.reward.querySelector<PresentationNode>('.stage-seal')!;assert.equal(seal.classList.contains('stage-seal-enter'),false);
 dom.reward.open=true;presentation.update(c.snapshot,c.runSnapshot,c.runOrigin,normal);assert.equal(seal.classList.contains('stage-seal-enter'),true);
 seal.classList.remove('stage-seal-enter');presentation.update(c.snapshot,c.runSnapshot,c.runOrigin,normal);assert.equal(seal.classList.contains('stage-seal-enter'),false);
 presentation.reset();dom.reward.open=false;presentation.update(c.snapshot,c.runSnapshot,c.runOrigin,normal);dom.reward.open=true;presentation.update(c.snapshot,c.runSnapshot,c.runOrigin,normal);seal=dom.reward.querySelector<PresentationNode>('.stage-seal')!;assert.equal(seal.classList.contains('stage-seal-enter'),false);
});
test('new final-result DOM does not replay seal; low-motion and short keep static mark',async t=>{
 const dom=presentationDom();t.after(()=>dom.restore());const presentation=createStagePresentation(dom.root.asElement()),c=await win(50),normal={short:false,lowMotion:false};
 presentation.update({...c.snapshot,result:null},{...c.runSnapshot!,status:'active'},c.runOrigin,normal);dom.end.open=true;presentation.update(c.snapshot,c.runSnapshot,c.runOrigin,normal);
 let seal=dom.end.querySelector<PresentationNode>('.stage-seal')!;assert.equal(seal.classList.contains('stage-seal-enter'),true);seal.remove();presentation.update(c.snapshot,c.runSnapshot,c.runOrigin,normal);seal=dom.end.querySelector<PresentationNode>('.stage-seal')!;assert.equal(seal.classList.contains('stage-seal-enter'),false);
 for(const motion of [{short:true,lowMotion:false},{short:false,lowMotion:true}]){presentation.reset();presentation.update({...c.snapshot,result:null},c.runSnapshot,c.runOrigin,motion);presentation.update(c.snapshot,c.runSnapshot,c.runOrigin,motion);seal=dom.end.querySelector<PresentationNode>('.stage-seal')!;assert.equal(seal.classList.contains('stage-seal-enter'),false);assert.match(seal.innerHTML,/検証完了/);}
});
