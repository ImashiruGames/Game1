import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createBattle,applyAction} from '../src/next/core/battle.ts';
import {createTrialConfig} from '../src/next/config.ts';
import {bossCue} from '../src/next/ui/bossPresentation.ts';
import type {BattleState} from '../src/next/core/types.ts';
const mother=(current=31,max=150)=>{const c=createTrialConfig('blue','mother-core');return createBattle({...c,combatants:{...c.combatants,enemy:{...c.combatants.enemy,maxHp:max,initialHp:current}}});};

test('Mother cue uses exact engine threshold and does not round displayed percent',()=>{
 for(const [current,max,expected] of [[30,150,'pending'],[31,150,'normal'],[30,151,'pending'],[31,151,'normal'],[128,640,'pending'],[129,640,'normal']] as const){assert.equal(bossCue(mother(current,max))?.phase,expected);}
});
test('threshold is a next-enemy-turn warning until committed enemy-phase begins',()=>{
 const before=mother(30);const pending=bossCue(before)!;assert.equal(pending.mark,'予告');assert.match(pending.description,/次の相手手番から 固定5/);assert.equal(before.enemyPhase?.phase,'normal');
 const after=applyAction({...before,actor:'enemy'},{type:'enemy'});assert.equal(after.resolution!.events[0]!.type,'enemy-phase');
 assert.equal(bossCue(after.state)?.phase,'critical');assert.equal(bossCue(after.state)?.mark,'低HP');assert.match(bossCue(after.state)!.description,/固定5ダメージ＋投入 → 投入/);
 const second=applyAction({...after.state,actor:'enemy'},{type:'enemy'});assert.equal(bossCue(second.state)?.phase,'critical');assert.equal(second.resolution!.events.some(e=>e.type==='enemy-phase'),false);
});
test('critical mark follows sticky engine phase and configured fixed damage, not a fabricated HP cutoff',()=>{
 const s=mother(100),critical={...s,enemyPhase:{phase:'critical',completedTurns:1},config:{...s.config,enemyFixedDamageBonus:2}} as BattleState;
 assert.equal(bossCue(critical)?.phase,'critical');assert.match(bossCue(critical)!.description,/固定7/);
});
test('boss identity remains visible in normal phase and clears for normal enemies/end',()=>{
 assert.equal(bossCue(mother(150))?.mark,'BOSS');assert.equal(bossCue(createBattle(createTrialConfig('red','speed-core')))?.kind,'speed');assert.equal(bossCue(createBattle(createTrialConfig('red','marujiro'))),null);
 const s=mother(30),dead={...s,hp:{...s.hp,enemy:{...s.hp.enemy,current:0}}};assert.equal(bossCue(dead)?.danger,false);assert.equal(bossCue(dead)?.phase,'finished');
});
test('boss cue never mutates state, replays combat, draws RNG, or adds a wait',()=>{
 const s=mother(30),before=JSON.stringify(s);for(let i=0;i<20;i++)bossCue(s);assert.equal(JSON.stringify(s),before);
 const source=readFileSync(new URL('../src/next/ui/bossPresentation.ts',import.meta.url),'utf8');assert.doesNotMatch(source,/setTimeout|setInterval|Math\.random|applyAction|controller\./);
 const css=readFileSync(new URL('../src/next/ui/bossPresentation.css',import.meta.url),'utf8');assert.match(css,/160ms/);assert.match(css,/prefers-reduced-motion/);assert.match(css,/data-reduced-motion=true/);assert.doesNotMatch(css,/infinite|grid-template|--cell|translate|position:fixed/);
});

import {createBossPresentation} from '../src/next/ui/bossPresentation.ts';
import {presentationDom} from './helpers/presentationDom.ts';
import type {PresentationNode} from './helpers/presentationDom.ts';
test('boss DOM restore is static; real threshold crossing accents once and normalizes on reset',t=>{
 const dom=presentationDom();t.after(()=>dom.restore());const presentation=createBossPresentation(dom.root.asElement()),state=mother(31),normal={short:false,lowMotion:false};dom.name.textContent='マザーコア';const mark=dom.enemy.querySelector<PresentationNode>('.boss-phase-mark')!;dom.enemy.classList.add('turn-enter');
 presentation.update(state,normal);assert.equal(mark.classList.contains('boss-phase-enter'),false);assert.equal(dom.name.textContent,'◆ マザーコア');
 const low={...state,hp:{...state.hp,enemy:{...state.hp.enemy,current:30}}};presentation.update(low,normal);assert.equal(mark.classList.contains('boss-phase-enter'),true);assert.equal(dom.enemy.classList.contains('turn-enter'),true);assert.equal(dom.enemy.classList.contains('boss-phase-enter'),false);assert.equal(dom.enemy.dataset.bossPhase,'pending');assert.equal(dom.name.textContent,'▲ マザーコア');
 mark.endAnimation('boss-phase-enter');assert.equal(mark.classList.contains('boss-phase-enter'),false);presentation.update(low,normal);assert.equal(mark.classList.contains('boss-phase-enter'),false);
 presentation.reset();presentation.update(low,normal);assert.equal(mark.classList.contains('boss-phase-enter'),false);assert.equal(dom.enemy.dataset.bossDanger,'true');
 presentation.update({...low,enemyPhase:{phase:'critical',completedTurns:1}},normal);assert.equal(mark.classList.contains('boss-phase-enter'),false);assert.equal(dom.enemy.dataset.bossPhase,'critical');
 presentation.update(state,normal);presentation.update(low,{short:false,lowMotion:true});assert.equal(mark.classList.contains('boss-phase-enter'),false);
});

test('boss pulse is scoped to its mark and cannot replace the HUD turn animation',()=>{
 const css=readFileSync(new URL('../src/next/ui/bossPresentation.css',import.meta.url),'utf8');
 assert.match(css,/\.boss-phase-mark\.boss-phase-enter\{animation:boss-phase-enter 160ms/);
 assert.doesNotMatch(css,/\.enemy-hud\.boss-phase-enter/);
 const source=readFileSync(new URL('../src/next/ui/bossPresentation.ts',import.meta.url),'utf8');
 assert.match(source,/mark\.addEventListener\('animationend'/);assert.doesNotMatch(source,/enemy\.classList\.(add|remove)\('boss-phase-enter'/);
});
