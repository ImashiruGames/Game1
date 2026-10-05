export interface ClickPoint {readonly clientX:number;readonly clientY:number;readonly detail:number}
/** 日本語: 取消でボタンが入れ替わった直後、同じ場所の続け押しだけを受け止める。
 * English: A different pointer target area or keyboard activation remains immediately usable.
 */
export function createCancelClickGuard(now:()=>number=()=>performance.now()){
 let cancelled:{x:number;y:number;until:number}|null=null;
 return {
  mark(event:ClickPoint):void{cancelled=event.detail>0?{x:event.clientX,y:event.clientY,until:now()+500}:null;},
  blocks(event:ClickPoint):boolean{
   if(!cancelled||event.detail===0)return false;
   if(now()>=cancelled.until){cancelled=null;return false;}
   if(Math.hypot(event.clientX-cancelled.x,event.clientY-cancelled.y)<=8)return true;
   cancelled=null;return false;
  },
  reset():void{cancelled=null;},
 };
}
