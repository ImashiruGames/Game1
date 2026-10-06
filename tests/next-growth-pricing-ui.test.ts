import test from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';
import {createProfile,ProfileStore} from '../src/next/meta/profile.ts';
class Element {id='';hidden=false;open=false;innerHTML='';scrollTop=0;listeners:Record<string,Function[]>={};children:Element[]=[];dataset:Record<string,string>={};disabled=false;style={setProperty(){}};classList={add(){},remove(){}};attrs=new Set<string>();setAttribute(){}append(...e:Element[]){this.children.push(...e);}querySelector(){return null;}querySelectorAll(){return [];}addEventListener(n:string,f:Function){(this.listeners[n]??=[]).push(f);}contains(){return false;}showModal(){this.open=true;}close(){this.open=false;}closest(){return this;}hasAttribute(n:string){return this.attrs.has(n);}}
class Storage{data=new Map<string,string>();getItem(k:string){return this.data.get(k)??null;}setItem(k:string,v:string){this.data.set(k,v);}}
test('recovery tree UI shows the next cost, exact refund and independent category description',async()=>{
 const g=globalThis as any,old={document:g.document,window:g.window,HTMLElement:g.HTMLElement,HTMLButtonElement:g.HTMLButtonElement};
 const hook=registerHooks({load(url,ctx,next){if(url.endsWith('.css'))return {format:'module',source:'export {};',shortCircuit:true};return next(url,ctx);}});
 try{
  g.HTMLElement=Element;g.HTMLButtonElement=Element;g.document={activeElement:null,createElement:()=>new Element(),body:{classList:{add(){},remove(){}}}};g.window={confirm:()=>true};
  const {mountHome}=await import('../src/next/meta/home.ts');
  const store=new ProfileStore(new Storage(),()=>true);store.read();const p=createProfile(1);p.characters.blue.xp=100;p.characters.blue.tree.rewardHeal=4;store.write(p);
  const root=new Element(),home=mountHome(root as any,{store:()=>store,saved:()=>null,continue(){},async launch(){},preview:false});home.show();
  const [surface,panel]=root.children as [Element,Element],button=new Element();button.dataset.home='tree';surface.listeners.click!.forEach(fn=>fn({target:button}));
  assert.match(panel.innerHTML,/火力3項目と報酬の即時回復はそれぞれ1・1・2・2/);
  const card=panel.innerHTML.match(/<article[^>]*>.*?報酬の即時回復.*?<\/article>/)![0];
  assert.match(card,/次の強化 3 pt ／ 1段階戻すと 2 pt返還/);
  assert.match(card,/data-tree="rewardHeal" data-delta="1"[^>]*disabled/);
  assert.match(panel.innerHTML,/通常スキル自由枠[\s\S]*?次の強化 3 pt/);
 }finally{Object.assign(g,old);hook.deregister();}
});
