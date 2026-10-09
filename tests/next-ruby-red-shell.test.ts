import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRubyDropCandidates,RED_EMBER_COUNT,RED_SHELL_BACKGROUND,redEmberFrames} from '../experiments/ruby-auto-drop/candidates.ts';
import {seekDropFrame} from '../experiments/ruby-auto-drop/playback.ts';
import {createDropMotion} from '../src/next/ui/dropMotion.ts';
import {captureAnimationMotion} from '../src/next/ui/animationTimeline.ts';
import {boardSkillDom} from './helpers/boardSkillDom.ts';
import {type KineticNode} from './helpers/kineticDom.ts';
import type {DropEvent} from '../src/next/core/types.ts';
const event=():DropEvent=>({type:'drop',actor:'player',box:{id:'red:1',row:7,col:2,owner:'player',type:'normal',status:'normal'},candidateId:'ceiling:2:0',spawn:{row:0,col:2},landing:{row:7,col:2},path:Array.from({length:8},(_,row)=>({row,col:2}))});
function setup(duration=180){
 const dom=boardSkillDom();dom.cell(7,2).classList.add('player');const ui=createDropMotion(dom.root.asElement()),candidate=createRubyDropCandidates(document),motion=captureAnimationMotion({speed:'medium',short:false,lowMotion:false},duration);
 function play(signal=new AbortController().signal){assert(ui.play(event(),{motion,rubyAutoDrop:true,signal}));const f=dom.area.querySelector<KineticNode>('.ruby-drop-flame')!,a=f.animations[0]!;
  // Add the browser clock inspection surface to this deterministic WAAPI harness.
  Object.assign(a,{effect:{getTiming:()=>({duration})}});Object.defineProperty(f,'parentElement',{value:f.parent!.asElement()});Object.assign(f,{getAnimations:()=>f.animations});candidate.apply(f.asElement(),'red-shell');return {f,a,dots:f.children.filter(c=>c.className==='ruby-drop-ember')};
 }
 return {dom,ui,candidate,play,motion};
}
test('red shell leaves the center clear and places the strongest red glow beyond the box edge',t=>{
 const h=setup();t.after(()=>h.dom.restore());const {f}=h.play();assert.equal(f.style.width,'200%');assert.equal(f.style.height,'200%');assert.equal(f.style.left,'-50%');assert.equal(f.style.top,'-50%');assert.equal(f.style.backgroundImage,RED_SHELL_BACKGROUND);assert(RED_SHELL_BACKGROUND.includes('rgba(245,18,15,0) 43%'));assert(RED_SHELL_BACKGROUND.includes('rgba(255,54,35,.62) 67%'));assert(!RED_SHELL_BACKGROUND.includes('255,255'));assert.equal(f.innerHTML,'');h.candidate.clear();h.ui.dispose();
});
for(const duration of [180,1800,60000])test('three sparse embers use the parent '+duration+'ms clock and disappear no later than landing',async t=>{
 const h=setup(duration);t.after(()=>h.dom.restore());const {f,a,dots}=h.play(),parentFrames=JSON.stringify(f.parent!.animations[0]!.frames);assert.equal(dots.length,RED_EMBER_COUNT);assert.equal(dots.length,3);assert.equal(h.candidate.activeParticleAnimations,3);assert.equal(h.dom.timers.size,1);
 for(const dot of dots){const particle=dot.animations[0]!;assert.equal(particle.options.duration,duration);assert.equal(particle.startTime,a.startTime);assert.equal(dot.style.opacity,'0');assert(Number.parseFloat(dot.style.width!)<=4);const frames=particle.frames;assert.equal(frames.at(-1)!.opacity,0);assert(Number(frames[3]!.offset)<2/3);assert.equal(frames[3]!.opacity,0);assert.equal(frames[0]!.opacity,0);}
 assert.equal(a.frames[1]!.offset,2/3);assert.equal(a.frames[1]!.opacity,0);assert.equal(JSON.stringify(f.parent!.animations[0]!.frames),parentFrames);h.dom.tick(duration);await Promise.resolve();assert.equal(h.dom.area.querySelector('.ruby-drop-flame'),null);assert.equal(h.candidate.activeParticleAnimations,0);assert(dots.every(d=>d.animations[0]!.cancelled));assert.equal(h.dom.timers.size,0);h.ui.dispose();
});
test('only particles drift upward and slightly sideways, with fixed deterministic trajectories',()=>{
 const directions=[];for(let i=0;i<3;i++){const frames=redEmberFrames(i,36);assert.deepEqual(frames,redEmberFrames(i,36));const last=String(frames[3]!.transform),numbers=last.match(/-?[0-9]+[.]?[0-9]*/g)!.map(Number);assert(numbers[1]!<0);assert(Math.abs(numbers[0]!)<=36*.32);assert(Math.abs(numbers[1]!)<=36);directions.push(Math.sign(numbers[0]!));assert.equal(frames[2]!.opacity,.8);}assert(directions.includes(-1)&&directions.includes(1));
});
for(const reason of ['abort','resize','layout','pagehide','clear'] as const)test('red shell '+reason+' removes the halo and cancels all particle animations',async t=>{
 const h=setup(60000);t.after(()=>h.dom.restore());const abort=new AbortController(),{dots}=h.play(abort.signal);if(reason==='abort')abort.abort();else if(reason==='resize'||reason==='pagehide')h.dom.fire(reason);else if(reason==='layout'){h.dom.board.rect.width--;h.dom.layout();}else{h.candidate.clear();h.ui.clear();}await Promise.resolve();assert.equal(h.dom.area.querySelector('.ruby-drop-flame'),null);assert.equal(h.candidate.activeParticleAnimations,0);assert(dots.every(d=>d.animations[0]!.cancelled));assert.equal(h.dom.timers.size,0);h.ui.dispose();
});
test('consecutive automatic insertions release only old particles; stale abort cannot erase the new effect',async t=>{
 const h=setup();t.after(()=>h.dom.restore());const old=new AbortController(),first=h.play(old.signal),second=h.play();await Promise.resolve();assert(first.dots.every(d=>d.animations[0]!.cancelled));assert(second.dots.every(d=>!d.animations[0]!.cancelled));assert.equal(h.candidate.activeParticleAnimations,3);old.abort();await Promise.resolve();assert.equal(h.dom.area.querySelector('.ruby-drop-flame'),second.f);h.dom.tick(180);await Promise.resolve();assert.equal(h.candidate.activeParticleAnimations,0);assert.equal(h.dom.timers.size,0);h.ui.dispose();
});
for(const percent of [0,60,100])test('paused inspection seeks every ember with the halo and box at flight '+percent+'%',t=>{
 const h=setup(60000);t.after(()=>h.dom.restore());const {f,dots}=h.play();const all=[...f.parent!.animations,...f.animations,...dots.flatMap(d=>d.animations)].map(a=>Object.assign(a,{currentTime:null as number|null,paused:false,pause(){this.paused=true;}}));seekDropFrame(all,percent);assert.equal(all.length,5);assert(all.every(a=>a.paused&&a.currentTime===percent/100*40000));h.candidate.clear();h.ui.dispose();
});
test('manual, enemy, short and reduced presentations have no halo node to decorate or particles to leave behind',t=>{
 const h=setup();t.after(()=>h.dom.restore());for(const [automatic,motion]of [[false,h.motion],[true,captureAnimationMotion({short:true,lowMotion:false})],[true,captureAnimationMotion({short:false,lowMotion:true})]] as const){h.ui.play(event(),{motion,rubyAutoDrop:automatic});assert.equal(h.dom.area.querySelector('.ruby-drop-flame'),null);assert.equal(h.candidate.activeParticleAnimations,0);h.ui.clear();}h.ui.play({...event(),actor:'enemy',box:{...event().box,owner:'enemy'}},{motion:h.motion,rubyAutoDrop:true});assert.equal(h.dom.area.querySelector('.ruby-drop-flame'),null);h.ui.dispose();
});
test('new red-shell comparison preserves prior candidates and includes descendants in paused inspection',()=>{
 const html=readFileSync(new URL('../experiments/ruby-auto-drop/index.html',import.meta.url),'utf8'),source=readFileSync(new URL('../experiments/ruby-auto-drop/check.ts',import.meta.url),'utf8');assert(html.includes('value="red-shell"'));assert(html.includes('value="comet" selected'));for(const id of ['original','orb','comet','sprite'])assert(html.includes('value="'+id+'"'));assert(source.includes('flame?.getAnimations({subtree:true})'));assert(source.includes('candidates.clear()'));const candidate=readFileSync(new URL('../experiments/ruby-auto-drop/candidates.ts',import.meta.url),'utf8');assert.doesNotMatch(candidate,/Math.random|requestAnimationFrame|setInterval|setTimeout|localStorage/);
});
