import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createBattle,applyAction} from '../src/next/core/battle.ts';
import {createTrialConfig} from '../src/next/config.ts';
import type {BattleState,Box,Resolution} from '../src/next/core/types.ts';
import {boardSkillCueForEvent,createBoardSkillPresentation,BOARD_SKILL_PRESENTATION_TIMING} from '../src/next/ui/boardSkillPresentation.ts';
import {boardSkillDom} from './helpers/boardSkillDom.ts';
import {KineticNode} from './helpers/kineticDom.ts';

const full={short:false,lowMotion:false};
const box=(id:string,row:number,col:number,owner:Box['owner']='enemy'):Box=>({id,row,col,owner,type:'normal',status:'normal'});
function skill(character:'blue'|'red'='blue',boxes:readonly Box[]=[box('e1',7,0),box('p1',7,1,'player'),box('e2',6,2)],hp=30){
 const base=createTrialConfig(character),before=createBattle({...base,board:{...base.board,width:6,height:8,terrain:[],invalidCells:[]},initialBoxes:boxes,combatants:{...base.combatants,player:{...base.combatants.player,initialHp:hp}}});
 const result=applyAction(before,character==='blue'?{type:'board-skill',skillId:'pain-shared',row:7}:{type:'board-skill',skillId:'ember'});
 assert.equal(result.accepted,true);return {before,resolution:result.resolution!,after:result.state,activation:result.resolution!.events.find(e=>e.type==='board-skill')!};
}
const layer=(dom:ReturnType<typeof boardSkillDom>)=>dom.area.querySelector<KineticNode>('.board-skill-layer');
const descendants=(node:KineticNode):KineticNode[]=>node.children.flatMap(child=>[child,...descendants(child)]);
const effects=(dom:ReturnType<typeof boardSkillDom>,name:string)=>layer(dom)?descendants(layer(dom)!).filter(node=>node.classList.contains(name)):[];
function paint(dom:ReturnType<typeof boardSkillDom>,state:BattleState):void{for(const cell of dom.cells){cell.className='cell';delete cell.dataset.boxId;}for(const item of state.boxes){const cell=dom.cell(item.row,item.col);cell.classList.add(item.owner);cell.dataset.boxId=item.id;}}

/** Browser DOMRect coordinates are prototype getters, not spreadable own properties. */
function useBrowserRectGetters(dom:ReturnType<typeof boardSkillDom>):void {
 for(const node of [dom.area,dom.board,dom.drops,...dom.cells]){
  const measure=node.getBoundingClientRect.bind(node);
  node.getBoundingClientRect=()=>{
   const measured=measure(),prototype={};
   for(const key of ['left','top','width','height','right','bottom','x','y'] as const)Object.defineProperty(prototype,key,{get:()=>measured[key]});
   Object.defineProperty(prototype,'toJSON',{value:()=>measured});
   return Object.create(prototype) as DOMRect;
  };
 }
 assert.deepEqual(Object.keys(dom.cell(0,0).getBoundingClientRect()),[]);
}

test('native-style DOMRect getters keep a continuous row sweep at the real row in every motion mode',t=>{
 const dom=boardSkillDom();t.after(()=>dom.restore());useBrowserRectGetters(dom);const ui=createBoardSkillPresentation(dom.root.asElement());
 for(const motion of [full,{short:true,lowMotion:false},{short:false,lowMotion:true}]){
  const s=skill(),row=s.resolution.events.find(e=>e.type==='row-cleared')!;paint(dom,s.after);
  assert.equal(ui.play(row,s.resolution,s.before,{motion}),true);
  const lines=effects(dom,'board-skill-row');assert.equal(lines.length,1);
  const {left,top,width,height}=lines[0]!.style;assert.deepEqual({left,top,width,height},{left:'74px',top:'323px',width:'226px',height:'2px'});
  assert.equal(lines[0]!.animations.length,motion===full?1:0);ui.clear();
 }
 ui.dispose();assert.equal(dom.timers.size,0);
});

test('native-style DOMRect getters preserve terrain-separated and single-cell row segments',t=>{
 const dom=boardSkillDom();t.after(()=>dom.restore());useBrowserRectGetters(dom);const ui=createBoardSkillPresentation(dom.root.asElement()),s=skill(),row=s.resolution.events.find(e=>e.type==='row-cleared')!;
 dom.cell(7,2).classList.add('terrain');dom.cell(7,4).classList.add('invalid');
 assert.equal(ui.play(row,s.resolution,s.before,{motion:full}),true);
 assert.deepEqual(effects(dom,'board-skill-row').map(n=>({left:n.style.left,top:n.style.top,width:n.style.width,height:n.style.height})),[
  {left:'74px',top:'323px',width:'74px',height:'2px'},
  {left:'188px',top:'323px',width:'36px',height:'2px'},
  {left:'264px',top:'323px',width:'36px',height:'2px'},
 ]);ui.dispose();assert.equal(dom.timers.size,0);
});

