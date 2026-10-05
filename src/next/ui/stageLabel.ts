// 日本語: 階の呼び方。通常ランは「STAGE n」、深層は別ステージとして「深層 nF」。表示専用。
// English: Floor naming. Standard runs read "STAGE n"; the deep stage reads "深層 nF". Presentation only.
let deep=false;
export function setDeepStage(value:boolean):void{deep=value;}
export function isDeepStage():boolean{return deep;}
export function stageLabel(n:number,pad=false):string{const v=pad?String(n).padStart(2,'0'):String(n);return deep?`深層 ${v}F`:`STAGE ${v}`;}
