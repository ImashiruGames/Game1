import type {Box,BattleState} from '../core/types.ts';
import {boxTypeInformation} from './boxTypeInformation.ts';
/** 日本語: 長押し・ドラッグの指を離しても投入しない。次の新しい操作だけを許可。
 * English: A consumed/cancelled gesture never becomes a gameplay click; only a new gesture resets it. */
export function createInspectionGesture(){
 let pointer:number|null=null,x=0,y=0,blocked=false;const active=new Set<number>();
 return {
  start(id:number,px:number,py:number){const alreadyActive=active.size>0;active.add(id);if(alreadyActive){blocked=true;return false;}pointer=id;x=px;y=py;blocked=false;return true;},
  move(id:number,px:number,py:number){if(pointer===id&&Math.hypot(px-x,py-y)>9){blocked=true;return true;}return false;},
  consume(){blocked=true;}, end(id:number){active.delete(id);if(pointer===id)pointer=null;}, reset(){active.clear();pointer=null;blocked=true;}, blocks(){return blocked;},
 };
}
export function installBoxInspection(root:HTMLElement,options:{state:()=>BattleState;ready:()=>boolean;clearSelection:()=>void}){
 const dialog=document.createElement('dialog');dialog.className='box-inspection';dialog.setAttribute('aria-labelledby','box-inspection-name');root.append(dialog);
 const gesture=createInspectionGesture();let timer:ReturnType<typeof setTimeout>|null=null;let trigger:HTMLElement|null=null,mode=false;
 const stop=()=>{if(timer!==null)clearTimeout(timer);timer=null;};
 const cell=(target:EventTarget|null)=>(target instanceof Element?target.closest<HTMLElement>('#board [data-box-id]'):null);
 const modeButton=document.createElement('button');modeButton.type='button';modeButton.className='box-inspection-toggle';modeButton.textContent='箱の効果';modeButton.setAttribute('aria-pressed','false');modeButton.setAttribute('aria-label','箱の効果を調べる。選択後に箱を押す。箱を長押し、または箱にフォーカスして I キーでも表示');root.querySelector('.hint-line')!.append(modeButton);
 const setMode=(value:boolean)=>{mode=value;modeButton.setAttribute('aria-pressed',String(value));modeButton.textContent=value?'箱を選んで確認':'箱の効果';root.classList.toggle('inspecting-boxes',value);};
 const close=()=>{stop();if(dialog.open)dialog.close();const id=trigger?.dataset.boxId;root.querySelector<HTMLElement>(`[data-box-id="${CSS.escape(id??'')}"]`)?.focus({preventScroll:true});};
 const open=(target:HTMLElement)=>{
  if(!options.ready()||root.querySelector('dialog[open]'))return;
  const state=options.state(),box=state.boxes.find((b:Box)=>b.id===target.dataset.boxId);if(!box)return;
  const rect=target.getBoundingClientRect(),info=boxTypeInformation(box,state);trigger=target;gesture.consume();stop();setMode(false);options.clearSelection();
  dialog.replaceChildren();const top=document.createElement('div');top.className='box-inspection-top';const heading=document.createElement('h2');heading.id='box-inspection-name';heading.textContent=`${info.name}タイプ`;const closeButton=document.createElement('button');closeButton.type='button';closeButton.textContent='閉じる';closeButton.onclick=close;top.append(heading,closeButton);const effect=document.createElement('p');effect.textContent=info.effect;const context=document.createElement('p');context.className='box-inspection-context';context.textContent=info.context;dialog.append(top,effect,context);dialog.showModal();
  const width=Math.min(340,window.innerWidth-24);dialog.style.width=`${width}px`;dialog.style.left=`${Math.max(12,Math.min(window.innerWidth-width-12,rect.left+rect.width/2-width/2))}px`;const height=dialog.getBoundingClientRect().height;dialog.style.top=`${Math.max(12,Math.min(window.innerHeight-height-12,rect.top-height-10>12?rect.top-height-10:rect.bottom+10))}px`;closeButton.focus({preventScroll:true});
 };
 modeButton.addEventListener('click',()=>{if(!options.ready())return;options.clearSelection();setMode(!mode);});
 root.addEventListener('pointerdown',event=>{if(dialog.open)return;const target=cell(event.target);if(!gesture.start(event.pointerId,event.clientX,event.clientY)){stop();return;}if(!target||event.button!==0||!options.ready())return;stop();timer=setTimeout(()=>open(target),450);},true);
 window.addEventListener('pointermove',event=>{if(gesture.move(event.pointerId,event.clientX,event.clientY))stop();},true);
 window.addEventListener('pointerup',event=>{stop();gesture.end(event.pointerId);if(gesture.blocks()&&!dialog.contains(event.target as Node))event.preventDefault();},true);
 window.addEventListener('pointercancel',event=>{stop();gesture.consume();gesture.end(event.pointerId);},true);
 window.addEventListener('scroll',()=>{if(timer!==null){stop();gesture.consume();}if(dialog.open)close();},true);
 window.addEventListener('blur',()=>{stop();gesture.reset();});
 window.addEventListener('pagehide',()=>{stop();gesture.reset();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();gesture.reset();}});
 root.addEventListener('click',event=>{if(dialog.contains(event.target as Node))return;if(gesture.blocks()&&event.detail!==0){event.preventDefault();event.stopImmediatePropagation();return;}const target=cell(event.target);if(mode&&target){event.preventDefault();event.stopImmediatePropagation();open(target);}},true);
 root.addEventListener('contextmenu',event=>{const target=cell(event.target);if(target){event.preventDefault();open(target);}});
 root.addEventListener('keydown',event=>{const target=cell(event.target);if(target&&(event.key.toLowerCase()==='i'||event.key==='F10'&&event.shiftKey)){event.preventDefault();open(target);}if(event.key==='Escape')setMode(false);},true);
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();}});
 return {close};
}