test('real Blue resolution reads exact cleared row and before coordinates without mutation or gameplay imports',()=>{
 const s=skill(),snapshot=JSON.stringify(s),cleared=s.resolution.events.find(e=>e.type==='row-cleared')!;
 assert.deepEqual(boardSkillCueForEvent(s.activation,s.resolution,s.before),{activation:s.activation,skillId:'pain-shared',name:'痛みはお互いに',phase:'activation',targets:[]});
 const cue=boardSkillCueForEvent(cleared,s.resolution,s.before)!;assert.equal(cue.row,7);assert.equal(cue.phase,'clear-row');assert.deepEqual(cue.targets,[{id:'e1',row:7,col:0},{id:'p1',row:7,col:1}]);assert.equal(JSON.stringify(s),snapshot);
 const moved=s.after.boxes.find(b=>b.id==='e2')!;assert.equal(moved.row,7);assert.ok(!cue.targets.some(t=>t.id===moved.id));
});
test('real Red resolution converts only emitted IDs across random seeds, with no recomputation',()=>{
 for(const seed of [1,2,17,99]){
  const base=skill('red',[box('a',7,0),box('b',7,1),box('c',7,2),box('d',7,3),box('own',7,4,'player')]);
  const before={...base.before,rngState:seed},r=applyAction(before,{type:'board-skill',skillId:'ember'}).resolution!;
  const event=r.events.find(e=>e.type==='boxes-converted')!,snapshot=JSON.stringify({before,r}),cue=boardSkillCueForEvent(event,r,before)!;
  assert.equal(cue.name,'ほむらの火種');assert.equal(cue.phase,'convert');assert.deepEqual(cue.targets.map(t=>t.id),event.boxIds);assert.ok(cue.targets.every(t=>before.boxes.find(b=>b.id===t.id)?.owner==='enemy'));assert.equal(JSON.stringify({before,r}),snapshot);
 }
});
test('foreign/copied events, unrelated actions, invalid rows/IDs/owners and mismatched skill effects fail closed',()=>{
 const s=skill(),row=s.resolution.events.find(e=>e.type==='row-cleared')!;
 assert.equal(boardSkillCueForEvent({...s.activation},s.resolution,s.before),null);
 assert.equal(boardSkillCueForEvent(row,{...s.resolution,actor:'enemy'},s.before),null);
 assert.equal(boardSkillCueForEvent(row,{...s.resolution,events:[row]},s.before),null);
 for(const event of [{...row,row:6},{...row,boxIds:['missing']},{...row,boxIds:['e1','e1']},{...row,boxIds:['e2']}])assert.equal(boardSkillCueForEvent(event,{...s.resolution,events:[s.activation,event]},s.before),null);
 for(const n of [-1,8,NaN,1.5]){const event={type:'board-skill',actor:'player',skillId:'pain-shared',row:n} as const;assert.equal(boardSkillCueForEvent(event,{...s.resolution,events:[event]},s.before),null);}
 const conversion={type:'boxes-converted',actor:'player',boxIds:['p1'],from:'enemy',to:'player'} as const,ember={type:'board-skill',actor:'player',skillId:'ember'} as const;
 assert.equal(boardSkillCueForEvent(conversion,{...s.resolution,events:[ember,conversion]},s.before),null);
 assert.equal(boardSkillCueForEvent(row,{...s.resolution,events:[ember,row]},s.before),null);
 const damage=s.resolution.events.find(e=>e.type==='damage')!;assert.equal(boardSkillCueForEvent(damage,s.resolution,s.before),null);
});
test('Red self-KO and zero conversions never manufacture conversion targets; empty Blue row stays truthful',()=>{
 const ko=skill('red',[box('e',7,0)],3);assert.equal(ko.after.result?.winner,'enemy');assert.equal(ko.resolution.events.some(e=>e.type==='boxes-converted'),false);assert.deepEqual(boardSkillCueForEvent(ko.activation,ko.resolution,ko.before)!.targets,[]);
 const red=skill('red',[]),converted=red.resolution.events.find(e=>e.type==='boxes-converted')!;assert.deepEqual(boardSkillCueForEvent(converted,red.resolution,red.before)!.targets,[]);
 const blue=skill('blue',[]),row=blue.resolution.events.find(e=>e.type==='row-cleared')!;assert.equal(boardSkillCueForEvent(row,blue.resolution,blue.before)!.row,7);assert.deepEqual(boardSkillCueForEvent(row,blue.resolution,blue.before)!.targets,[]);
});
test('mount is inert; exact activation badge is independent of feedback and does not mutate a cell',t=>{
 const dom=boardSkillDom();t.after(()=>dom.restore());const ui=createBoardSkillPresentation(dom.root.asElement()),s=skill();paint(dom,s.before);
 assert.equal(layer(dom),null);assert.equal(ui.feedbackInsetTop(),0);assert.equal(dom.timers.size,0);
 const old=JSON.stringify(dom.cells.map(c=>({className:c.className,style:c.style})));assert.equal(ui.play(s.activation,s.resolution,s.before,{motion:full}),true);
 assert.equal(layer(dom)!.getAttribute('aria-hidden'),'true');assert.equal(effects(dom,'board-skill-name')[0]!.textContent,'痛みはお互いに');assert.equal(ui.feedbackInsetTop(),36);assert.equal(effects(dom,'board-skill-row').length,0);
 dom.feedback.innerHTML='new cost feedback';dom.rerender();assert.ok(layer(dom));assert.equal(ui.feedbackInsetTop(),36);assert.equal(JSON.stringify(dom.cells.map(c=>({className:c.className,style:c.style}))),old);
 dom.tick(BOARD_SKILL_PRESENTATION_TIMING.name);assert.equal(layer(dom),null);assert.equal(ui.feedbackInsetTop(),0);ui.dispose();
});
test('Blue has a moving horizontal cue only on committed row, plus breakup particles at removed IDs',t=>{
 const dom=boardSkillDom();t.after(()=>dom.restore());const ui=createBoardSkillPresentation(dom.root.asElement()),s=skill(),row=s.resolution.events.find(e=>e.type==='row-cleared')!;paint(dom,s.after);
 assert.equal(ui.play(row,s.resolution,s.before,{motion:full}),true);const lines=effects(dom,'board-skill-row');assert.equal(lines.length,1);assert.equal(lines[0]!.dataset.row,'7');assert.equal(lines[0]!.style.top,'323px');assert.equal(lines[0]!.animations[0]!.frames[0]!.transform,'scaleX(.12)');
 assert.deepEqual(effects(dom,'board-skill-erased').map(n=>n.dataset.boxId),['e1','p1']);assert.equal(effects(dom,'board-skill-spark').length,8);assert.ok(effects(dom,'board-skill-spark').every(n=>n.animations[0]!.frames[0]!.transform!==n.animations[0]!.frames.at(-1)!.transform));
 assert.equal(dom.cell(7,2).classList.contains('player'),false);dom.tick(420);assert.equal(layer(dom),null);assert.equal(dom.timers.size,0);ui.dispose();
});
test('Red waits through self-cost and highlights only converted player cells; next events cannot erase it before paint',t=>{
 const dom=boardSkillDom();t.after(()=>dom.restore());const ui=createBoardSkillPresentation(dom.root.asElement()),s=skill('red'),converted=s.resolution.events.find(e=>e.type==='boxes-converted')!,cost=s.resolution.events.find(e=>e.type==='damage')!;paint(dom,s.before);
 ui.play(s.activation,s.resolution,s.before,{motion:full});assert.equal(effects(dom,'board-skill-converted').length,0);dom.tick(100);assert.equal(ui.play(cost,s.resolution,s.before,{motion:full}),false);assert.equal(effects(dom,'board-skill-converted').length,0);
 dom.tick(500);paint(dom,s.after);ui.play(converted,s.resolution,s.before,{motion:full});assert.deepEqual(effects(dom,'board-skill-converted').map(n=>n.dataset.boxId),converted.boxIds);assert.equal(effects(dom,'board-skill-spark').length,converted.boxIds.length*4);assert.ok(effects(dom,'board-skill-converted').every(n=>n.animations[0]!.frames[0]!.transform==='scale(.76)'));
 assert.equal(effects(dom,'board-skill-converted').find(n=>n.dataset.boxId==='e2')!.style.top,'308px','converted ID follows already-rendered settling from row 6 to row 7');
 const wait={type:'enemy-wait',actor:'enemy'} as const,next:Resolution={actor:'enemy',originBoxId:null,links:[],enemyPlannedAction:'sequence',events:[wait]};dom.rerender();ui.play(wait,next,s.after,{motion:full});assert.ok(layer(dom));dom.tick(419);assert.ok(layer(dom));dom.tick(1);assert.equal(layer(dom),null);ui.dispose();
});
test('duplicate/foreign/pre-aborted input cannot replay or cancel a currently active cue',t=>{
 const dom=boardSkillDom();t.after(()=>dom.restore());const ui=createBoardSkillPresentation(dom.root.asElement()),s=skill();ui.play(s.activation,s.resolution,s.before,{motion:full});const original=layer(dom);
 assert.equal(ui.play(s.activation,s.resolution,s.before,{motion:full}),false);assert.equal(ui.play({...s.activation},s.resolution,s.before,{motion:full}),false);assert.equal(ui.play(s.activation,s.resolution,s.before,{motion:full,signal:AbortSignal.abort()}),false);assert.equal(layer(dom),original);
 ui.clear();assert.equal(ui.play(s.activation,s.resolution,s.before,{motion:full}),false);assert.equal(layer(dom),null);ui.dispose();
});
test('short/low/OS motion use a stationary badge and outlines without particles or WAAPI',t=>{
 const dom=boardSkillDom();t.after(()=>dom.restore());const ui=createBoardSkillPresentation(dom.root.asElement());
 for(const motion of [{short:true,lowMotion:false},{short:false,lowMotion:true},full]){
  if(motion===full)dom.systemMotion(true);const s=skill('red');paint(dom,s.after);const event=s.resolution.events.find(e=>e.type==='boxes-converted')!;assert.equal(ui.play(event,s.resolution,s.before,{motion}),true);
  assert.ok(layer(dom)!.classList.contains('is-static'));assert.equal(effects(dom,'board-skill-spark').length,0);assert.ok(descendants(layer(dom)!).every(n=>n.animations.length===0));dom.tick(239);assert.ok(layer(dom));dom.tick(1);assert.equal(layer(dom),null);
 }
 ui.dispose();
});
test('abort, clear, resize, changed layout, settings, OS setting, pagehide and dispose fully remove only owned nodes',t=>{
 const dom=boardSkillDom();t.after(()=>dom.restore());const ui=createBoardSkillPresentation(dom.root.asElement());
 const start=(signal?:AbortSignal)=>{const s=skill();ui.play(s.activation,s.resolution,s.before,{motion:full,signal});assert.ok(layer(dom));};
 const clean=()=>{assert.equal(layer(dom),null);assert.equal(ui.feedbackInsetTop(),0);assert.equal(dom.timers.size,0);assert.equal(dom.feedback.isConnected,true);assert.ok(dom.cells.every(cell=>!cell.className.includes('board-skill')));};
 const abort=new AbortController();start(abort.signal);abort.abort();clean();start();ui.clear();clean();start();dom.fire('resize');clean();start();dom.layout();assert.ok(layer(dom));dom.board.rect.width-=1;dom.layout();clean();dom.board.rect.width+=1;
 start();dom.settings({short:true,lowMotion:false});clean();start();dom.systemMotion(true);clean();dom.systemMotion(false);start();dom.fire('pagehide');clean();start();ui.dispose();clean();const s=skill();assert.equal(ui.play(s.activation,s.resolution,s.before,{motion:full}),false);assert.equal(dom.listenerCount('resize'),0);assert.equal(dom.listenerCount('pagehide'),0);ui.dispose();
});
test('stale timer and abort cannot remove a newer cue; geometry changes invalidate feedback inset synchronously',t=>{
 const dom=boardSkillDom();t.after(()=>dom.restore());const ui=createBoardSkillPresentation(dom.root.asElement()),a=skill(),b=skill('red'),abort=new AbortController();
 ui.play(a.activation,a.resolution,a.before,{motion:full,signal:abort.signal});const timer=[...dom.timers.values()][0]!.fn;ui.play(b.activation,b.resolution,b.before,{motion:full});const current=layer(dom);timer();abort.abort();assert.equal(layer(dom),current);assert.equal(dom.timers.size,1);
 dom.drops.rect.top+=3;assert.equal(ui.feedbackInsetTop(),0);assert.equal(layer(dom),null);assert.equal(dom.timers.size,0);ui.dispose();
});
test('terrain splits Blue sweep, wrong-owner Red cells get no conversion marks, and malformed geometry fails closed',t=>{
 const dom=boardSkillDom();t.after(()=>dom.restore());const ui=createBoardSkillPresentation(dom.root.asElement()),blue=skill(),row=blue.resolution.events.find(e=>e.type==='row-cleared')!;
 dom.cell(7,3).classList.add('terrain');ui.play(row,blue.resolution,blue.before,{motion:full});assert.equal(effects(dom,'board-skill-row').length,2);ui.clear();
 const red=skill('red'),converted=red.resolution.events.find(e=>e.type==='boxes-converted')!;paint(dom,red.before);ui.play(converted,red.resolution,red.before,{motion:full});assert.equal(effects(dom,'board-skill-converted').length,0);ui.clear();
 dom.board.rect.width=NaN;const fresh=skill();assert.equal(ui.play(fresh.activation,fresh.resolution,fresh.before,{motion:full}),false);assert.equal(layer(dom),null);assert.equal(dom.timers.size,0);ui.dispose();
});
test('unavailable/failed WAAPI gives a static fallback and bounded cleanup without hiding board cells',t=>{
 const dom=boardSkillDom();t.after(()=>dom.restore());const ui=createBoardSkillPresentation(dom.root.asElement());
 for(const fault of [()=>dom.failNewAnimations(),()=>dom.omitWAAPI()]){fault();const s=skill('red');paint(dom,s.after);const event=s.resolution.events.find(e=>e.type==='boxes-converted')!;assert.equal(ui.play(event,s.resolution,s.before,{motion:full}),true);assert.equal(effects(dom,'board-skill-converted').length,event.boxIds.length);dom.tick(420);assert.equal(layer(dom),null);assert.ok(dom.cells.every(c=>c.style.opacity===undefined));}ui.dispose();
});
test('missing, duplicate and stale DOM IDs cannot put Red conversion on a different player box',t=>{
 const dom=boardSkillDom();t.after(()=>dom.restore());const ui=createBoardSkillPresentation(dom.root.asElement());
 for(const kind of ['missing','duplicate','stale'] as const){
  const s=skill('red',[box('only',7,0),box('own',7,1,'player')]),event=s.resolution.events.find(e=>e.type==='boxes-converted')!;paint(dom,s.after);
  if(kind==='missing')for(const cell of dom.cells)delete cell.dataset.boxId;
  if(kind==='duplicate')dom.cell(7,1).dataset.boxId='only';
  if(kind==='stale')dom.cell(7,0).dataset.boxId='different-player-box';
  assert.equal(ui.play(event,s.resolution,s.before,{motion:full}),true);assert.equal(effects(dom,'board-skill-converted').length,0);ui.clear();
 }
 ui.dispose();
});
test('box IDs containing selector punctuation use exact data matching without selector interpolation',t=>{
 const dom=boardSkillDom();t.after(()=>dom.restore());const ui=createBoardSkillPresentation(dom.root.asElement()),id='box:["odd"]\\id',s=skill('red',[box(id,7,0)]),event=s.resolution.events.find(e=>e.type==='boxes-converted')!;paint(dom,s.after);
 assert.equal(ui.play(event,s.resolution,s.before,{motion:full}),true);assert.deepEqual(effects(dom,'board-skill-converted').map(n=>n.dataset.boxId),[id]);ui.dispose();
});
test('presentation source adds no core execution, audio, persistence, input handlers, waits or layout changes',()=>{
 const source=readFileSync(new URL('../src/next/ui/boardSkillPresentation.ts',import.meta.url),'utf8'),css=readFileSync(new URL('../src/next/ui/boardSkillPresentation.css',import.meta.url),'utf8');
 assert.doesNotMatch(source,/Math\.random|applyAction|sampleUniform|controller\.|localStorage|Audio|setInterval|await\s|async\s|addEventListener\(['"](?:click|pointer|touch|keydown)/);assert.doesNotMatch(css,/grid-template|position:fixed|height:100|infinite|\.cell[ .:#]/);assert.match(css,/pointer-events:none/);assert.match(css,/prefers-reduced-motion/);
});

test('ownership conversion retains each box type in both old/new cue layers without changing the battle',t=>{const dom=boardSkillDom();t.after(()=>dom.restore());const ui=createBoardSkillPresentation(dom.root.asElement());for(const type of ['normal','shiny','frozen','poison','deadly-poison','rubble','thorn'] as const)for(const motion of [full,{short:true,lowMotion:false},{short:false,lowMotion:true}]){const s=skill('red',[{...box('typed',7,0),type}]),event=s.resolution.events.find(e=>e.type==='boxes-converted')!,snapshot=JSON.stringify(s);paint(dom,s.after);assert.equal(ui.play(event,s.resolution,s.before,{motion}),true);const next=effects(dom,'conversion-new')[0]!;assert(next);assert(next.innerHTML.includes(`data-box-type="${type}"`),type);const old=effects(dom,'conversion-old')[0];if(old)assert(old.innerHTML.includes(`data-box-type="${type}"`),type);assert.equal(JSON.stringify(s),snapshot);ui.clear();}ui.dispose();});
