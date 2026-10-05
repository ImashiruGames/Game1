/** Deterministic lifecycle harness. This does not claim rendered-browser coverage. */
export class TestNode extends EventTarget {
 style={setProperty(_name:string,_value:string){}};
 className='';dataset:Record<string,string>={};textContent:string|null='';src='';alt='';open=false;isConnected=false;
 children:TestNode[]=[];parent?:TestNode;ownerDocument!:TestDocument;
 attributes=new Map<string,string>();selectors=new Map<string,TestNode>();
 set innerHTML(value:string){for(const match of value.matchAll(/class="([^"]+)"/g)){const n=new TestNode();n.className=match[1]!;n.ownerDocument=this.ownerDocument;for(const name of n.className.split(' '))this.selectors.set(`.${name}`,n);}}
 setAttribute(key:string,value:string){this.attributes.set(key,value);if(key==='open')this.open=true;}
 removeAttribute(key:string){this.attributes.delete(key);if(key==='open')this.open=false;}
 querySelector<T=TestNode>(selector:string):T|null{return this.selectors.get(selector) as T??null;}
 append(node:TestNode){this.children.push(node);node.parent=this;node.isConnected=true;}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);this.isConnected=false;}
 showModal(){this.open=true;}
 close(){this.open=false;this.dispatchEvent(new Event('close'));}
 focus(){this.ownerDocument.activeElement=this;}
}
class TrackedTarget extends EventTarget {
 counts=new Map<string,number>();
 override addEventListener(type:string,callback:EventListenerOrEventListenerObject|null,options?:AddEventListenerOptions|boolean){super.addEventListener(type,callback,typeof options==='boolean'?{capture:options}:options);this.counts.set(type,(this.counts.get(type)??0)+1);}
 override removeEventListener(type:string,callback:EventListenerOrEventListenerObject|null,options?:EventListenerOptions|boolean){super.removeEventListener(type,callback,typeof options==='boolean'?{capture:options}:options);this.counts.set(type,(this.counts.get(type)??0)-1);}
 get listenerCount(){return [...this.counts.values()].reduce((a,b)=>a+b,0);}
}
export class TestWindow extends TrackedTarget {
 now=0;nextId=0;reduced=false;
 timers=new Map<number,{at:number;fn:()=>void}>();
 performance={now:()=>this.now};HTMLElement=TestNode;
 matchMedia=()=>({matches:this.reduced});
 setTimeout=(fn:()=>void,ms:number)=>{const id=++this.nextId;this.timers.set(id,{at:this.now+ms,fn});return id;};
 clearTimeout=(id:number)=>{this.timers.delete(id);};
 tick(ms:number){const until=this.now+ms;while(true){const next=[...this.timers.entries()].filter(([,t])=>t.at<=until).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;this.now=next[1].at;this.timers.delete(next[0]);next[1].fn();}this.now=until;}
}
export class TestDocument extends TrackedTarget {
 defaultView=new TestWindow();body=new TestNode();activeElement:TestNode|null=null;
 constructor(){super();this.body.ownerDocument=this;this.body.isConnected=true;}
 createElement(){const node=new TestNode();node.ownerDocument=this;return node;}
}
export function setup(){const doc=new TestDocument();const old=globalThis.document;globalThis.document=doc as unknown as Document;return {doc,win:doc.defaultView,dialog:()=>doc.body.children[0]!,restore:()=>{globalThis.document=old;}};}
export function keyEvent(type:string,key:string,repeat=false){const event=new Event(type,{cancelable:true});Object.assign(event,{key,repeat});return event;}
