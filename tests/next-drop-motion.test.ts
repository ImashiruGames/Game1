import {captureAnimationMotion} from '../src/next/ui/animationTimeline.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createDropMotion,dropMotionGeometry,dropMotionFrames,DROP_MOTION_TIMING} from '../src/next/ui/dropMotion.ts';
import type {DropEvent} from '../src/next/core/types.ts';
import {kineticDom,KineticNode} from './helpers/kineticDom.ts';

const full={short:false,lowMotion:false};
const event=(start=0,end=7):DropEvent=>({type:'drop',actor:'player',box:{id:'drop:1',row:end,col:0,owner:'player',type:'normal',status:'normal'},candidateId:`ceiling:0:${start}`,spawn:{row:start,col:0},landing:{row:end,col:0},path:Array.from({length:end-start+1},(_,i)=>({row:i+start,col:0}))});
const rect=(row:number)=>({left:40,top:80+row*44,width:42,height:42});
const area={left:8,top:8,width:374,height:520};

test('emitted path keeps internal ceiling and final landing; every visual point comes from a real cell',()=>{
 const drop=event(4,6),before=JSON.stringify(drop),geometry=dropMotionGeometry(drop,area,drop.path.map(p=>rect(p.row)))!;
 assert.deepEqual(geometry.points,[{x:32,y:248},{x:32,y:292},{x:32,y:336}]);
 const frames=dropMotionFrames(geometry);assert.equal(frames[0]!.transform,'translate(32px, 248px) scaleY(1)');assert.equal(frames.at(-1)!.transform,'translate(32px, 336px) scaleY(1)');
 assert.equal(frames[2]!.offset,120/180);assert.equal(frames.at(-1)!.offset,1);assert.equal(DROP_MOTION_TIMING.total,180);assert.equal(JSON.stringify(drop),before);
});
test('one-cell route lands in its actual cell and never invents a spawn above a ceiling',()=>{
 const drop=event(4,4),geometry=dropMotionGeometry(drop,area,[rect(4)])!;
 assert.ok(dropMotionFrames(geometry).every(frame=>String(frame.transform).startsWith('translate(32px, 248px)')));
});
test('invalid route, skipped terrain, stale geometry, wrong landing and non-finite coordinates fail closed',()=>{
 const drop=event(0,2),rects=drop.path.map(p=>rect(p.row));
 for(const invalid of [{...drop,path:[]},{...drop,spawn:{row:1,col:0}},{...drop,landing:{row:1,col:0}},{...drop,box:{...drop.box,row:1}},{...drop,path:[drop.path[0]!,drop.path[2]!]},{...drop,path:[drop.path[0]!,{row:1,col:1},drop.path[2]!]}])assert.equal(dropMotionGeometry(invalid,area,rects),null);
 assert.equal(dropMotionGeometry(drop,area,[rect(0),{...rect(1),width:41},rect(2)]),null);
 assert.equal(dropMotionGeometry(drop,area,[rect(0),{...rect(1),top:NaN},rect(2)]),null);
 assert.equal(dropMotionGeometry(drop,area,[rect(0),{...rect(1),left:44},rect(2)]),null);
 assert.equal(dropMotionGeometry(drop,{...area,height:90},rects),null);
});
test('normal drop decorates only the committed cell and unmasks at 180ms without changing its inline styles',t=>{
 const dom=kineticDom();t.after(()=>dom.restore());const motion=createDropMotion(dom.root.asElement()),drop=event();dom.cells[7]!.classList.add('player');dom.cells[7]!.style.opacity='.8';
 assert.equal(motion.play(drop,{motion:full}),true);const layer=dom.area.querySelector<KineticNode>('.kinetic-drop-layer')!;assert.equal(layer.getAttribute('aria-hidden'),'true');assert.equal(dom.cells[7]!.classList.contains('kinetic-drop-masked'),true);assert.equal(layer.children[0]!.animations[0]!.options.duration,180);
 assert.equal(dom.timers.size,1);dom.tick(179);assert.equal(layer.isConnected,true);dom.tick(1);assert.equal(layer.isConnected,false);assert.equal(dom.cells[7]!.classList.contains('kinetic-drop-masked'),false);assert.equal(dom.cells[7]!.style.opacity,'.8');assert.equal(dom.timers.size,0);motion.dispose();
});
test('short, reduced, pre-aborted, duplicate, unavailable WAAPI and failed WAAPI never hide the final box',t=>{
 const dom=kineticDom();t.after(()=>dom.restore());const motion=createDropMotion(dom.root.asElement());dom.cells[7]!.classList.add('player');
 assert.equal(motion.play(event(),{motion:{...full,short:true}}),false);assert.equal(motion.play(event(),{motion:{...full,lowMotion:true}}),false);const signal=AbortSignal.abort();assert.equal(motion.play(event(),{motion:full,signal}),false);
 const drop=event();motion.play(drop,{motion:full});motion.clear();assert.equal(motion.play(drop,{motion:full}),false);
 dom.failNewAnimations();assert.equal(motion.play(event(),{motion:full}),false);dom.omitWAAPI();assert.equal(motion.play(event(),{motion:full}),false);
 assert.equal(dom.cells[7]!.classList.contains('kinetic-drop-masked'),false);assert.equal(dom.area.querySelector('.kinetic-drop-layer'),null);assert.equal(dom.timers.size,0);motion.dispose();
});
test('terrain, invalid, missing and wrong-owner landing cells cannot be covered by a decorative fall',t=>{
 const dom=kineticDom();t.after(()=>dom.restore());const motion=createDropMotion(dom.root.asElement());dom.cells[7]!.classList.add('player');
 dom.cells[3]!.classList.add('terrain');assert.equal(motion.play(event(),{motion:full}),false);dom.cells[3]!.classList.remove('terrain');dom.cells[3]!.classList.add('invalid');assert.equal(motion.play(event(),{motion:full}),false);dom.cells[3]!.classList.remove('invalid');
 dom.cells[7]!.classList.remove('player');assert.equal(motion.play(event(),{motion:full}),false);dom.cells[7]!.classList.add('player');dom.cells[2]!.remove();assert.equal(motion.play(event(),{motion:full}),false);assert.equal(dom.area.querySelector('.kinetic-drop-layer'),null);motion.dispose();
});
test('abort, clear, window resize, layout resize, pagehide and dispose reveal the real box immediately',t=>{
 const dom=kineticDom();t.after(()=>dom.restore());const motion=createDropMotion(dom.root.asElement());dom.cells[7]!.classList.add('player');
 const clean=()=>{assert.equal(dom.cells[7]!.classList.contains('kinetic-drop-masked'),false);assert.equal(dom.area.querySelector('.kinetic-drop-layer'),null);assert.equal(dom.timers.size,0);};
 const abort=new AbortController();motion.play(event(),{motion:full,signal:abort.signal});abort.abort();clean();
 motion.play(event(),{motion:full});motion.clear();clean();
 motion.play(event(),{motion:full});dom.fire('resize');clean();
 motion.play(event(),{motion:full});dom.layout();assert.equal(dom.cells[7]!.classList.contains('kinetic-drop-masked'),true);dom.area.rect.width-=1;dom.layout();clean();
 motion.play(event(),{motion:full});dom.fire('pagehide');clean();
 motion.play(event(),{motion:full});motion.dispose();clean();assert.equal(motion.play(event(),{motion:full}),false);assert.equal(dom.listenerCount('resize'),0);assert.equal(dom.listenerCount('pagehide'),0);
});
test('old timer/abort cleanup after re-render cannot affect the newer committed box or animation',t=>{
 const dom=kineticDom();t.after(()=>dom.restore());const motion=createDropMotion(dom.root.asElement());const original=dom.cells[7]!;original.classList.add('player');const signal=new AbortController();
 motion.play(event(),{motion:full,signal:signal.signal});const staleTimer=[...dom.timers.values()][0]!.fn;original.remove();
 const replacement=new KineticNode();replacement.className='cell player';replacement.dataset={...original.dataset};replacement.rect={...original.rect};replacement.style.opacity='.7';dom.board.append(replacement);
 motion.play({...event(),box:{...event().box,id:'drop:2'}},{motion:full});assert.equal(original.classList.contains('kinetic-drop-masked'),false);assert.equal(replacement.classList.contains('kinetic-drop-masked'),true);
 staleTimer();signal.abort();assert.equal(replacement.classList.contains('kinetic-drop-masked'),true);assert.equal(dom.area.children.filter(n=>n.className==='kinetic-drop-layer').length,1);dom.tick(180);assert.equal(replacement.classList.contains('kinetic-drop-masked'),false);assert.equal(replacement.style.opacity,'.7');motion.dispose();
});
test('live UI or OS motion changes cancel an active fall without lengthening an existing 15ms budget',t=>{
 const dom=kineticDom();t.after(()=>dom.restore());const motion=createDropMotion(dom.root.asElement());dom.cells[7]!.classList.add('player');
 motion.play(event(),{motion:full});dom.settings({short:true,lowMotion:false});assert.equal(dom.cells[7]!.classList.contains('kinetic-drop-masked'),false);assert.equal(dom.timers.size,0);assert.equal(motion.play(event(),{motion:full}),false);
 dom.settings({short:false,lowMotion:false});assert.equal(motion.play(event(),{motion:{short:true,lowMotion:true}}),false);assert.equal(motion.play(event(),{motion:full}),true);dom.systemMotion(true);assert.equal(dom.area.querySelector('.kinetic-drop-layer'),null);assert.equal(dom.cells[7]!.classList.contains('kinetic-drop-masked'),false);assert.equal(motion.play(event(),{motion:full}),false);
 dom.systemMotion(false);assert.equal(motion.play(event(),{motion:full}),true);dom.settings({short:false,lowMotion:true});assert.equal(dom.area.querySelector('.kinetic-drop-layer'),null);assert.equal(motion.play(event(),{motion:full}),false);motion.dispose();
});
test('initial mount and reset have no replay, draw, sound, layout change, or additional event wait',t=>{
 const dom=kineticDom();t.after(()=>dom.restore());const motion=createDropMotion(dom.root.asElement());assert.equal(dom.timers.size,0);assert.equal(dom.area.children.length,1);motion.clear();motion.dispose();
 const source=readFileSync(new URL('../src/next/ui/dropMotion.ts',import.meta.url),'utf8'),css=readFileSync(new URL('../src/next/ui/dropMotion.css',import.meta.url),'utf8');
 assert.doesNotMatch(source,/Math\.random|applyAction|controller\.|localStorage|Audio|setInterval|await\s|async\s/);assert.doesNotMatch(css,/grid-template|position:fixed|height:100|infinite/);assert.match(css,/pointer-events:none/);assert.match(css,/prefers-reduced-motion/);
});

test('captured action keeps its fall on a speed toggle, adopts short on the next action, and still honors OS safety',t=>{
 const dom=kineticDom();t.after(()=>dom.restore());const motion=createDropMotion(dom.root.asElement());dom.cells[7]!.classList.add('player');
 const captured=captureAnimationMotion(full);assert(motion.play(event(),{motion:captured}));dom.settings({short:true,lowMotion:false});
 assert(dom.cells[7]!.classList.contains('kinetic-drop-masked'));dom.tick(179);assert(dom.cells[7]!.classList.contains('kinetic-drop-masked'));dom.tick(1);assert(!dom.cells[7]!.classList.contains('kinetic-drop-masked'));
 assert.equal(motion.play(event(),{motion:captureAnimationMotion({short:true,lowMotion:false})}),false);
 dom.settings(full);assert(motion.play(event(),{motion:captured}));dom.systemMotion(true);assert(!dom.cells[7]!.classList.contains('kinetic-drop-masked'));assert.equal(motion.play(event(),{motion:captured}),false);motion.dispose();
});
