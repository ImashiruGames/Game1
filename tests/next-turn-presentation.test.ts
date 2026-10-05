import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createBattle,applyAction} from '../src/next/core/battle.ts';
import {createTrialConfig} from '../src/next/config.ts';
import {turnCue} from '../src/next/ui/turnPresentation.ts';
import type {BattleState} from '../src/next/core/types.ts';

const initial=()=>createBattle(createTrialConfig('blue'));
test('turn cue distinguishes ready input, own resolution, and opponent resolution',()=>{
 const state=initial();assert.deepEqual(turnCue(state,false,null),{owner:'player',phase:'ready',badge:'自分 1手',description:'自分の手番 · 行動を選べます',inputLocked:false});
 assert.equal(turnCue(state,true,null).description,'自分の行動を解決中 · 入力待機');
 const after=applyAction(state,{type:'drop',candidateId:'ceiling:0:0'}).state;
 assert.equal(turnCue(after,true,null).owner,'enemy');assert.equal(turnCue(after,false,null).inputLocked,true);assert.equal(turnCue(after,true,null).description,'相手の行動を解決中 · 入力待機');
});
test('turn cue never offers player input during Red start, stage transition, or terminal result',()=>{
 const s=initial();const red={...s,config:{...s.config,characterId:'red'},transformation:{character:'red',remainingStarts:2},playerTurnStarted:false} as BattleState;
 assert.equal(turnCue(red,false,null).inputLocked,true);
 const run={stage:2,defeatedCount:1,currentEnemyId:'hikikizan',status:'transitioning'} as const;
 assert.equal(turnCue(s,true,run).phase,'transition');
 const won={...s,result:{winner:'player',reason:'hp-zero'}} as BattleState;
 assert.equal(turnCue(won,false,{...run,status:'reward'}).description,'撃破報酬を選択');assert.equal(turnCue(won,false,{...run,status:'cleared'}).phase,'ended');
});
test('turn presentation remains a pure read with no timer, random draw, or gameplay call',()=>{
 const state=initial(),before=JSON.stringify(state);for(let i=0;i<20;i++)turnCue(state,i%2===0,null);assert.equal(JSON.stringify(state),before);
 const source=readFileSync(new URL('../src/next/ui/turnPresentation.ts',import.meta.url),'utf8');
 assert.doesNotMatch(source,/setTimeout|setInterval|Math\.random|applyAction|controller\./);
 const css=readFileSync(new URL('../src/next/ui/turnPresentation.css',import.meta.url),'utf8');
 assert.match(css,/160ms/);assert.match(css,/prefers-reduced-motion/);assert.match(css,/data-reduced-motion=true/);assert.doesNotMatch(css,/infinite|grid-template|--cell|translate|position:fixed/);
});

import {createTurnPresentation} from '../src/next/ui/turnPresentation.ts';
import {presentationDom} from './helpers/presentationDom.ts';
test('turn DOM is initially static, accents only changed owner, and honors lock/reset/reduced options',t=>{
 const dom=presentationDom();t.after(()=>dom.restore());const presentation=createTurnPresentation(dom.root.asElement()),state=initial();
 const normal={short:false,lowMotion:false};presentation.update(state,true,null,normal);assert.equal(dom.player.classList.contains('turn-enter'),false);assert.equal(dom.actions.getAttribute('aria-busy'),'true');
 const opposing={...state,actor:'enemy' as const};presentation.update(opposing,true,null,normal);assert.equal(dom.enemy.classList.contains('turn-enter'),true);assert.match(dom.hint.textContent!,/相手の行動/);presentation.update(opposing,true,null,normal);assert.equal(dom.enemy.classList.contains('turn-enter'),true);
 presentation.update(state,false,null,{short:true,lowMotion:false});assert.equal(dom.player.classList.contains('turn-enter'),false);assert.equal(dom.game.dataset.turnMotion,'static');assert.equal(dom.actions.getAttribute('aria-busy'),'false');
 presentation.update(opposing,true,null,{short:false,lowMotion:true});assert.equal(dom.enemy.classList.contains('turn-enter'),false);
 presentation.reset();assert.equal(dom.game.dataset.turnOwner,undefined);assert.equal(dom.actions.getAttribute('aria-busy'),null);presentation.update(opposing,true,null,normal);assert.equal(dom.enemy.classList.contains('turn-enter'),false);
});
