import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/box-design-preview/preview.js', import.meta.url), 'utf8');
const markup = readFileSync(new URL('../public/box-design-preview/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public/box-design-preview/preview.css', import.meta.url), 'utf8');

function harness(initialReduced = false) {
  const tasks = new Map<number, { callback: () => void; at: number }>();
  const motions: any[] = [];
  let nextId = 1, now = 0;
  function schedule(callback: () => void, delay: number) { const id = nextId++; tasks.set(id, {callback, at: now + delay}); return id; }
  class Element {
    children: Element[] = []; dataset: any = {}; attrs: any = {}; listeners: any = {}; textContent = ''; checked = false; value = ''; parent: Element | null = null;
    classes = new Set<string>();
    classList = { add: (...values: string[]) => values.forEach(v => this.classes.add(v)), remove: (...values: string[]) => values.forEach(v => this.classes.delete(v)), contains: (value: string) => this.classes.has(value) };
    className = ''; html = '';
    set innerHTML(value: string) { this.html = value; this.children = value ? [new Element()] : []; this.children.forEach(c=>c.parent=this); }
    get innerHTML() { return this.html; }
    append(child: Element) { child.parent = this; this.children.push(child); }
    replaceChildren() { this.children=[]; this.html=''; }
    setAttribute(key: string, value: string) { this.attrs[key] = String(value); }
    addEventListener(key: string, callback: any) { this.listeners[key] = callback; }
    querySelector() { return this.children[0] ?? null; }
    getBoundingClientRect() { return {left:0,top:0,width:40,height:40}; }
    remove() { if (this.parent) this.parent.children=this.parent.children.filter(c=>c!==this); }
    animate(frames: any, options: any) {
      const animation = { cancelled:false, onfinish:null as any, cancel() { this.cancelled=true; }, frames, options };
      motions.push(animation);
      schedule(()=>{if(!animation.cancelled) animation.onfinish?.();}, (options.duration??0)+(options.delay??0));
      return animation;
    }
  }
  const idNames = ['board','effects','status','target','own-specimen','enemy-specimen','reduce-motion','motion-origin','material-caption','reset','arena'] as const;
  const ids = Object.fromEntries(idNames.map(id=>[id,new Element()])) as Record<typeof idNames[number], Element>;
  const themes = ['blue','red'].map(theme=>{ const e=new Element();e.dataset.theme=theme;return e; }) as [Element, Element];
  const events = ['place','link','convert'].map(kind=>{const e=new Element();e.dataset.event=kind;return e;});
  const media = {matches:initialReduced, listener:null as any, addEventListener(_key: string, callback: any){this.listener=callback;}};
  const body = new Element();
  const document = {body, querySelector: (selector: string) => selector.startsWith('#') ? ids[selector.slice(1) as keyof typeof ids] : events.find(e=>selector.includes(`"${e.dataset.event}"`)), querySelectorAll:(selector: string)=>selector.includes('theme') ? themes : events, createElement:()=>new Element(), createElementNS:()=>new Element()};
  vm.runInNewContext(source,{document,matchMedia:()=>media,setTimeout:schedule,clearTimeout:(id: number)=>tasks.delete(id),window:{addEventListener(){}}});
  function advance(delta = 5000) { const end=now+delta; for (;;) {const next=[...tasks.entries()].filter(([,task])=>task.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next) break;tasks.delete(next[0]);now=next[1].at;next[1].callback();} now=end; }
  const click = (kind: string)=>events.find(e=>e.dataset.event===kind)!.listeners.click();
  const cell = (row: number, col: number)=>ids.board.children.find(e=>e.dataset.position===`${row},${col}`)!;
  return {ids,themes,events,body,click,cell,advance,motions,media,tasks};
}

