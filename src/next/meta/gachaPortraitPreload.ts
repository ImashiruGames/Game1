import type {RevealClock} from './gachaRevealState.ts';
export const PORTRAIT_FALLBACK_DELAY=2500;
export type PortraitStatus='loading'|'ready'|'failed';
type PortraitImage=Pick<HTMLImageElement,'src'|'decoding'|'onload'|'onerror'|'complete'|'naturalWidth'|'decode'>;
const browserClock:RevealClock={now:()=>performance.now(),set:(fn,delay)=>setTimeout(fn,delay),clear:handle=>clearTimeout(handle as ReturnType<typeof setTimeout>)};
/** 日本語: 読込と復号を待つ。失敗・時間切れは名前付きの代替表示で先へ進める。
 * English: Wait for load/decode, then use an explicit fallback on failure or timeout. */
export function preloadGachaPortraits(sources:readonly string[],onSettled:(src:string)=>void,makeImage:()=>PortraitImage=()=>new Image(),clock:RevealClock=browserClock){
 let disposed=false;
 const statuses=new Map<string,PortraitStatus>(),images:PortraitImage[]=[],timers=new Map<string,unknown>();
 for(const src of new Set(sources)){
  statuses.set(src,'loading');const img=makeImage();images.push(img);img.decoding='async';
  const settle=(status:PortraitStatus)=>{if(disposed||statuses.get(src)!=='loading')return;statuses.set(src,status);const timer=timers.get(src);if(timer!==undefined)clock.clear(timer);timers.delete(src);img.onload=null;img.onerror=null;onSettled(src);};
  const loaded=()=>{if(!img.naturalWidth){settle('failed');return;}void img.decode().then(()=>settle('ready'),()=>settle('failed'));};
  img.onload=loaded;img.onerror=()=>settle('failed');timers.set(src,clock.set(()=>settle('failed'),PORTRAIT_FALLBACK_DELAY));img.src=src;if(img.complete)loaded();
 }
 return {status:(src:string)=>statuses.get(src),settled:(src:string)=>statuses.get(src)!=='loading',destroy(){disposed=true;for(const timer of timers.values())clock.clear(timer);timers.clear();for(const img of images){img.onload=null;img.onerror=null;}}};
}
