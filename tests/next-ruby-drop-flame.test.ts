import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {createBattle,applyAction,defaultConfig,getDropOptions} from '../src/next/core/index.ts';
import type {BattleState,Box} from '../src/next/core/types.ts';
import {rosterIds} from '../src/next/meta/roster.ts';
import {rubyAutoDrop,rubyDropFlameFrames} from '../src/next/ui/rubyDropFlame.ts';
import {createDropMotion,DROP_MOTION_TIMING} from '../src/next/ui/dropMotion.ts';
import {captureAnimationMotion} from '../src/next/ui/animationTimeline.ts';
import {createBattleAnimator,type BattleAnimationHooks} from '../src/next/ui/battleAnimator.ts';
import {boardSkillDom} from './helpers/boardSkillDom.ts';
import {type KineticNode} from './helpers/kineticDom.ts';
const acceptedComet=JSON.parse(readFileSync(new URL('./fixtures/next-ruby-comet-accepted-style.json',import.meta.url),'utf8')).style;
const full=captureAnimationMotion({speed:'medium',short:false,lowMotion:false});
function fixture(kind='floor'){
 const initialBoxes:Box[]=kind==='stack'?Array.from({length:6},(_,col)=>({id:'base:'+col,row:7,col,owner:'neutral',type:'normal',status:'normal'})):[];
 const terrain=kind==='terrain'?Array.from({length:6},(_,col)=>({row:7,col})):[];
 const before=createBattle({...defaultConfig,characterId:'red',initialTransformation:{character:'red',scope:'run',remainingStarts:2},initialBoxes,board:{width:6,height:8,gravity:'down',terrain,invalidCells:[]}});
 const result=applyAction(before,{type:'start-turn'});assert(result.accepted);const event=result.resolution!.events.find(e=>e.type==='drop')!;assert(event);return {before,result,event};
}
const source=readFileSync(new URL('../src/next/main.ts',import.meta.url),'utf8'),ast=ts.createSourceFile('main.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
let dropSource='';function visit(n:ts.Node){if(ts.isCallExpression(n)&&n.expression.getText(ast)==='createBattleAnimator'){const a=n.arguments[0];assert(a&&ts.isObjectLiteralExpression(a));const p=a.properties.find(p=>p.name?.getText(ast)==='drop');assert(p&&ts.isPropertyAssignment(p));dropSource=p.initializer.getText(ast);}ts.forEachChild(n,visit);}visit(ast);
function mainDrop(ui:ReturnType<typeof createDropMotion>):BattleAnimationHooks['drop']{const js=ts.transpileModule('return ('+dropSource+');',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;return new Function('dropMotion',js)(ui);}
function paint(dom:ReturnType<typeof boardSkillDom>,s:BattleState){for(const c of dom.cells){const b=s.boxes.find(b=>b.row===+c.dataset.cellRow!&&b.col===+c.dataset.cellCol!);c.className='cell'+(b?' '+b.owner:'');}}
const flame=(dom:ReturnType<typeof boardSkillDom>)=>dom.area.querySelector<KineticNode>('.ruby-drop-flame');
for(const kind of ['floor','stack','terrain'])test('Ruby auto '+kind+' landing uses actual moving box and stops its flame before squash',t=>{
 const dom=boardSkillDom();t.after(()=>dom.restore());const {before,result,event}=fixture(kind),snapshot=JSON.stringify({before,result}),ui=createDropMotion(dom.root.asElement());paint(dom,{...before,boxes:[...before.boxes,event.box]});
 assert(rubyAutoDrop(event,result.resolution!,before));assert.equal(event.landing.row,kind==='floor'?7:6);
 mainDrop(ui)(event,new AbortController().signal,full,{rubyAutoDrop:rubyAutoDrop(event,result.resolution!,before)});
 const f=flame(dom)!;assert(f);for(const [key,value]of Object.entries(acceptedComet))assert.equal(f.style[key],value);assert.equal(f.dataset.candidate,'comet');assert.equal(f.children.length,0);const box=f.parent!,a=box.animations[0]!,fa=f.animations[0]!;
 assert.equal(box.className,'kinetic-drop-box player');assert.equal(a.startTime,fa.startTime);assert.equal(a.options.duration,fa.options.duration);assert.deepEqual(fa.frames,rubyDropFlameFrames(2/3));assert.equal(fa.frames[0]!.easing,'steps(1,end)');assert.equal(fa.frames[1]!.opacity,0);
 const landing=a.frames.find(k=>k.offset===2/3)!;assert(landing);assert.equal(String(landing.transform),String(a.frames.at(-1)!.transform));assert.equal(dom.timers.size,1);
 dom.tick(DROP_MOTION_TIMING.total);assert.equal(flame(dom),null);assert(fa.cancelled);assert.equal(dom.timers.size,0);assert.equal(JSON.stringify({before,result}),snapshot);ui.dispose();
});
test('only actual Ruby turn-start drop is classified; manual, enemy, legacy identities and copied events are excluded',()=>{
 const {before,result,event}=fixture();assert(rubyAutoDrop(event,result.resolution!,before));assert(!rubyAutoDrop({...event},result.resolution!,before));
 for(const id of rosterIds){const config={...before.config,meta:{...before.config.meta,rosterId:id}} as BattleState['config'];assert.equal(rubyAutoDrop(event,result.resolution!,{...before,config}),id==='red');}
 const manualBefore={...before,playerTurnStarted:true},manual=applyAction(manualBefore,{type:'drop',candidateId:getDropOptions(manualBefore).find(x=>x.available)!.id});assert(manual.accepted);const normal=manual.resolution!.events.find(e=>e.type==='drop')!;assert(!rubyAutoDrop(normal,manual.resolution!,manualBefore));
 assert(!rubyAutoDrop(event,{...result.resolution!,actor:'enemy'},before));assert(!rubyAutoDrop({...event,actor:'enemy'},result.resolution!,before));assert(!rubyAutoDrop(event,{...result.resolution!,events:[{type:'turn-start',remainingStarts:0,skipped:true},event]},before));assert(!rubyAutoDrop(event,result.resolution!,{...before,transformation:null}));
});
for(const mode of ['slow','fast','short','reduced','os-reduced'])test('Ruby flame follows '+mode+' drop policy without extra waits',t=>{
 const dom=boardSkillDom();t.after(()=>dom.restore());const {before,event}=fixture(),ui=createDropMotion(dom.root.asElement());paint(dom,{...before,boxes:[event.box]});
 const m=mode==='short'?{short:true,lowMotion:false}:captureAnimationMotion({speed:mode==='slow'?'slow':mode==='fast'?'fast':'medium',short:mode==='fast',lowMotion:mode==='reduced'});if(mode==='os-reduced')dom.systemMotion(true);
 mainDrop(ui)(event,new AbortController().signal,m,{rubyAutoDrop:true});if(mode==='slow'){assert.equal(flame(dom)!.animations[0]!.options.duration,270);assert.equal(flame(dom)!.animations[0]!.frames[1]!.offset,2/3);dom.tick(270);}else assert.equal(flame(dom),null);
 assert.equal(dom.timers.size,0);assert(!dom.cell(event.landing.row,event.landing.col).classList.contains('kinetic-drop-masked'));ui.dispose();
});
test('manual and one-cell drops never gain a flame even when a Ruby form is active',t=>{
 const dom=boardSkillDom();t.after(()=>dom.restore());const {before,event}=fixture(),ui=createDropMotion(dom.root.asElement());paint(dom,{...before,boxes:[event.box]});ui.play(event,{motion:full});assert.equal(flame(dom),null);ui.clear();
 ui.play({...event,spawn:event.landing,path:[event.landing]},{motion:full,rubyAutoDrop:true});assert.equal(flame(dom),null);ui.dispose();
});
for(const reason of ['abort','resize','layout','pagehide','home','replace','dispose'])test('Ruby flame cleanup on '+reason+' leaves no burning box or old animation',t=>{
 const dom=boardSkillDom();t.after(()=>dom.restore());const {before,event}=fixture(),ui=createDropMotion(dom.root.asElement()),abort=new AbortController();paint(dom,{...before,boxes:[event.box]});ui.play(event,{motion:full,rubyAutoDrop:true,signal:abort.signal});const f=flame(dom)!;assert(f);
 if(reason==='abort')abort.abort();else if(reason==='resize'||reason==='pagehide')dom.fire(reason);else if(reason==='layout'){dom.board.rect.width--;dom.layout();}else if(reason==='home'){
  const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='showHome')!.getText(ast);const js=ts.transpileModule(fn+';return showHome;',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
  new Function('dropMotion','el','skillActivationEffects','imashiruLight','rubyEruption','blueHealingLight','profileStore',js)(ui,()=>({close(){}}),{clear(){}},{clear(){}},{clear(){}},{clear(){}},undefined)();
 }else if(reason==='replace'){ui.play({...event},{motion:full,rubyAutoDrop:true});assert(f.animations[0]!.cancelled);assert.notEqual(flame(dom),f);ui.clear();}else ui.dispose();
 assert.equal(flame(dom),null);assert(f.animations[0]!.cancelled);assert.equal(dom.timers.size,0);assert(!dom.cell(event.landing.row,event.landing.col).classList.contains('kinetic-drop-masked'));ui.dispose();
});
test('real animator and main drop handler decorate successive automatic starts, preserve committed state and original waits',async t=>{
 const dom=boardSkillDom();t.after(()=>dom.restore());const ui=createDropMotion(dom.root.asElement());let {before}=fixture();let count=0;
 for(let i=0;i<2;i++){
  const result=applyAction(before,{type:'start-turn'});assert(result.accepted);const snapshot=JSON.stringify({before,result}),waits:number[]=[];
  await createBattleAnimator({motion:()=>full,playSound(){},describe(){},observe(){},highlight(){},render(s){paint(dom,s);},drop:(...args)=>{mainDrop(ui)(...args);assert(flame(dom));count++;},react(){},feedback(){return {remove(){}};},transform:async()=>{},complete(){},pause:async ms=>{waits.push(ms);dom.tick(ms);}})(result.resolution!,before,result.state,new AbortController().signal);
  assert.equal(flame(dom),null);assert.deepEqual(waits.slice(0,2),[180,180]);assert.equal(JSON.stringify({before,result}),snapshot);before={...result.state,playerTurnStarted:false};
 }
 assert.equal(count,2);assert.equal(dom.timers.size,0);ui.dispose();
});
