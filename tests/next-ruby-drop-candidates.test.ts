import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRubyDropCandidates,candidateOf,paintRubyDropSprite} from '../experiments/ruby-auto-drop/candidates.ts';
import {createDropMotion} from '../src/next/ui/dropMotion.ts';
import {captureAnimationMotion} from '../src/next/ui/animationTimeline.ts';
import {rubyDropFlameFrames} from '../src/next/ui/rubyDropFlame.ts';
import {boardSkillDom} from './helpers/boardSkillDom.ts';
import {type KineticNode} from './helpers/kineticDom.ts';
import type {DropEvent} from '../src/next/core/types.ts';
const full=captureAnimationMotion({speed:'medium',short:false,lowMotion:false});
const event=():DropEvent=>({type:'drop',actor:'player',box:{id:'drop:1',row:7,col:2,owner:'player',type:'normal',status:'normal'},candidateId:'ceiling:2:0',spawn:{row:0,col:2},landing:{row:7,col:2},path:Array.from({length:8},(_,row)=>({row,col:2}))});
function canvasDoc(){const calls:{name:string;args:unknown[]}[]=[],stops:unknown[][]=[];let built=0;const ctx=new Proxy({createRadialGradient(...args:unknown[]){calls.push({name:'gradient',args});return {addColorStop(...a:unknown[]){stops.push(a);}};}},{get(o,k){if(k in o)return o[k as keyof typeof o];return (...args:unknown[])=>calls.push({name:String(k),args});},set(){return true;}});return {calls,stops,get built(){return built;},doc:{createElement(tag:string){assert.equal(tag,'canvas');built++;return {width:0,height:0,getContext:()=>ctx,toDataURL:()=> 'data:image/png;base64,dGVzdA=='};}} as unknown as Document,ctx:ctx as unknown as CanvasRenderingContext2D};}
for(const kind of ['orb','comet','sprite'] as const)test(kind+' keeps the production moving box, normal 120ms flight and initial/mid/landing visibility keys',t=>{
 const dom=boardSkillDom();t.after(()=>dom.restore());dom.cell(7,2).classList.add('player');const e=event(),snapshot=JSON.stringify(e),ui=createDropMotion(dom.root.asElement()),canvas=canvasDoc(),variants=createRubyDropCandidates(canvas.doc);variants.prepare(kind);
 assert(ui.play(e,{motion:full,rubyAutoDrop:true}));const f=dom.area.querySelector<KineticNode>('.ruby-drop-flame')!,a=f.animations[0]!,parent=f.parent!,beforeFrames=JSON.stringify(parent.animations[0]!.frames);variants.apply(f.asElement(),kind);
 assert.equal(f.parent,parent);assert.equal(f.animations[0],a);assert.equal(JSON.stringify(parent.animations[0]!.frames),beforeFrames);assert.equal(a.startTime,parent.animations[0]!.startTime);assert.equal(a.options.duration,180);assert.deepEqual(a.frames,rubyDropFlameFrames(2/3));assert.equal(a.frames[0]!.opacity,1);assert.equal(a.frames[0]!.easing,'steps(1,end)');assert.equal(a.frames[1]!.offset,120/180);assert.equal(a.frames[1]!.opacity,0);assert.equal(f.style.opacity,undefined);
 assert.equal(f.innerHTML,'');assert.equal(f.dataset.candidate,kind);assert(f.style.backgroundImage);assert.equal(dom.timers.size,1);dom.tick(90);assert.equal(dom.area.querySelector('.ruby-drop-flame'),f);dom.tick(90);assert.equal(dom.area.querySelector('.ruby-drop-flame'),null);assert(a.cancelled);assert.equal(dom.timers.size,0);assert.equal(JSON.stringify(e),snapshot);ui.dispose();
});
for(const kind of ['orb','comet','sprite'] as const)for(const reason of ['abort','resize','clear'] as const)test(kind+' cleanup on '+reason+' removes its candidate with no extra loop or timer',t=>{
 const dom=boardSkillDom();t.after(()=>dom.restore());dom.cell(7,2).classList.add('player');const ui=createDropMotion(dom.root.asElement()),abort=new AbortController(),variants=createRubyDropCandidates(canvasDoc().doc);ui.play(event(),{motion:full,signal:abort.signal,rubyAutoDrop:true});const f=dom.area.querySelector<KineticNode>('.ruby-drop-flame')!;variants.apply(f.asElement(),kind);
 if(reason==='abort')abort.abort();else if(reason==='resize')dom.fire('resize');else ui.clear();assert.equal(dom.area.querySelector('.ruby-drop-flame'),null);assert(f.animations[0]!.cancelled);assert.equal(dom.timers.size,0);assert(!dom.cell(7,2).classList.contains('kinetic-drop-masked'));ui.dispose();
});
for(const kind of ['orb','comet','sprite'] as const)test(kind+' cannot appear on manual, reduced or fast drops',t=>{
 const dom=boardSkillDom();t.after(()=>dom.restore());dom.cell(7,2).classList.add('player');const ui=createDropMotion(dom.root.asElement()),canvas=canvasDoc(),variants=createRubyDropCandidates(canvas.doc);
 for(const [automatic,motion]of [[false,full],[true,captureAnimationMotion({short:false,lowMotion:true})],[true,captureAnimationMotion({speed:'fast',short:true,lowMotion:false})]] as const){ui.play(event(),{motion,rubyAutoDrop:automatic});const f=dom.area.querySelector<KineticNode>('.ruby-drop-flame');if(f)variants.apply(f.asElement(),kind);assert.equal(f,null);ui.clear();}assert.equal(variants.textureBuilds,0);assert.equal(dom.timers.size,0);ui.dispose();
});
test('C paints one deterministic round sprite and reuses it for every subsequent drop',()=>{
 const canvas=canvasDoc(),variants=createRubyDropCandidates(canvas.doc);variants.prepare('sprite');assert.equal(variants.textureBuilds,1);const nodes=Array.from({length:3},()=>({innerHTML:'old',dataset:{},style:{}}));for(const n of nodes)variants.apply(n as unknown as HTMLElement,'sprite');assert.equal(canvas.built,1);assert.equal(variants.textureBuilds,1);assert.deepEqual(nodes[0],nodes[2]);assert(canvas.calls.filter(c=>c.name==='arc').length>=12);assert(!canvas.calls.some(c=>['lineTo','stroke','strokeRect'].includes(c.name)));assert(canvas.stops.every(s=>typeof s[0]==='number'&&s[0]>=0&&s[0]<=1));
 const another=canvasDoc();paintRubyDropSprite(another.ctx,192);assert.deepEqual(another.calls,canvas.calls);assert.deepEqual(another.stops,canvas.stops);
});
test('A/B/C have distinct proportions and rendering methods without pointed paths or hard outlines',()=>{
 const variants=createRubyDropCandidates(canvasDoc().doc),make=(kind:string)=>{const n={innerHTML:'old',dataset:{},style:{} as Record<string,string>};variants.apply(n as unknown as HTMLElement,kind);return n;},a=make('orb'),b=make('comet'),c=make('sprite');
 assert.match(a.style.backgroundImage!,/radial-gradient[(]circle/);assert.match(b.style.backgroundImage!,/ellipse/);assert.match(c.style.backgroundImage!,/^url/);assert.equal(a.style.width,a.style.height);assert.notEqual(b.style.width,b.style.height);assert.equal(c.style.width,c.style.height);assert.notEqual(c.style.width,a.style.width);for(const n of [a,b,c]){assert.equal(n.innerHTML,'');assert.equal(n.style.border,'0');assert.doesNotMatch(n.style.backgroundImage!,/polygon|path|conic-gradient/);}
 const source=readFileSync(new URL('../experiments/ruby-auto-drop/candidates.ts',import.meta.url),'utf8');assert.doesNotMatch(source,/Math.random|localStorage|setInterval|requestAnimationFrame/);assert.equal(candidateOf('original'),'original');
});
test('comparison selection reaches both production live playback and production paused inspection without selecting a main-game variant',()=>{
 const source=readFileSync(new URL('../experiments/ruby-auto-drop/check.ts',import.meta.url),'utf8'),html=readFileSync(new URL('../experiments/ruby-auto-drop/index.html',import.meta.url),'utf8'),main=readFileSync(new URL('../src/next/main.ts',import.meta.url),'utf8');
 assert.equal(source.split('candidates.apply(flame,d.look)').length-1,2);assert.equal(source.split('candidates.prepare(d.look)').length-1,2);assert(source.includes('seekDropFrame(animations'));assert(html.includes("$('look').onchange=()=>send(lastKind,lastCount)"));for(const kind of ['orb','comet','sprite','original'])assert(html.includes('value="'+kind+'"'));assert(!main.includes('createRubyDropCandidates'));assert(!main.includes('ruby-auto-drop/candidates'));
});
