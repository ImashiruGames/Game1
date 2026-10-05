import {controlIcon} from '../ui/controlIcons.ts';
/** 日本語: 音源の読込・再試行を各音ボタンで完結させる。
 * English: Each group owns its own gesture, pending intent and retry feedback. */
export type SoundControlStatus='off'|'ready'|'resume'|'unavailable'|'loading'|'error';
export interface SoundControl {
 readonly enabled:boolean;
 readonly status:SoundControlStatus;
 enableGesture():Promise<boolean>;
 setEnabled(enabled:boolean):void;
 subscribe(listener:()=>void):()=>void;
}
export function mountSampleControl(control:SoundControl,host:HTMLElement,options:{id:string;label:string;description:string;icon?:'bell'|'music'}):()=>void {
 const button=document.createElement('button');button.type='button';button.id=options.id;
 let pending=false,request=0,disposed=false;
 const update=()=>{
  if(disposed)return;
  const state=!control.enabled?'OFF':pending||control.status==='loading'?'読込中':control.status==='ready'?'ON':control.status==='error'||control.status==='unavailable'?'再試行':'再開';
  if(options.icon){button.className='compact-sound-control';button.innerHTML=controlIcon(options.icon,state==='OFF')+`<span class="sound-label">${options.icon==='bell'?'SE':'BGM'}</span><span class="sound-state">${state}</span>`;}else button.textContent=`${options.label}\n${state}`;
  button.setAttribute('aria-pressed',String(control.enabled));
  button.setAttribute('aria-busy',String(pending||control.status==='loading'));
  button.setAttribute('aria-label',`${options.label} ${state}。${!control.enabled?'タップで開始':pending||control.status==='loading'||control.status==='ready'?'タップで停止':'タップで再開'}`);
  button.title=state==='再試行'?`${options.label}の音源を読み込めないか、再生を開始できませんでした。もう一度タップして再試行できます。`:state==='再開'?`${options.label}は中断しています。タップして再開できます。`:options.description;
 };
 const click=()=>{
  if(control.enabled&&(pending||control.status==='loading'||control.status==='ready')){request++;pending=false;control.setEnabled(false);update();return;}
  const id=++request;pending=true;update();
  // Gesture is invoked synchronously. Failures never enter the gameplay flow.
  try{void control.enableGesture().catch(()=>false).then(()=>{if(!disposed&&id===request){pending=false;update();}});}catch{pending=false;update();}
  update();
 };
 button.addEventListener('click',click);host.append(button);const off=control.subscribe(update);update();
 return ()=>{disposed=true;request++;off();button.removeEventListener('click',click);button.remove();};
}
