/** Tiny deterministic DOM/WAAPI/timer harness. This is not a rendered-browser layout test. */
export interface KineticRect {left:number;top:number;width:number;height:number}
export class KineticAnimation {
 cancelled=false;
 startTime:number|null=null;
 finished:Promise<void>;
 readonly frames:Keyframe[];
 readonly options:KeyframeAnimationOptions;
 private reject!:(error:Error)=>void;
 constructor(frames:Keyframe[],options:KeyframeAnimationOptions){this.frames=frames;this.options=options;this.finished=new Promise<void>((_resolve,reject)=>{this.reject=reject;});}
 cancel():void{if(this.cancelled)return;this.cancelled=true;this.reject(new Error('cancelled'));}
}
export class KineticNode {
 id='';className='';textContent:string|null='';innerHTML='';isConnected=true;clientLeft=0;clientTop=0;
 dataset:Record<string,string>={};style:Record<string,string>={};attributes=new Map<string,string>();children:KineticNode[]=[];parent:KineticNode|null=null;
 rect:KineticRect={left:0,top:0,width:100,height:100};animations:KineticAnimation[]=[];
 animateFault=false;
 classList={
  contains:(value:string)=>this.className.split(/\s+/).includes(value),
  add:(...values:string[])=>{this.className=[...new Set([...this.className.split(/\s+/).filter(Boolean),...values])].join(' ');},
  remove:(...values:string[])=>{this.className=this.className.split(/\s+/).filter(c=>!values.includes(c)).join(' ');},
 };
 append(...nodes:KineticNode[]):void{for(const node of nodes){node.parent=this;node.isConnected=this.isConnected;this.children.push(node);}}
 remove():void{if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=null;this.isConnected=false;}
 setAttribute(name:string,value:string):void{this.attributes.set(name,value);}
 getAttribute(name:string):string|null{return this.attributes.get(name)??null;}
 getBoundingClientRect():DOMRect{return {...this.rect,right:this.rect.left+this.rect.width,bottom:this.rect.top+this.rect.height,x:this.rect.left,y:this.rect.top,toJSON:()=>this.rect};}
 querySelector<T=KineticNode>(selector:string):T|null{
  const matches=(node:KineticNode)=>{
   if(selector.startsWith('.'))return node.classList.contains(selector.slice(1));
   if(selector.startsWith('#'))return node.id===selector.slice(1);
   const position=selector.match(/^\[data-cell-row="(\d+)"\]\[data-cell-col="(\d+)"\]$/);
   return !!position&&node.dataset.cellRow===position[1]&&node.dataset.cellCol===position[2];
  };
  for(const child of this.children){if(matches(child))return child as T;const found=child.querySelector<T>(selector);if(found)return found;}return null;
 }
 animate(frames:Keyframe[],options:KeyframeAnimationOptions):Animation{if(this.animateFault)throw new Error('WAAPI failed');const animation=new KineticAnimation(frames,options);this.animations.push(animation);return animation as unknown as Animation;}
 asElement():HTMLElement{return this as unknown as HTMLElement;}
}
export function kineticDom(){
 const original={document:globalThis.document,window:globalThis.window,ResizeObserver:globalThis.ResizeObserver,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout};
 const listeners=new Map<string,Set<()=>void>>(),documentListeners=new Map<string,Set<(event:Event)=>void>>(),mediaListeners=new Set<()=>void>(),observers=new Set<()=>void>();
 const body={dataset:{} as Record<string,string>},media={matches:false,addEventListener:(_type:string,fn:()=>void)=>mediaListeners.add(fn),removeEventListener:(_type:string,fn:()=>void)=>mediaListeners.delete(fn)};
 const timers=new Map<number,{due:number;fn:()=>void}>(),cancelled=new Map<number,()=>void>();let time=0,nextId=1;
 let newNodeFault=false,unsupported=false;
 const root=new KineticNode(),area=new KineticNode(),board=new KineticNode(),hud=new KineticNode(),player=new KineticNode(),enemy=new KineticNode();
 area.className='board-area';area.rect={left:8,top:130,width:374,height:370};board.id='board';root.append(area,hud);area.append(board);
 hud.className='hud';hud.rect={left:8,top:8,width:374,height:76};hud.clientLeft=1;hud.clientTop=1;player.id='player-image';player.rect={left:17,top:14,width:40,height:42};enemy.id='enemy-image';enemy.rect={left:333,top:14,width:40,height:42};hud.append(player,enemy);
 const cells:KineticNode[]=[];
 for(let row=0;row<8;row++){const cell=new KineticNode();cell.className='cell';cell.dataset.cellRow=String(row);cell.dataset.cellCol='0';cell.rect={left:50,top:142+row*44,width:42,height:42};board.append(cell);cells.push(cell);}
 globalThis.document={body,timeline:{currentTime:0},addEventListener:(name:string,fn:(event:Event)=>void)=>{let set=documentListeners.get(name);if(!set){set=new Set();documentListeners.set(name,set);}set.add(fn);},removeEventListener:(name:string,fn:(event:Event)=>void)=>documentListeners.get(name)?.delete(fn),createElement:()=>{const node=new KineticNode();node.animateFault=newNodeFault;if(unsupported)(node as unknown as {animate:undefined}).animate=undefined;return node;}} as unknown as Document;
 globalThis.window={matchMedia:()=>media,addEventListener:(name:string,fn:()=>void)=>{let set=listeners.get(name);if(!set){set=new Set();listeners.set(name,set);}set.add(fn);},removeEventListener:(name:string,fn:()=>void)=>listeners.get(name)?.delete(fn)} as unknown as Window&typeof globalThis;
 globalThis.ResizeObserver=class{private fn:()=>void;constructor(callback:ResizeObserverCallback){this.fn=()=>callback([],this as unknown as ResizeObserver);observers.add(this.fn);}observe():void{}unobserve():void{}disconnect():void{observers.delete(this.fn);}} as unknown as typeof ResizeObserver;
 globalThis.setTimeout=((fn:()=>void,delay:number)=>{const id=nextId++;timers.set(id,{fn,due:time+delay});return id;}) as unknown as typeof setTimeout;
 globalThis.clearTimeout=((id:number)=>{const timer=timers.get(id);if(timer)cancelled.set(id,timer.fn);timers.delete(id);}) as unknown as typeof clearTimeout;
 return {root,area,board,hud,player,enemy,cells,timers,cancelled,body,
  tick(ms:number):void{time+=ms;for(const [id,timer] of [...timers])if(timer.due<=time){timers.delete(id);timer.fn();}},
  fire(name:string):void{for(const fn of [...listeners.get(name)??[]])fn();},
  settings(detail:{short:boolean;lowMotion:boolean}):void{body.dataset.reducedMotion=String(detail.lowMotion);for(const fn of documentListeners.get('game1:presentation-settings')??[])fn({detail} as unknown as Event);},
  systemMotion(reduced:boolean):void{media.matches=reduced;for(const fn of mediaListeners)fn();},
  layout():void{for(const fn of observers)fn();},
  listenerCount(name:string):number{return listeners.get(name)?.size??0;},
  failNewAnimations():void{newNodeFault=true;},
  omitWAAPI():void{unsupported=true;},
  restore():void{Object.assign(globalThis,original);},
 };
}
