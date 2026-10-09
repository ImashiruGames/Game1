import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {createBattle,applyAction,gaugeDefinition,tuningOf} from '../src/next/core/index.ts';
import {createProfile,freezeRunMeta} from '../src/next/meta/profile.ts';
import {prepareDeparture} from '../src/next/meta/departure.ts';
import {rosterIds,type RosterId} from '../src/next/meta/roster.ts';
import {createBattleAnimator,type BattleAnimationHooks} from '../src/next/ui/battleAnimator.ts';
import {createImashiruLight,transformationThenLight} from '../src/next/ui/imashiruLight.ts';
import {createRubyEruption,rubyTransformationApplies} from '../src/next/ui/rubyEruption.ts';
import {transformationIdentity} from '../src/next/ui/transformationIdentity.ts';
import {playTransformationWithSample} from '../src/next/audio/transformationSampleAudio.ts';
import type {TransformationRequest,TransformationResult} from '../src/next/ui/transformationCinematic.ts';
import type {AnimationMotion} from '../src/next/ui/animationTimeline.ts';
const main=readFileSync(new URL('../src/next/main.ts',import.meta.url),'utf8'),ast=ts.createSourceFile('main.ts',main,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
let actualTransform='';
function visit(n:ts.Node){if(ts.isCallExpression(n)&&n.expression.getText(ast)==='createBattleAnimator'){const arg=n.arguments[0];assert(arg&&ts.isObjectLiteralExpression(arg));const prop=arg.properties.find(p=>p.name?.getText(ast)==='transform');assert(prop&&ts.isPropertyAssignment(prop));actualTransform=prop.initializer.getText(ast);}ts.forEachChild(n,visit);}visit(ast);assert(actualTransform);
const actualHome=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='showHome')!.getText(ast);
function compile(code:string,scope:Record<string,unknown>){const js=ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;return new Function(...Object.keys(scope),js)(...Object.values(scope));}
const flush=()=>new Promise<void>(resolve=>setImmediate(resolve));
function setup(id:RosterId,motion:AnimationMotion,shortSetting=false){
 const p=createProfile();p.ownedCharacters=[...rosterIds];const config=prepareDeparture(freezeRunMeta(p,id,false),5).config;
 const before=createBattle({...config,initialGauge:gaugeDefinition(config.characterId,tuningOf(config))!.cap,initialBoxes:[{id:'own',row:7,col:0,owner:'player',type:'normal',status:'normal'},{id:'foe',row:7,col:5,owner:'enemy',type:'normal',status:'normal'}]});
 const result=applyAction(before,{type:'transform'});assert(result.accepted,id+' fixture');
 const trace:string[]=[],timers=new Map<number,()=>void>(),frames=new Map<number,FrameRequestCallback>(),canvases=new Set<any>();let seq=0;
 const win=Object.assign(new EventTarget(),{performance:{now:()=>0},devicePixelRatio:1.25,matchMedia:()=>({matches:false}),setTimeout:(f:()=>void)=>{timers.set(++seq,f);return seq;},clearTimeout:(n:number)=>timers.delete(n),requestAnimationFrame:(f:FrameRequestCallback)=>{frames.set(++seq,f);return seq;},cancelAnimationFrame:(n:number)=>frames.delete(n)});
 const ctx=new Proxy({createRadialGradient:()=>({addColorStop(){}})}, {get:(o,k)=>k in o?o[k as keyof typeof o]:()=>{},set:()=>true});
 const doc={defaultView:win,body:{dataset:{},append(c:any){canvases.add(c);}},createElement(){const c={style:{},width:0,height:0,className:'',setAttribute(){},getContext:()=>ctx,remove(){canvases.delete(c);}};return c;}};
 const board={ownerDocument:doc,isConnected:true,getBoundingClientRect:()=>({left:8,top:140,width:190,height:254})} as unknown as HTMLElement;
 const imashiru=createImashiruLight(board),ruby=createRubyEruption(board),abort=new AbortController();
 let portraitFinish!:(r:TransformationResult)=>void,portraitRequest:TransformationRequest|undefined,completed=false,shown=before;
 const effectCalls:{name:string;short:boolean}[]=[];
 const scope={audio:{playEvent(){}},transformCinematic:{play(r:TransformationRequest){portraitRequest=r;trace.push('portrait');return new Promise<TransformationResult>(resolve=>{portraitFinish=result=>{trace.push('portrait-end');resolve(result);};});}},playTransformationWithSample,transformationIdentity,transformationThenLight,rubyTransformationApplies,
 rosterPortrait:(id:string,changed=false)=>({src:id+(changed?'-after':'-before')+'.png'}),
 el:()=>({checked:shortSetting,close(){}}),
 imashiruLight:{clear:imashiru.clear,async play(signal:AbortSignal,m:AnimationMotion,short:boolean){effectCalls.push({name:'imashiru',short});trace.push('effect');await imashiru.play(signal,m,short);trace.push('effect-end');}},
 rubyEruption:{clear:ruby.clear,async play(event:object,signal:AbortSignal,m:AnimationMotion,short:boolean){effectCalls.push({name:'red',short});trace.push('effect');await ruby.play(event,signal,m,short);trace.push('effect-end');}}};
 const transform=compile('return ('+actualTransform+');',scope) as BattleAnimationHooks['transform'];
 const hooks:BattleAnimationHooks={motion:()=>motion,playSound(){},describe(){},observe(){},highlight(){},render(s){shown=s;if(id==='imashiru'&&s.boxes.find(b=>b.id==='own')?.type==='shiny')trace.push('shiny');},drop(){},react(){},feedback(){return {remove(){}};},pause:async()=>{},transform,complete(){completed=true;trace.push('complete');}};
 const showHome=compile(actualHome+';return showHome;',{...scope,skillActivationEffects:{clear(){}},profileStore:undefined}) as ()=>void;
 return {before,result,abort,trace,timers,frames,canvases,effectCalls,showHome,win,
 get portraitRequest(){return portraitRequest;},get shown(){return shown;},get completed(){return completed;},
 finishPortrait(status:TransformationResult['status']='completed'){portraitFinish({status});},
 run:()=>createBattleAnimator(hooks)(result.resolution!,before,result.state,abort.signal),
 finishEffect(){for(const [n,f]of [...frames]){frames.delete(n);f(10000);}}};
}
const cases=[{name:'normal',motion:{speed:'medium',short:false,lowMotion:false}},{name:'slow',motion:{speed:'slow',short:false,lowMotion:false}},{name:'fast',motion:{speed:'fast',short:true,lowMotion:false}},{name:'short-setting',motion:{speed:'medium',short:false,lowMotion:false},short:true},{name:'reduced',motion:{speed:'medium',short:false,lowMotion:true}}] as const;
for(const id of rosterIds)for(const mode of cases)test('actual main transform: '+id+' / '+mode.name,async()=>{
 const h=setup(id,mode.motion,'short' in mode&&mode.short),original=JSON.stringify({before:h.before,result:h.result}),pending=h.run();
 assert.equal(h.portraitRequest?.portraitCharacter,id);assert.equal(h.canvases.size,0);assert.equal(h.effectCalls.length,0);
 h.finishPortrait();await flush();
 const needs=id==='red'||id==='imashiru';assert.equal(h.effectCalls.length,needs?1:0);
 if(needs){assert.equal(h.effectCalls[0]!.name,id);assert.equal(h.effectCalls[0]!.short,mode.name==='short-setting');assert.equal(h.canvases.size,1);assert(!h.completed);assert.equal(h.shown.boxes.find(b=>b.id==='own')?.type,'normal');h.finishEffect();}
 await pending;
 assert(h.completed);assert.equal(h.canvases.size,0);assert.equal(h.frames.size,0);assert.equal(h.timers.size,0);
 if(needs){assert(h.trace.indexOf('portrait-end')<h.trace.indexOf('effect'));assert(h.trace.indexOf('effect-end')<h.trace.indexOf('complete'));}
 if(id==='imashiru')assert(h.trace.indexOf('effect-end')<h.trace.indexOf('shiny'));
 assert.deepEqual(h.shown,h.result.state);assert.equal(JSON.stringify({before:h.before,result:h.result}),original);
});
for(const id of ['red','imashiru'] as const){
 test('actual main skip runs one shortened '+id+' effect',async()=>{const h=setup(id,cases[0].motion),p=h.run();h.finishPortrait('skipped');await flush();assert.deepEqual(h.effectCalls,[{name:id,short:true}]);h.finishEffect();await p;assert.equal(h.canvases.size,0);});
 for(const phase of ['portrait','effect'] as const)test('actual main cancellation during '+id+' '+phase,async()=>{
  const h=setup(id,cases[0].motion),p=h.run();
  if(phase==='effect'){h.finishPortrait();await flush();assert.equal(h.canvases.size,1);}
  h.abort.abort();if(phase==='portrait')h.finishPortrait('cancelled');await p;
  assert(!h.completed);assert.equal(h.canvases.size,0);assert.equal(h.frames.size,0);assert.equal(h.timers.size,0);assert(!h.trace.includes('shiny'));
 });
 test('actual main showHome clears live '+id+' effect',async()=>{
  const h=setup(id,cases[0].motion),p=h.run();h.finishPortrait();await flush();assert.equal(h.canvases.size,1);h.showHome();assert.equal(h.canvases.size,0);await p;assert.equal(h.frames.size,0);assert.equal(h.timers.size,0);
 });
}
