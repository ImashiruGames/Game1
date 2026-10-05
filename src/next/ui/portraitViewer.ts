export interface PortraitView {
 readonly src:string;
 readonly alt:string;
 readonly title:string;
 readonly trigger:HTMLElement;
}
export interface PortraitViewerOptions {
 readonly onClosePointer?:(point:{readonly clientX:number;readonly clientY:number;readonly detail:number})=>void;
}

/** 日本語: 操作待ち中の原画閲覧だけを担当。戦闘・選択・音・保存は変更しない。
 * English: An optional, static artwork view; it owns no battle, selection, audio, or persistence state. */
export function createPortraitViewer(host:HTMLElement,options:PortraitViewerOptions={}) {
 const doc=host.ownerDocument,win=doc.defaultView!;
 let current:{dialog:HTMLDialogElement;finish:(restoreFocus:boolean)=>void}|undefined;
 let disposed=false;
 return {
  get active():boolean{return !!current;},
  close(restoreFocus=true):void{current?.finish(restoreFocus);},
  dispose():void{disposed=true;current?.finish(false);},
  open(request:PortraitView):boolean {
   if(disposed||current||!request.src||!request.title||!host.isConnected||!request.trigger.isConnected)return false;
   const dialog=doc.createElement('dialog');dialog.id='portrait-viewer';dialog.className='portrait-viewer';
   dialog.setAttribute('aria-label',`${request.title}の全身イラスト`);
   const header=doc.createElement('header');header.className='portrait-viewer-top';
   const title=doc.createElement('h2');title.textContent=request.title;
   const close=doc.createElement('button');close.type='button';close.className='portrait-viewer-close';close.setAttribute('aria-label','閉じる');close.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 5L19 19M19 5L5 19" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>';
   const frame=doc.createElement('div');frame.className='portrait-viewer-frame';
   const image=doc.createElement('img');image.className='portrait-viewer-image';image.alt=request.alt;
   const status=doc.createElement('p');status.className='portrait-viewer-status';status.textContent='読み込み中…';status.setAttribute('role','status');
   header.append(title,close);frame.append(image,status);dialog.append(header,frame);
   const removers:(()=>void)[]=[];let done=false,releaseKey='';
   const listen=(target:EventTarget,type:string,listener:EventListener,capture=false):void=>{target.addEventListener(type,listener,capture);removers.push(()=>target.removeEventListener(type,listener,capture));};
   const finish=(restoreFocus:boolean):void=>{
    if(done)return;done=true;removers.forEach(remove=>remove());
    if(current?.dialog===dialog)current=undefined;
    try{if(dialog.open)dialog.close();}catch{/* Cosmetic cleanup must not interrupt play. */}
    dialog.remove();
    try{if(restoreFocus&&request.trigger.isConnected)request.trigger.focus({preventScroll:true});}catch{/* Detached or unavailable focus is harmless. */}
   };
   const consume=(event:Event):void=>{event.preventDefault();event.stopImmediatePropagation();};
   // 日本語: 開いた時のキー解放では閉じない。閉じる操作もkeyupまで待ち、盤面へ通さない。
   // English: Ignore the opening key's release; close on a fresh key release, with no input leaking below.
   const keydown=(event:Event):void=>{
    const key=event as KeyboardEvent;
    if(!['Enter',' ','Escape'].includes(key.key))return;
    consume(key);if(!key.repeat)releaseKey=key.key;
   };
   const keyup=(event:Event):void=>{
    const key=event as KeyboardEvent;
    if(!['Enter',' ','Escape'].includes(key.key))return;
    consume(key);if(key.key===releaseKey)finish(true);
   };
   listen(close,'click',event=>{
    consume(event);const pointer=event as MouseEvent;
    if(pointer.detail>0)try{options.onClosePointer?.({clientX:pointer.clientX,clientY:pointer.clientY,detail:pointer.detail});}catch{/* An optional input guard cannot trap the view. */}
    finish(true);
   });
   listen(doc,'keydown',keydown,true);listen(doc,'keyup',keyup,true);
   listen(dialog,'cancel',event=>{consume(event);finish(true);});
   listen(dialog,'close',()=>finish(true));
   listen(win,'pagehide',()=>finish(false));
   listen(image,'load',()=>{status.hidden=true;});
   listen(image,'error',()=>{image.hidden=true;status.hidden=false;status.textContent='画像を読み込めませんでした。閉じてもう一度お試しください。';});
   try{
    current={dialog,finish};image.src=request.src;host.append(dialog);dialog.showModal();close.focus({preventScroll:true});
    if(image.complete&&image.naturalWidth>0)status.hidden=true;
    return true;
   }catch{finish(false);return false;}
  },
 };
}
