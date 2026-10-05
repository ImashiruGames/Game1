export const ROW_DOUBLE_TAP_MS = 420;
/** 日本語: 行選択中の同じ行への素早いポインタ2回だけを確定として扱う。
 * English: Keyboard activation only previews. The normal confirm button stays available.
 * The immutable battle snapshot prevents a gesture crossing a resolved action.
 */
export function createRowDoubleTap(now:()=>number=()=>performance.now()) {
 let armed:{row:number;at:number;snapshot:object}|null=null;
 return {
  tap(row:number,snapshot:object,pointer:boolean):boolean {
   if(!pointer||!Number.isInteger(row)||row<0){armed=null;return false;}
   const at=now(),previous=armed;
   if(previous?.row===row&&previous.snapshot===snapshot&&at>=previous.at&&at-previous.at<=ROW_DOUBLE_TAP_MS){armed=null;return true;}
   armed={row,at,snapshot};return false;
  },
  reset():void {armed=null;},
 };
}
