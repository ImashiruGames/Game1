import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPortraitViewer} from '../src/next/ui/portraitViewer.ts';
import {setup,TestNode,keyEvent} from './helpers/transformation-dom.ts';

function fixture(){
 const dom=setup(),create=dom.doc.createElement.bind(dom.doc);
 dom.doc.createElement=()=>{const node=create(),append=node.append.bind(node);node.append=(...nodes:TestNode[])=>nodes.forEach(append);return node;};
 const trigger=dom.doc.createElement();dom.doc.body.append(trigger);trigger.focus();
 const find=(name:string):TestNode|undefined=>{const visit=(n:TestNode):TestNode|undefined=>n.className===name?n:n.children.map(visit).find(Boolean);return visit(dom.doc.body);};
 const request={src:'/approved-blue.webp',alt:'Full original blue art',title:'Blue form',trigger:trigger as unknown as HTMLElement};
 return {...dom,trigger,find,request,host:dom.doc.body as unknown as HTMLElement};
}
const click=(detail=1)=>{const e=new Event('click',{cancelable:true});Object.assign(e,{detail,clientX:32,clientY:48});return e;};

test('portrait view opens the exact supplied image and text without changing source data',t=>{
 const f=fixture();t.after(f.restore);const ui=createPortraitViewer(f.host);
 assert.equal(ui.active,false);assert.equal(f.win.timers.size,0);
 assert.equal(ui.open({...f.request,title:'<b>Blue</b>'}),true);
 assert.equal(f.find('portrait-viewer')!.open,true);assert.equal(f.find('portrait-viewer-image')!.src,f.request.src);assert.equal(f.find('portrait-viewer-image')!.alt,f.request.alt);
 assert.equal(f.find('portrait-viewer-top')!.children[0]!.textContent,'<b>Blue</b>');assert.equal(f.doc.activeElement,f.find('portrait-viewer-close'));
 ui.close();assert.equal(ui.active,false);assert.equal(f.find('portrait-viewer'),undefined);assert.equal(f.doc.activeElement,f.trigger);assert.equal(f.win.timers.size,0);
});

test('opening-key release and held-key repeats cannot dismiss or reopen the view',t=>{
 const f=fixture();t.after(f.restore);const ui=createPortraitViewer(f.host);ui.open(f.request);
 f.doc.dispatchEvent(keyEvent('keyup','Enter'));assert.equal(ui.active,true);
 f.doc.dispatchEvent(keyEvent('keydown','Enter',true));f.doc.dispatchEvent(keyEvent('keyup','Enter'));assert.equal(ui.active,true);
 const down=keyEvent('keydown','Escape');f.doc.dispatchEvent(down);assert.equal(down.defaultPrevented,true);assert.equal(ui.active,true);
 const up=keyEvent('keyup','Escape');f.doc.dispatchEvent(up);assert.equal(up.defaultPrevented,true);assert.equal(ui.active,false);assert.equal(f.doc.activeElement,f.trigger);
 assert.equal(f.doc.listenerCount,0);assert.equal(f.win.listenerCount,0);
});

test('Enter and Space close only on release while Tab remains native',t=>{
 const f=fixture();t.after(f.restore);const ui=createPortraitViewer(f.host);
 for(const key of ['Enter',' ']){
  ui.open(f.request);const tab=keyEvent('keydown','Tab');f.doc.dispatchEvent(tab);assert.equal(tab.defaultPrevented,false);
  f.doc.dispatchEvent(keyEvent('keydown',key));assert.equal(ui.active,true);f.doc.dispatchEvent(keyEvent('keyup',key));assert.equal(ui.active,false);
 }
});

test('pointer close reports one guard position and repeated stale close events are inert',t=>{
 const f=fixture();t.after(f.restore);const marks:unknown[]=[];const ui=createPortraitViewer(f.host,{onClosePointer:p=>marks.push(p)});ui.open(f.request);
 const close=f.find('portrait-viewer-close')!;close.dispatchEvent(click());close.dispatchEvent(click(2));
 assert.deepEqual(marks,[{clientX:32,clientY:48,detail:1}]);assert.equal(ui.active,false);assert.equal(f.doc.activeElement,f.trigger);
 ui.open(f.request);f.find('portrait-viewer-close')!.dispatchEvent(click(0));assert.equal(marks.length,1);assert.equal(ui.active,false);
});

test('duplicate opens preserve current art and later opens use updated form data',t=>{
 const f=fixture();t.after(f.restore);const ui=createPortraitViewer(f.host);ui.open(f.request);
 assert.equal(ui.open({...f.request,src:'/red.webp'}),false);assert.equal(f.find('portrait-viewer-image')!.src,f.request.src);
 ui.close();assert.equal(ui.open({...f.request,src:'/red.webp',title:'Red form'}),true);assert.equal(f.find('portrait-viewer-image')!.src,'/red.webp');ui.dispose();
 assert.equal(ui.open(f.request),false);assert.equal(f.doc.listenerCount,0);assert.equal(f.win.listenerCount,0);
});

test('pagehide and owner reset close without returning focus to the old game',t=>{
 const f=fixture();t.after(f.restore);const ui=createPortraitViewer(f.host);
 ui.open(f.request);f.win.dispatchEvent(new Event('pagehide'));assert.equal(ui.active,false);assert.notEqual(f.doc.activeElement,f.trigger);
 ui.open(f.request);ui.close(false);assert.equal(ui.active,false);assert.notEqual(f.doc.activeElement,f.trigger);
 assert.equal(f.find('portrait-viewer'),undefined);assert.equal(f.doc.listenerCount,0);assert.equal(f.win.listenerCount,0);
});

test('image failure stays dismissible; a native modal failure leaves no listeners or active state',t=>{
 const f=fixture();t.after(f.restore);const ui=createPortraitViewer(f.host);ui.open(f.request);
 const image=f.find('portrait-viewer-image')!,status=f.find('portrait-viewer-status')!;
 image.dispatchEvent(new Event('load'));assert.equal((status as unknown as HTMLElement).hidden,true);
 image.dispatchEvent(new Event('error'));assert.equal((image as unknown as HTMLElement).hidden,true);assert.equal((status as unknown as HTMLElement).hidden,false);assert.match(status.textContent!,/読み込めません/);ui.close();
 const create=f.doc.createElement.bind(f.doc);f.doc.createElement=()=>{const n=create();n.showModal=()=>{throw new Error('unavailable');};return n;};
 assert.equal(ui.open(f.request),false);assert.equal(ui.active,false);assert.equal(f.find('portrait-viewer'),undefined);assert.equal(f.doc.listenerCount,0);assert.equal(f.win.listenerCount,0);
});

test('viewer is static and does not execute battle, persistence, audio or timing operations',()=>{
 const source=readFileSync(new URL('../src/next/ui/portraitViewer.ts',import.meta.url),'utf8');
 assert.doesNotMatch(source,/localStorage|applyAction|controller\.|Math\.random|Audio|setTimeout|setInterval|requestAnimationFrame|\.animate\(/);
 const css=readFileSync(new URL('../src/next/ui/portraitViewer.css',import.meta.url),'utf8');assert.match(css,/object-fit:contain/);assert.match(css,/min-height:44px/);assert.doesNotMatch(css,/touch-action:none|object-fit:cover/);
});