test('energy-box preview stays fully isolated from gameplay and saved data', () => {
  assert.deepEqual(readdirSync(new URL('../public/box-design-preview/', import.meta.url)).sort(), ['index.html','preview.css','preview.js','viewport.html']);
  assert.doesNotMatch(source,/localStorage|sessionStorage|fetch\(|import\s|Audio\(/);
  assert.match(markup,/\.\/preview\.css/);
  assert.match(markup,/\.\/preview\.js/);
  assert.match(css,/grid-template-columns:repeat\(6,40px\)/);
  assert.match(css,/grid-template-rows:repeat\(8,40px\)/);
});
test('energy-box preview starts with 48 cells and stable mixed ownership', () => {
  const h=harness();assert.equal(h.ids.board.children.length,48);
  assert.equal(h.ids.board.children.filter(e=>e.dataset.owner).length,18);
  assert.match(h.ids['own-specimen'].innerHTML,/energy-box own/);
  assert.match(h.ids['enemy-specimen'].innerHTML,/energy-box enemy/);
  assert.equal(h.body.dataset.motion,'full');
});
test('placement adds only its preview box and replay starts from a clean fixture', () => {
  const h=harness();h.click('place');assert.equal(h.cell(5,2).dataset.owner,'own');assert.equal(h.ids.board.children.filter(e=>e.dataset.owner).length,19);
  h.click('place');h.advance();assert.equal(h.ids.board.children.filter(e=>e.dataset.owner).length,19);assert.equal(h.cell(5,2).classList.contains('placed'),false);
  h.ids.reset.listeners.click();assert.equal(h.ids.board.children.filter(e=>e.dataset.owner).length,18);
});
test('link animates two connections and releases attack particles with complete cleanup', () => {
  const h=harness();h.click('link');h.advance(400);assert.equal(h.ids.effects.children.length,2);h.advance(400);assert.equal(h.ids.effects.children.length,5);
  h.advance();assert.equal(h.ids.effects.children.length,0);assert.equal(h.ids.target.classList.contains('hit'),false);assert.match(h.ids.status.textContent,/敵へエネルギー/);
});
test('conversion replaces one enemy frame and core, while theme switches never mutate source fixture', () => {
  const h=harness();h.click('convert');assert.equal(h.cell(5,3).dataset.owner,'enemy');h.advance(180);assert.equal(h.cell(5,3).dataset.owner,'own');assert.match(h.cell(5,3).innerHTML,/energy-box own/);
  h.themes[1].listeners.click();assert.equal(h.body.dataset.theme,'red');assert.equal(h.themes[1].attrs['aria-pressed'],'true');assert.equal(h.cell(5,3).dataset.owner,'enemy');
});
test('rapid mixed inputs cancel stale events rather than queueing or corrupting the board', () => {
  const h=harness();for(let i=0;i<20;i++){h.click('link');h.advance(160);h.click('convert');h.advance(40);h.click('place');}
  h.advance();assert.equal(h.cell(5,2).dataset.owner,'own');assert.equal(h.cell(5,3).dataset.owner,'enemy');assert.equal(h.ids.effects.children.length,0);assert.equal(h.ids.board.children.length,48);assert.equal(h.tasks.size,0);
});
test('reduced motion displays immediate understandable outcomes without Web Animations', () => {
  const h=harness(true);assert.equal(h.ids['reduce-motion'].checked,true);assert.equal(h.body.dataset.motion,'still');
  h.click('place');h.click('link');assert.equal(h.ids.effects.children.length,2);h.click('convert');assert.equal(h.cell(5,3).dataset.owner,'own');assert.equal(h.motions.length,0);assert.equal(h.tasks.size,0);
});
test('turning reduced motion on during an attack cancels moving particles and pending work', () => {
  const h=harness();h.click('link');h.advance(820);h.ids['reduce-motion'].listeners.change({target:{checked:true}});h.advance();
  assert.equal(h.body.dataset.motion,'still');assert.equal(h.ids.effects.children.length,0);assert.equal(h.ids.board.children.filter(e=>e.dataset.owner).length,18);assert.equal(h.tasks.size,0);
});
