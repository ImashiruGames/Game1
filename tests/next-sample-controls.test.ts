import test from 'node:test';
import assert from 'node:assert/strict';
import {mountSampleControl,type SoundControl,type SoundControlStatus} from '../src/next/audio/sampleAudioControls.ts';

class Button {
 id='';type='';textContent='';title='';className='';innerHTML='';attrs=new Map<string,string>();handlers=new Map<string,()=>void>();removed=false;
 setAttribute(k:string,v:string){this.attrs.set(k,v);}
 addEventListener(k:string,fn:()=>void){this.handlers.set(k,fn);}
 removeEventListener(k:string){this.handlers.delete(k);}
 click(){this.handlers.get('click')?.();}
 remove(){this.removed=true;}
}
function setup(icon?:'bell'|'music'){
 const previous=globalThis.document;const button=new Button();globalThis.document={createElement:()=>button} as unknown as Document;
 let enabled=false,status:SoundControlStatus='off',complete:(ok:boolean)=>void=()=>{},attempts=0;
 const listeners=new Set<()=>void>();const emit=()=>listeners.forEach(f=>f());
 const control:SoundControl={get enabled(){return enabled;},get status(){return status;},enableGesture(){attempts++;enabled=true;status='loading';emit();return new Promise(resolve=>{complete=ok=>{status=ok?'ready':'error';emit();resolve(ok&&enabled);};});},setEnabled(value){enabled=value;if(!value)status='off';emit();},subscribe(fn){listeners.add(fn);return ()=>listeners.delete(fn);}};
 const cleanup=mountSampleControl(control,{append(){}} as unknown as HTMLElement,{id:'music-toggle',label:icon==='bell'?'効果音':'BGM',description:'Neon Undertow',icon});
 return {button,control,complete:(ok:boolean)=>complete(ok),get attempts(){return attempts;},interrupt(){status='resume';emit();},close(){cleanup();globalThis.document=previous;}};
}
const settle=async()=>{for(let i=0;i<5;i++)await Promise.resolve();};
test('sample control starts silent and displays loading, success, off without disabling cancellation',async()=>{
 const s=setup();try{assert.equal(s.button.textContent,'BGM\nOFF');assert.equal(s.attempts,0);s.button.click();assert.equal(s.button.textContent,'BGM\n読込中');assert.equal(s.button.attrs.get('aria-busy'),'true');s.complete(true);await settle();assert.equal(s.button.textContent,'BGM\nON');s.button.click();assert.equal(s.button.textContent,'BGM\nOFF');}finally{s.close();}
});
test('second tap cancels loading intent and late completion does not restore ON',async()=>{
 const s=setup();try{s.button.click();s.button.click();s.complete(true);await settle();assert.equal(s.button.textContent,'BGM\nOFF');assert.equal(s.control.enabled,false);}finally{s.close();}
});
test('failed sample load remains retryable and interrupted playback offers a new gesture',async()=>{
 const s=setup();try{s.button.click();s.complete(false);await settle();assert.equal(s.button.textContent,'BGM\n再試行');assert.match(s.button.title,/再試行/);s.button.click();assert.equal(s.attempts,2);s.complete(true);await settle();s.interrupt();assert.equal(s.button.textContent,'BGM\n再開');s.button.click();assert.equal(s.attempts,3);s.complete(true);await settle();assert.equal(s.button.textContent,'BGM\nON');}finally{s.close();}
});
test('unmounted controls do not update after a pending load',async()=>{
 const s=setup();s.button.click();const text=s.button.textContent;s.close();s.complete(true);await settle();assert.equal(s.button.textContent,text);assert.equal(s.button.removed,true);
});

test('compact bells and music notes preserve visible group/state, accessible names and cancellation',async()=>{
 for(const icon of ['bell','music'] as const){const s=setup(icon);try{
 assert.match(s.button.innerHTML,/icon-off-slash/);assert.match(s.button.innerHTML,icon==='bell'?/>SE</:/>BGM</);assert.match(s.button.innerHTML,/>OFF</);assert.match(s.button.attrs.get('aria-label')!,icon==='bell'?/効果音 OFF/:/BGM OFF/);
 s.button.click();assert.match(s.button.innerHTML,/読込中/);assert.equal(s.button.attrs.get('aria-pressed'),'true');s.button.click();s.complete(true);await settle();assert.match(s.button.innerHTML,/>OFF</);assert.match(s.button.innerHTML,/icon-off-slash/);assert.equal(s.button.attrs.get('aria-pressed'),'false');
 }finally{s.close();}}
});
