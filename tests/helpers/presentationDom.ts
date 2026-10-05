/** Minimal DOM contract harness, not a layout engine or rendered-browser test. */
export class PresentationNode {
 id='';className='';textContent:string|null='';innerHTML='';hidden=false;open=false;
 dataset:Record<string,string>={};attributes=new Map<string,string>();children:PresentationNode[]=[];
 parent:PresentationNode|null=null;
 listeners=new Map<string,((event:{animationName:string})=>void)[]>();
 classList={
  contains:(value:string)=>this.className.split(/\s+/).includes(value),
  add:(...values:string[])=>{this.className=[...new Set([...this.className.split(/\s+/).filter(Boolean),...values])].join(' ');},
  remove:(...values:string[])=>{this.className=this.className.split(/\s+/).filter(c=>!values.includes(c)).join(' ');},
  toggle:(value:string,force?:boolean)=>{const on=force??!this.classList.contains(value);if(on)this.classList.add(value);else this.classList.remove(value);return on;},
 };
 append(...nodes:PresentationNode[]):void{for(const node of nodes){node.parent=this;this.children.push(node);}}
 prepend(node:PresentationNode):void{node.parent=this;this.children.unshift(node);}
 remove():void{if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=null;}
 setAttribute(name:string,value:string):void{this.attributes.set(name,value);}
 removeAttribute(name:string):void{this.attributes.delete(name);}
 getAttribute(name:string):string|null{return this.attributes.get(name)??null;}
 querySelector<T=PresentationNode>(selector:string):T|null{
  for(const child of this.children){if(selector.startsWith('.')?child.classList.contains(selector.slice(1)):selector.startsWith('#')&&child.id===selector.slice(1))return child as T;
   const found=child.querySelector<T>(selector);if(found)return found;}
  return null;
 }
 addEventListener(type:string,listener:(event:{animationName:string})=>void):void{this.listeners.set(type,[...this.listeners.get(type)??[],listener]);}
 endAnimation(name:string):void{for(const listener of this.listeners.get('animationend')??[])listener({animationName:name});}
 asElement():HTMLElement{return this as unknown as HTMLElement;}
}
export function presentationDom(){
 const root=new PresentationNode();
 const node=(id='',classes='')=>{const n=new PresentationNode();n.id=id;n.className=classes;return n;};
 const game=node('','game'),hud=node('','hud'),player=node('','player-hud'),enemy=node('','enemy-hud'),name=node('enemy-name'),turn=node('turn'),hint=node('hint'),board=node('board'),actions=node('actions'),reward=node('reward'),end=node('end');
 root.append(game,reward,end);game.append(hud,turn,hint,board,actions);hud.append(player,enemy);enemy.append(name);
 const previous=globalThis.document;
 globalThis.document={createElement:()=>new PresentationNode()} as unknown as Document;
 return {root,game,player,enemy,name,turn,hint,board,actions,reward,end,restore(){globalThis.document=previous;}};
}
