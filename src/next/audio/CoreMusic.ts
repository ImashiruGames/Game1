import type { AudioDirector } from './AudioDirector.ts';
import type { Tone } from './audioEventMap.ts';

/** Original 'Core Current: Orbital Glitch'. Composed patterns, never game RNG. */
const phrases:readonly (readonly (number|null)[])[]=[
  [62,null,69,null,74,77,null,69, null,72,null,76,null,69,null,null,
   65,null,72,null,null,76,74,null, 69,null,67,null,null,null,null,null],
  [null,74,null,69,65,null,72,null, 76,null,null,77,74,null,71,null,
   69,null,63,null,65,null,72,69, null,null,67,null,null,null,null,null],
  [62,null,null,null,69,null,null,76, null,null,74,null,null,null,71,null,
   65,null,null,72,null,null,69,null, null,67,null,null,null,null,null,null],
];
const bassPatterns:readonly (readonly (readonly [number,number])[])[]=[
  [[0,38],[7,45],[14,41],[20,43],[27,38]],
  [[0,38],[6,41],[13,36],[19,43],[26,45]],
  [[0,38],[11,41],[22,36]],
];
const kickPatterns:readonly (readonly number[])[]=[[0,6,15,20,27],[0,7,12,19,25,29],[0,11,22]];
const tickPatterns:readonly (readonly number[])[]=[[3,10,18,25],[2,5,10,17,23,28],[7,19]];
export const CORE_MUSIC_STEP_SECONDS=60/88/2;
export const CORE_MUSIC_CYCLE_STEPS=96;
export function midiFrequency(midi:number):number{return 440*2**((midi-69)/12);}
export function musicTonesForStep(step:number):readonly Tone[]{
  const index=((Math.floor(step)%CORE_MUSIC_CYCLE_STEPS)+CORE_MUSIC_CYCLE_STEPS)%CORE_MUSIC_CYCLE_STEPS;
  const phrase=Math.floor(index/32),slot=index%32,tones:Tone[]=[];
  const swing=slot%2===1?.026:0;
  const pitch=phrases[phrase]![slot];
  if(pitch!==null&&pitch!==undefined){
    // Triangle supplies glassy upper harmonics; sine leaves space in the third phrase.
    tones.push({frequency:midiFrequency(pitch),duration:phrase===2?.42:.21,gain:phrase===2?.010:.009,delay:swing,wave:phrase===1?'triangle':'sine'});
  }
  const bass=bassPatterns[phrase]!.find(([at])=>at===slot)?.[1];
  if(bass!==undefined){
    const frequency=midiFrequency(bass);
    tones.push({frequency,endFrequency:frequency*1.012,duration:phrase===2?.78:.56,gain:.012,delay:swing,wave:'sawtooth',filter:{frequency:[480,690,310][phrase]!,endFrequency:[150,210,120][phrase]!,Q:.55}});
  }
  if(kickPatterns[phrase]!.includes(slot))tones.push({frequency:136,endFrequency:58,duration:.10,gain:.007,delay:swing,wave:'sine'});
  if(tickPatterns[phrase]!.includes(slot))tones.push({frequency:[780,940,660][phrase]!,endFrequency:430,duration:.035,gain:.004,delay:swing,wave:'triangle',filter:{frequency:1350,endFrequency:550,Q:.4}});
  return tones;
}
export interface MusicAudio {
  readonly status:AudioDirector['status'];
  readonly currentTime:number;
  enableGesture():Promise<boolean>;
  playTones(tones:readonly Tone[],group?:string):void;
  stop(group?:string):void;
  subscribe(listener:()=>void):()=>void;
}
export type MusicTimer=(tick:()=>void)=>()=>void;
/** Fixed lookahead sequencer, independent of game timing, rendering and RNG. */
export class CoreMusic {
  private wanted=false;
  private cancelTimer:(()=>void)|null=null;
  private unsubscribe:()=>void;
  private nextStepAt=0;
  private step=0;
  private audio:MusicAudio;
  private timer:MusicTimer;
  constructor(audio:MusicAudio,timer:MusicTimer=tick=>{const id=setInterval(tick,25);return ()=>clearInterval(id);}){
    this.audio=audio;this.timer=timer;this.unsubscribe=audio.subscribe(()=>this.sync());
  }
  get enabled():boolean{return this.wanted;}
  /** Must be called in the explicit BGM button's gesture. */
  async enableGesture():Promise<boolean>{this.wanted=true;const ready=await this.audio.enableGesture();this.sync();return ready&&this.wanted;}
  setEnabled(enabled:boolean):void{this.wanted=enabled;this.sync();}
  private halt():void{this.cancelTimer?.();this.cancelTimer=null;this.audio.stop('music');}
  private sync():void{
    if(!this.wanted||this.audio.status!=='ready'){this.halt();return;}
    if(this.cancelTimer)return;
    this.step=0;this.nextStepAt=this.audio.currentTime+.035;
    this.cancelTimer=this.timer(()=>this.tick());this.tick();
  }
  private tick():void{
    if(!this.wanted||this.audio.status!=='ready'){this.halt();return;}
    const now=this.audio.currentTime;
    // A stalled/backgrounded timer never catches up missed notes in a burst.
    if(this.nextStepAt<now-.2){this.step=0;this.nextStepAt=now+.035;}
    let scheduled=0;
    while(this.nextStepAt<now+.10&&scheduled++<2){
      const delay=Math.max(0,this.nextStepAt-now);
      this.audio.playTones(musicTonesForStep(this.step).map(tone=>({...tone,delay:delay+(tone.delay??0)})),'music');
      this.step=(this.step+1)%CORE_MUSIC_CYCLE_STEPS;this.nextStepAt+=CORE_MUSIC_STEP_SECONDS;
    }
  }
  restart():void{this.halt();this.sync();}
  destroy():void{this.wanted=false;this.halt();this.unsubscribe();}
}
export function mountMusicControls(music:CoreMusic,audio:AudioDirector,host:HTMLElement):()=>void{
  const button=document.createElement('button');button.type='button';button.id='music-toggle';
  let pending=false,request=0;
  const update=()=>{
    const state=!music.enabled?'OFF':pending?'開始中':audio.status==='ready'?'ON':audio.status==='unavailable'?'再試行':'再開';
    button.textContent=`BGM\n${state}`;button.setAttribute('aria-pressed',String(music.enabled));
    button.setAttribute('aria-label',`BGM ${state}。${!music.enabled?'タップで開始':pending||audio.status==='ready'?'タップで停止':'タップで再開'}`);
    button.title=music.enabled&&audio.status==='unavailable'?'BGMを開始できませんでした。再度タップしてください':'オリジナル曲「Core Current: Orbital Glitch」。効果音とは別に切り替えます';
  };
  button.addEventListener('click',()=>{
    if(music.enabled&&(pending||audio.status==='ready')){request++;pending=false;music.setEnabled(false);update();return;}
    const id=++request;pending=true;void music.enableGesture().then(()=>{if(id===request){pending=false;update();}});update();
  });
  const unsubscribe=audio.subscribe(update);host.append(button);update();
  return ()=>{unsubscribe();button.remove();};
}
