import {createBlueHealingLight} from '../src/next/ui/blueHealingLight.ts';
import {createSkill} from '../src/next/core/playerBuild.ts';
import {skillCatalog} from '../src/next/core/skillCatalog.ts';
import {skillHudHtml} from '../src/next/ui/skillHud.ts';
import {healingHudTargets,equippedHealingSlots,isHealingSkill} from '../experiments/blue-transformation/healingTargets.ts';
import {blueSkillFlightPoint} from '../experiments/blue-transformation/effect.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {blueDuration,blueScene,blueOrigin,blueFlightPoint,bluePetalPoint,paintBlueTransformation,createBlueTransformation,bluePreviewApplies,type BlueVariant} from '../experiments/blue-transformation/effect.ts';
import {createBattle,applyAction,gaugeDefinition,tuningOf} from '../src/next/core/index.ts';
import {createProfile,freezeRunMeta} from '../src/next/meta/profile.ts';
import {prepareDeparture} from '../src/next/meta/departure.ts';
import {rosterIds} from '../src/next/meta/roster.ts';
import {createBattleAnimator,type BattleAnimationHooks} from '../src/next/ui/battleAnimator.ts';
import {transformationIdentity} from '../src/next/ui/transformationIdentity.ts';
import {transformationThenLight} from '../src/next/ui/imashiruLight.ts';
import type {AnimationMotion} from '../src/next/ui/animationTimeline.ts';
const variants:BlueVariant[]=['ripple','tide','petals'],normal:AnimationMotion={speed:'medium',short:false,lowMotion:false};
function harness(width=375,height=667){
 const old=globalThis.ResizeObserver,observers=new Set<()=>void>();globalThis.ResizeObserver=class{callback:()=>void;constructor(fn:()=>void){this.callback=fn;observers.add(fn);}observe(){}disconnect(){observers.delete(this.callback);}} as unknown as typeof ResizeObserver;
 const frames=new Map<number,FrameRequestCallback>(),timers=new Map<number,{fn:()=>void;due:number}>(),canvases=new Set<any>(),calls:{name:string;args:unknown[]}[]=[],colors:string[]=[];let id=0,now=0;
 const media=Object.assign(new EventTarget(),{matches:false});const win=Object.assign(new EventTarget(),{innerWidth:width,innerHeight:height,devicePixelRatio:1.25,performance:{now:()=>now},matchMedia:()=>media,requestAnimationFrame:(f:FrameRequestCallback)=>{frames.set(++id,f);return id;},cancelAnimationFrame:(n:number)=>frames.delete(n),setTimeout:(fn:()=>void,ms:number)=>{timers.set(++id,{fn,due:now+ms});return id;},clearTimeout:(n:number)=>timers.delete(n)});
 const ctx=new Proxy({createRadialGradient(...args:number[]){assert(args.every(Number.isFinite));return {addColorStop(n:number,c:string){assert(n>=0&&n<=1);colors.push(c);}};}},{get(o,k){if(k in o)return o[k as keyof typeof o];return (...args:unknown[])=>{assert(args.every(v=>typeof v!=='number'||Number.isFinite(v)));if(k==='arc')assert(Number(args[2])>=0);calls.push({name:String(k),args});};},set(){return true;}});
 const doc={defaultView:win,body:{dataset:{} as Record<string,string>,append(c:any){canvases.add(c);}},createElement(){return {style:{},width:0,height:0,setAttribute(){},getContext:()=>ctx,remove(){canvases.delete(this);}};}};
 const bw=Math.min(264,width-32,(height-175)*.75),br={left:(width-bw)/2,top:114,width:bw,height:bw*8/6},er={left:width-80,top:8,width:64,height:88};
 const board={ownerDocument:doc,isConnected:true,getBoundingClientRect:()=>({...br})} as unknown as HTMLElement,enemy={ownerDocument:doc,isConnected:true,getBoundingClientRect:()=>({...er})} as unknown as HTMLElement;
 const boxes=[0,1,2,3,4,5].map(i=>({left:br.left+(i%3)*bw/6,top:br.top+br.height*(.7+(i%2)*.14),width:bw/6-2,height:bw/6-2}));
 const boxNodes=boxes.map(r=>({getBoundingClientRect:()=>r})) as HTMLElement[];
 return {win,doc,media,frames,timers,canvases,calls,colors,ctx:ctx as unknown as CanvasRenderingContext2D,board,enemy,br,er,boxes,boxNodes,scene:blueScene(width,height,br,er,boxes)!,tick(ms:number){now+=ms;for(const [n,f]of [...frames]){frames.delete(n);f(now);}for(const [n,t]of [...timers])if(t.due<=now){timers.delete(n);t.fn();}},stall(ms:number){now+=ms;for(const [n,t]of [...timers])if(t.due<=now){timers.delete(n);t.fn();}},layout(){for(const fn of [...observers])fn();},restore(){globalThis.ResizeObserver=old;}};
}
for(const kind of variants)for(const [w,h]of [[320,568],[375,667],[667,375]] as const)test(kind+' finite blue-white soft geometry at '+w+'x'+h,t=>{
 const dom=harness(w,h);t.after(()=>dom.restore());const unchanged=JSON.stringify(dom.scene);for(const p of [0,.2,.48,.76,.87,.96])paintBlueTransformation(dom.ctx,dom.scene,kind,p);assert(dom.calls.some(c=>c.name==='arc'));assert(!dom.calls.some(c=>c.name==='stroke'||c.name==='fillRect'));for(const c of dom.colors){const rgb=c.match(/rgba[(]([0-9]+),([0-9]+),([0-9]+)/)!.slice(1).map(Number);assert(rgb[2]!>=rgb[0]!);}
 assert.deepEqual(blueFlightPoint(dom.scene,kind,0),blueOrigin(dom.scene,kind));assert.deepEqual(blueFlightPoint(dom.scene,kind,1),dom.scene.enemy);for(const p of [0,.25,.5,.75,1]){const q=blueFlightPoint(dom.scene,kind,p);assert(q.x>=0&&q.x<=w&&q.y>=0&&q.y<=h);}
 dom.calls.length=0;paintBlueTransformation(dom.ctx,dom.scene,kind,1);assert.deepEqual(dom.calls.map(c=>c.name),['clearRect']);assert.equal(JSON.stringify(dom.scene),unchanged);
});
test('normal/slow/fast/short/reduced timing is bounded and healing owns the first 72 percent',()=>{assert.equal(blueDuration(normal),1300);assert.equal(blueDuration({...normal,speed:'slow'}),1950);assert.equal(blueDuration({...normal,speed:'fast'}),520);assert.equal(blueDuration(normal,true),520);assert.equal(blueDuration({...normal,lowMotion:true}),420);});
test('petals approach separate boxes without a two-arm orbit and share a late source',t=>{const d=harness();t.after(()=>d.restore());const starts=Array.from({length:6},(_,i)=>bluePetalPoint(d.scene,i,0));assert.equal(new Set(starts.map(p=>JSON.stringify(p))).size,6);for(let i=0;i<6;i++){const end=bluePetalPoint(d.scene,i,.8),origin=blueOrigin(d.scene,'petals');assert(Math.abs(end.x-origin.x)<.00001&&Math.abs(end.y-origin.y)<.00001);}});
const modes=[{label:'normal',motion:normal,short:false},{label:'slow',motion:{...normal,speed:'slow' as const},short:false},{label:'fast',motion:{...normal,speed:'fast' as const},short:false},{label:'short',motion:normal,short:true},{label:'reduced',motion:{...normal,lowMotion:true},short:false}];
for(const kind of [...variants,'skills' as const])for(const mode of modes)test(kind+' lifecycle / '+mode.label,t=>{
 const d=harness();t.after(()=>d.restore());const ui=createBlueTransformation(d.board,d.enemy,()=>d.boxNodes),signal=new AbortController().signal,p=ui.play(kind,signal,mode.motion,{short:mode.short});assert(ui.active);assert.equal(d.canvases.size,1);const ms=blueDuration(mode.motion,mode.short);d.tick(ms-1);assert(ui.active);d.tick(1);assert(!ui.active);assert.equal(d.canvases.size,0);assert.equal(d.frames.size,0);assert.equal(d.timers.size,0);return p;
});
for(const kind of [...variants,'skills' as const])for(const action of ['abort','resize','enemy-layout','home','pagehide'] as const)test(kind+' cleanup / '+action,async t=>{
 const d=harness();t.after(()=>d.restore());const ui=createBlueTransformation(d.board,d.enemy,()=>d.boxNodes),a=new AbortController(),p=ui.play(kind,a.signal,normal);assert(ui.active);if(action==='abort')a.abort();else if(action==='home')ui.clear();else if(action==='enemy-layout'){if(kind==='skills')d.br.left--;else d.er.left--;d.layout();}else d.win.dispatchEvent(new Event(action));await p;assert(!ui.active);assert.equal(d.frames.size,0);assert.equal(d.timers.size,0);assert.equal(d.canvases.size,0);
});
for(const kind of [...variants,'skills' as const])test(kind+' pause/seek/resume and slow observation use one clock and bounded cleanup',async t=>{
 const d=harness();t.after(()=>d.restore());const ui=createBlueTransformation(d.board,d.enemy,()=>d.boxNodes),p=ui.play(kind,new AbortController().signal,normal,{rate:.1});d.tick(1300);ui.pause();assert.equal(d.frames.size,0);d.tick(5000);assert(ui.active);ui.seek(.76);ui.resume();d.tick(3120);await p;assert(!ui.active);assert.equal(d.timers.size,0);
 const still=ui.play(kind,new AbortController().signal,normal,{at:.48});assert.equal(d.frames.size,0);d.stall(60000);await still;assert(!ui.active);assert.equal(d.canvases.size,0);
});
test('abort before play, replacement, stalled RAF and live OS reduction leave no resources',async t=>{
 const d=harness();t.after(()=>d.restore());const ui=createBlueTransformation(d.board,d.enemy,()=>d.boxNodes);await ui.play('ripple',AbortSignal.abort(),normal);assert.equal(d.canvases.size,0);
 const a=new AbortController(),old=ui.play('ripple',a.signal,normal),next=ui.play('tide',new AbortController().signal,normal);await old;a.abort();assert(ui.active);assert.equal(d.canvases.size,1);d.stall(1400);await next;assert(!ui.active);
 const low=ui.play('petals',new AbortController().signal,normal);d.media.matches=true;d.media.dispatchEvent(new Event('change'));await low;assert.equal(d.canvases.size,0);assert.equal(d.timers.size,0);
});
test('stationary reduced presentation does not draw a moving ribbon, ripple or petal',t=>{const d=harness();t.after(()=>d.restore());for(const kind of variants){d.calls.length=0;paintBlueTransformation(d.ctx,d.scene,kind,.5,true);assert.equal(d.calls.filter(c=>c.name==='arc').length,2);}assert.equal(blueScene(320,568,{...d.br,width:0},d.er,d.boxes),null);});
test('blue preview recognizes the actual roster identity and excludes legacy kits of other characters',()=>{const event={type:'transformation',character:'blue',cost:80,before:80,after:0} as const;for(const id of rosterIds){const config=prepareDeparture(freezeRunMeta({...createProfile(),ownedCharacters:[...rosterIds]},id,false),11).config;assert.equal(bluePreviewApplies(config,event),id==='blue');}});
const source=readFileSync(new URL('../experiments/blue-transformation/check.ts',import.meta.url),'utf8'),ast=ts.createSourceFile('check.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);let transform='';function visit(n:ts.Node){if(ts.isCallExpression(n)&&n.expression.getText(ast)==='createBattleAnimator'){const a=n.arguments[0];assert(a&&ts.isObjectLiteralExpression(a));const p=a.properties.find(p=>p.name?.getText(ast)==='transform');assert(p&&ts.isPropertyAssignment(p));transform=p.initializer.getText(ast);}ts.forEachChild(n,visit);}visit(ast);
for(const kind of [...variants,'skills' as const])test(kind+' waits for the actual portrait hook before extra light and never changes committed HP/RNG',async t=>{
 const d=harness();t.after(()=>d.restore());const config=prepareDeparture(freezeRunMeta(createProfile(),'blue',false),11).config,before=createBattle({...config,initialGauge:gaugeDefinition(config.characterId,tuningOf(config))!.cap}),r=applyAction(before,{type:'transform'});assert(r.accepted);const snapshot=JSON.stringify({before,r}),signal=new AbortController().signal,effect=createBlueTransformation(d.board,d.enemy,()=>d.boxNodes);let complete=false,finish!:(x:{status:'completed'})=>void;
 const scope={before,bluePreviewApplies,transformationIdentity,transformationThenLight,signal,motion:normal,emit(){},rosterPortrait:()=>({src:'stub'}),cinematic:{play:()=>new Promise(resolve=>{finish=resolve;})},additional:()=>effect.play(kind,signal,normal)};
 const js=ts.transpileModule('return ('+transform+');',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,hook=new Function(...Object.keys(scope),js)(...Object.values(scope)) as BattleAnimationHooks['transform'];
 const pending=createBattleAnimator({motion:()=>normal,playSound(){},describe(){},observe(){},highlight(){},render(){},drop(){},react(){},feedback(){return {remove(){}};},transform:hook,complete(){complete=true;},pause:async()=>{}})(r.resolution!,before,r.state,signal);
 assert.equal(d.canvases.size,0);finish({status:'completed'});await new Promise<void>(resolve=>setImmediate(resolve));assert.equal(d.canvases.size,1);assert(!complete);d.tick(1300);await pending;assert(complete);assert.equal(JSON.stringify({before,r}),snapshot);assert.deepEqual(r.state.hp,before.hp);assert.equal(r.state.rngState,before.rngState);
});
test('preview contains no storage or added gameplay actions and production has no prototype import',()=>{const renderer=readFileSync(new URL('../src/next/ui/blueTransformationLight.ts',import.meta.url),'utf8'),main=readFileSync(new URL('../src/next/main.ts',import.meta.url),'utf8');assert.doesNotMatch(renderer,/Math.random|localStorage|sessionStorage|applyAction|setInterval/);assert.doesNotMatch(source,/localStorage|sessionStorage|indexedDB/);assert.doesNotMatch(main,/blue-transformation|createBlueTransformation/);});

test('browser DOMRect prototype accessors are copied into stable scene coordinates',()=>{
 const rect=Object.create({get left(){return 50;},get top(){return 114;},get width(){return 264;},get height(){return 352;}});
 assert.deepEqual(Object.keys(rect),[]);
 const scene=blueScene(375,667,rect,{left:295,top:8,width:64,height:88},[]);
 assert.deepEqual(scene?.board,{left:50,top:114,width:264,height:352});
 assert.deepEqual(blueOrigin(scene!,'ripple'),{x:182,y:282.96});
});

function healingState(){const c=prepareDeparture(freezeRunMeta(createProfile(),'blue',false),11).config,s=createBattle(c);return {...s,build:{...s.build!,slots:[createSkill('rescue-kit'),createSkill('healing-potion'),createSkill('magic-bullet'),createSkill('capacitor')] as [ReturnType<typeof createSkill>,ReturnType<typeof createSkill>,...ReturnType<typeof createSkill>[]]}};}
function hudFixture(width=375,height=667){
 const state=healingState(),html=skillHudHtml(state,false),rect=(left:number,top:number,w=44,h=44)=>({left,top,width:w,height:h,right:left+w,bottom:top+h});
 const win={innerWidth:width,innerHeight:height,getComputedStyle:(el:any)=>({display:'flex',visibility:'visible',opacity:'1',overflowX:'visible',overflowY:'visible',...el.style})},doc={defaultView:win};
 const root:any={ownerDocument:doc,hidden:false,parentElement:null,style:{},getAttribute:()=>null,getBoundingClientRect:()=>rect(8,height-80,width-16,60)};
 const nodes=[...html.matchAll(/class="(hud-skill [^"]+)" data-skill-info="([0-9]+)"/g)].map(m=>{const box=rect(18+Number(m[2])*49,height-72);return {box,ownerDocument:doc,parentElement:root,style:{},hidden:false,isConnected:true,getClientRects:()=>[box],getBoundingClientRect:()=>box,getAttribute:()=>null,classList:{contains:(name:string)=>m[1]!.split(' ').includes(name)},index:Number(m[2])};});
 root.querySelector=(query:string)=>nodes.find(n=>query.includes('"'+n.index+'"'))??null;
 return {state,root:root as HTMLElement,nodes,html};
}
test('HP-healing classification uses shared definition tags, not names or preview-generated targets',()=>{
 assert.deepEqual(Object.keys(skillCatalog).filter(id=>isHealingSkill(id as keyof typeof skillCatalog)).sort(),['healing-potion','health','rescue-kit']);
 const state=healingState(),before=JSON.stringify(state);assert.deepEqual(equippedHealingSlots(state).map(x=>x.index),[0,1,2]);assert.equal(JSON.stringify(state),before);
 assert.equal(isHealingSkill('capacitor'),false);assert.equal(isHealingSkill('charge'),false);assert.equal(isHealingSkill('clear-column'),false);assert.equal(equippedHealingSlots({build:null}).length,0);
});
test('real HUD markup and equipped slot indexes select all and only visible healing buttons, even disabled',()=>{
 const f=hudFixture();assert.match(f.html,/disabled/);assert.deepEqual(healingHudTargets(f.root,f.state),f.nodes.slice(0,3));
 f.nodes[1]!.hidden=true;assert.deepEqual(healingHudTargets(f.root,f.state),[f.nodes[0],f.nodes[2]]);
 f.nodes[2]!.style={visibility:'hidden'};assert.deepEqual(healingHudTargets(f.root,f.state),[f.nodes[0]]);
 f.root.hidden=true;assert.deepEqual(healingHudTargets(f.root,f.state),[]);
});
test('unowned, depleted, stale, clipped, offscreen and disconnected HUD targets are skipped',()=>{
 const f=hudFixture();const depleted={...f.state,build:{...f.state.build,slots:[{...createSkill('healing-potion'),uses:0},null] as const}};assert.deepEqual(equippedHealingSlots(depleted).map(x=>x.index),[0]);
 const one={...f.state,build:{...f.state.build,slots:[createSkill('magic-bullet'),createSkill('capacitor')] as const}};assert.deepEqual(healingHudTargets(f.root,one),[f.nodes[0]]);
 f.nodes[0]!.isConnected=false;f.nodes[1]!.box.left=-1;f.nodes[2]!.box.right=400;assert.deepEqual(healingHudTargets(f.root,f.state),[]);
 const clipped=hudFixture();Object.assign(clipped.root,{style:{overflowX:'hidden'},getBoundingClientRect:()=>({left:0,top:0,right:30,bottom:667})});assert.deepEqual(healingHudTargets(clipped.root,clipped.state),[]);
});
for(const [w,h] of [[320,568],[375,667],[667,375]] as const)test('improved ripple lands at real HUD centers at '+w+'x'+h,t=>{
 const d=harness(w,h),f=hudFixture(w,h);t.after(()=>d.restore());const targets=healingHudTargets(f.root,f.state).map(n=>{const r=n.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};}),scene={...d.scene,healingTargets:targets};
 assert.equal(targets.length,3);for(const target of targets){assert.deepEqual(blueSkillFlightPoint(scene,target,0),blueOrigin(scene,'ripple'));assert.deepEqual(blueSkillFlightPoint(scene,target,1),target);for(const p of [0,.25,.5,.75,1]){const at=blueSkillFlightPoint(scene,target,p);assert(at.x>=0&&at.x<=w&&at.y>=0&&at.y<=h);}}
 for(const p of [.3,.48,.65,.8,.9,.96])paintBlueTransformation(d.ctx,scene,'skills',p);
 assert(!d.calls.some(c=>c.name==='translate'&&c.args[0]===scene.enemy.x&&c.args[1]===scene.enemy.y));
 for(const target of targets)assert(d.calls.some(c=>c.name==='arc'&&c.args[0]===target.x&&c.args[1]===target.y));
 assert(!d.calls.some(c=>c.name==='stroke'));d.calls.length=0;paintBlueTransformation(d.ctx,scene,'skills',.5,true);assert.equal(d.calls.filter(c=>c.name==='arc').length,4);
});
test('improved ripple preserves the original early board appearance; zero targets add no transfer or enemy flash',t=>{
 const d=harness();t.after(()=>d.restore());paintBlueTransformation(d.ctx,d.scene,'ripple',.48);const original=JSON.stringify({calls:d.calls,colors:d.colors});d.calls.length=0;d.colors.length=0;paintBlueTransformation(d.ctx,d.scene,'skills',.48);assert.equal(JSON.stringify({calls:d.calls,colors:d.colors}),original);
 d.calls.length=0;paintBlueTransformation(d.ctx,{...d.scene,healingTargets:[]},'skills',.96);assert(!d.calls.some(c=>c.name==='arc'||c.name==='translate'));
});
for(const n of [0,1,3])test('improved ripple has one bounded duration with '+n+' HUD targets',async t=>{
 const d=harness(),f=hudFixture();t.after(()=>d.restore());const nodes=healingHudTargets(f.root,f.state).slice(0,n),ui=createBlueTransformation(d.board,d.enemy,()=>d.boxNodes,()=>nodes),p=ui.play('skills',new AbortController().signal,normal);d.tick(1299);assert(ui.active);d.tick(1);await p;assert(!ui.active);assert.equal(d.canvases.size,0);assert.equal(d.timers.size,0);
});
test('HUD layout changes, removal, rapid replay and cancel release every improved-ripple resource',async t=>{
 const d=harness(),f=hudFixture();t.after(()=>d.restore());const ui=createBlueTransformation(d.board,d.enemy,()=>d.boxNodes,()=>healingHudTargets(f.root,f.state)),signal=new AbortController().signal;
 const moved=ui.play('skills',signal,normal);f.nodes[0]!.box.left+=5;d.layout();await moved;assert(!ui.active);
 const shifted=ui.play('skills',signal,normal);f.nodes[1]!.box.top-=3;d.tick(10);await shifted;assert(!ui.active);
 const hidden=ui.play('skills',signal,normal);f.nodes[2]!.hidden=true;d.tick(10);await hidden;assert(!ui.active);f.nodes[2]!.hidden=false;
 const removed=ui.play('skills',signal,normal);f.nodes[0]!.isConnected=false;d.tick(10);await removed;assert(!ui.active);
 const runs=Array.from({length:12},()=>ui.play('skills',signal,normal));assert.equal(d.canvases.size,1);ui.clear();await Promise.all(runs);assert.equal(d.canvases.size,0);assert.equal(d.frames.size,0);assert.equal(d.timers.size,0);
});

test('production blue wrapper targets real equipped HUD slots once per event and cleans replacement/cancel',async t=>{
 const d=harness(),f=hudFixture();t.after(()=>d.restore());Object.assign(d.board,{querySelectorAll:()=>d.boxNodes});const ui=createBlueHealingLight(d.board,f.root,()=>f.state),signal=new AbortController().signal,event={},p=ui.play(event,signal,normal);assert.equal(d.canvases.size,1);await ui.play(event,signal,normal);assert.equal(d.canvases.size,1);d.tick(1300);await p;await ui.play(event,signal,normal);assert.equal(d.canvases.size,0);
 const fresh=ui.play({},signal,normal);assert.equal(d.canvases.size,1);ui.clear();await fresh;assert.equal(d.canvases.size,0);assert.equal(d.frames.size,0);assert.equal(d.timers.size,0);
});
