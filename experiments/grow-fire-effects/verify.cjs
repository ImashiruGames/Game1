'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const code=fs.readFileSync('preview.js','utf8'),css=fs.readFileSync('preview.css','utf8'),html=fs.readFileSync('index.html','utf8');
new vm.Script(code);
let now=0,next=0,raf=new Map(),maxRaf=0,canvasCalls=[],checks=0;
class Element{
 constructor(){this.listeners={};this.dataset={};this.textContent='';this.value='';this.checked=false;this.classList={remove(){},add(){}};}
 addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
 emit(type,event={}){for(const fn of this.listeners[type]||[])fn(event);}
 getBoundingClientRect(){return {left:0,top:0,width:360,height:455};}
 removeAttribute(name){if(name==='data-playing')delete this.dataset.playing;}
}
const ids=Object.fromEntries(['intensity','speed','axis','calm','status','play-all','stop'].map(k=>[k,new Element()]));
ids.intensity.value='1';ids.speed.value='1';ids.axis.value='horizontal';
const media=new Element();media.matches=false;
const globalEvents=new Element();
const ctx=new Proxy({},{get(_,name){return (...args)=>{assert(args.every(a=>typeof a!=='number'||Number.isFinite(a)),name+' finite');canvasCalls.push(name);};},set(){return true;}});
function fixed(left,top,width,height=width){const e=new Element();e.getBoundingClientRect=()=>({left,top,width,height});return e;}
const cards=Array.from({length:4},(_,i)=>{
 const card=new Element();card.dataset.variant=String(i);const stage=new Element(),canvas=new Element(),board=new Element(),phase=new Element();
 canvas.getContext=()=>ctx;board.querySelectorAll=()=>[];board.querySelector=selector=>{
  const row=Number(selector.match(/data-row="(\d+)"/)[1]),col=Number(selector.match(/data-col="(\d+)"/)[1]);return fixed(51+43*col,73+43*row,43);
 };
 stage.querySelector=s=>({canvas,'.board':board,'.phase':phase,'.skill-icon':fixed(51,18,35),'.attack-target':fixed(279,18,30)}[s]);
 card.querySelector=()=>stage;card.stage=stage;card.canvas=canvas;card.board=board;card.phase=phase;return card;
});
const playButtons=Array.from({length:4},(_,i)=>{const e=new Element();e.dataset.play=String(i);return e;});
const document=new Element();document.hidden=false;document.getElementById=id=>ids[id];
document.querySelectorAll=s=>s==='article[data-variant]'?cards:playButtons;
const context=vm.createContext({document,matchMedia:()=>media,devicePixelRatio:1.5,performance:{now:()=>now},requestAnimationFrame:fn=>{const id=++next;raf.set(id,fn);maxRaf=Math.max(maxRaf,raf.size);return id;},cancelAnimationFrame:id=>raf.delete(id),addEventListener:(t,fn)=>globalEvents.addEventListener(t,fn),console});
vm.runInContext(code,context);
function step(ms=30){now+=ms;const work=[...raf.values()];raf.clear();work.forEach(fn=>fn(now));}
function finish(){for(let i=0;raf.size&&i<1200;i++)step();assert.equal(raf.size,0);assert.match(ids.status.textContent,/再生完了/);}
for(const axis of ['horizontal','vertical','diagonal'])for(const intensity of ['.65','1','1.4'])for(const speed of ['1','.4'])for(let variant=0;variant<4;variant++){
 ids.axis.value=axis;ids.axis.emit('change');ids.intensity.value=intensity;ids.speed.value=speed;canvasCalls=[];playButtons[variant].emit('click');finish();assert(canvasCalls.includes('roundRect'));assert(canvasCalls.includes('arc'));checks++;
}
ids.speed.value='1';const seen=new Set();ids['play-all'].emit('click');
for(let i=0;raf.size&&i<400;i++){for(const c of cards)if(c.dataset.playing==='true')seen.add(c.dataset.variant);step();}
assert.deepEqual([...seen],['0','1','2','3']);assert.equal(raf.size,0);checks++;
for(let i=0;i<80;i++){playButtons[i%4].emit('click');assert.equal(raf.size,1);}ids.stop.emit('click');assert.equal(raf.size,0);checks++;
playButtons[0].emit('click');document.hidden=true;document.emit('visibilitychange');assert.equal(raf.size,0);document.hidden=false;checks++;
for(const event of ['pagehide','resize']){playButtons[1].emit('click');globalEvents.emit(event);assert.equal(raf.size,0);checks++;}
playButtons[2].emit('click');document.emit('keydown',{key:'Escape'});assert.equal(raf.size,0);checks++;
media.matches=true;media.emit('change');assert.equal(ids.calm.checked,true);
canvasCalls=[];playButtons[3].emit('click');finish();assert(!canvasCalls.includes('arc'));assert(canvasCalls.includes('roundRect'));checks++;
media.matches=false;media.emit('change');ids.calm.checked=false;
playButtons[0].emit('click');ids.intensity.emit('change');assert.equal(raf.size,0);checks++;
// A real cell selection is still delivered while the effect is running.
playButtons[2].emit('click');let selected=false;const cell={classList:{add(){selected=true;}},getAttribute:()=> '6行2列 自分の箱・対象リンク'};
cards[2].board.emit('click',{target:{closest:()=>cell}});assert(selected);assert.equal(raf.size,1);ids.stop.emit('click');checks++;
assert.equal(maxRaf,1);assert.match(css,/\.stage canvas\{[^}]*pointer-events:none/);
assert.match(css,/@media\(max-width:760px\)/);
assert(!/\b(localStorage|sessionStorage|fetch|XMLHttpRequest|WebSocket)\b/.test(code));
for(const name of ['preview.css','preview.js'])assert(html.includes(name)&&fs.existsSync(name));
assert(!/<script[^>]+type="module"/.test(html));checks++;
console.log('PASS: '+checks+' automated scenarios; 72 variant/axis/intensity/speed combinations.');
console.log('PASS: sequential order, rapid restart (one RAF maximum), stop, hidden, pagehide, resize, Escape, reduced motion, setting change, cell input during animation.');
console.log('PASS: JavaScript syntax, finite Canvas coordinates, local file dependencies, no persistent storage/network APIs.');
console.log('NOT VERIFIED: actual browser rendering, mobile layout, appearance/performance on the user display (browser tool inventory was empty).');
