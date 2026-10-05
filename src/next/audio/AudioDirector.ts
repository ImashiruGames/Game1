import type { BattleEvent } from '../core/types.ts';
import { tonesForBattleEvent } from './audioEventMap.ts';
import type { Tone } from './audioEventMap.ts';

type Voice={oscillator:OscillatorNode;gain:GainNode;filter:BiquadFilterNode|null;group:string;cleanup:()=>void};
export type AudioStatus='off'|'ready'|'resume'|'unavailable';
/** Presentation-only audio. Every public operation absorbs audio failures. */
export class AudioDirector {
  private context:AudioContext|null=null;
  private enabled=false;
  private effectsWanted=false;
  private hidden=false;
  private unavailable=false;
  private enableEpoch=0;
  private voices=new Set<Voice>();
  private seen=new WeakMap<object,Set<number>>();
  private listeners=new Set<()=>void>();
  private volumes=new Map<string,number>();
  private buses=new Map<string,GainNode>();
  private createContext:()=>AudioContext;
  constructor(createContext?:()=>AudioContext){
    this.createContext=createContext??(()=>{
      const ctor=globalThis.AudioContext??(globalThis as typeof globalThis&{webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
      if(!ctor)throw new Error('Web Audio unavailable');
      return new ctor();
    });
  }
  get status():AudioStatus{return !this.enabled?'off':this.unavailable?'unavailable':this.context?.state==='running'&&!this.hidden?'ready':'resume';}
  get currentTime():number{return this.context?.currentTime??0;}
  get effectsEnabled():boolean{return this.effectsWanted;}
  /** 効果音とBGMの希望を分離する。Unlocking music never opts into effects. */
  setEffectsEnabled(enabled:boolean):void{this.effectsWanted=enabled;if(!enabled)this.stop('effect');this.notify();}
  async enableEffectsGesture():Promise<boolean>{
    this.setEffectsEnabled(true);const ready=await this.enableGesture();return ready&&this.effectsWanted;
  }
  getVolume(group:string):number{return this.volumes.get(group)??1;}
  setVolume(group:string,value:number):void{
    if(!Number.isFinite(value))return;
    const volume=Math.min(1,Math.max(0,value));this.volumes.set(group,volume);
    try{this.buses.get(group)?.gain.setValueAtTime(volume,this.currentTime);}catch{/* Volume failure cannot affect game. */}
  }
  private bus(group:string,context:AudioContext):GainNode{
    let bus=this.buses.get(group);
    if(!bus){bus=context.createGain();bus.gain.setValueAtTime(this.getVolume(group),context.currentTime);bus.connect(context.destination);this.buses.set(group,bus);}
    return bus;
  }
  subscribe(listener:()=>void):()=>void{this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};}
  private notify():void{for(const listener of this.listeners){try{listener();}catch{/* UI must not affect audio/game. */}}}
  /** Call directly within click/pointer/key gesture; never await before a game action. */
  async enableGesture():Promise<boolean>{
    const epoch=++this.enableEpoch;this.enabled=true;let context:AudioContext|null=null;
    try{
      if(!this.context||this.context.state==='closed'){
        this.buses.clear();this.context=this.createContext();
        const owned=this.context;
        owned.onstatechange=()=>{if(this.context!==owned)return;if(owned.state!=='running')this.stop();else this.unavailable=false;this.notify();};
      }
      context=this.context;
      this.unavailable=false;
      if(context.state!=='running')await context.resume();
      if(this.context===context&&(context.state==='running'||epoch===this.enableEpoch))this.unavailable=false;
      this.notify();return this.status==='ready';
    }catch{
      // 古いresumeの失敗で新しい成功を消さない。Keep newer group unlocks intact.
      if(epoch===this.enableEpoch&&(!context||context===this.context))this.unavailable=context?.state!=='running';
      this.notify();return this.status==='ready';
    }
  }
  mute():void{this.enableEpoch++;this.enabled=false;this.effectsWanted=false;this.stop();this.notify();}
  setHidden(hidden:boolean):void{
    this.hidden=hidden;
    if(hidden){this.stop();try{void this.context?.suspend().catch(()=>{});}catch{/* Optional API failure. */}}
    this.notify();
  }
  /** Only pass events from the accepted resolution's animate loop, never preview. */
  playEvent(event:BattleEvent,resolution:object,eventIndex:number,signal?:AbortSignal):void{
    if(signal?.aborted)return;
    let indexes=this.seen.get(resolution);if(!indexes){indexes=new Set();this.seen.set(resolution,indexes);}
    if(indexes.has(eventIndex))return;
    indexes.add(eventIndex); // Muted/interrupted events are discarded, never replayed later.
    this.playTones(tonesForBattleEvent(event),'effect',signal);
  }
  playTones(tones:readonly Tone[],group='effect',signal?:AbortSignal):void{
    const context=this.context;
    if(!context||this.status!=='ready'||signal?.aborted||(group==='effect'&&!this.effectsWanted))return;
    for(const tone of tones){
      let voice:Voice|undefined;
      try{
        while(this.voices.size>=12){const first=this.voices.values().next().value as Voice|undefined;if(!first)break;this.endVoice(first);}
        const oscillator=context.createOscillator(),gain=context.createGain();
        const start=context.currentTime+Math.max(0,tone.delay??0),end=start+Math.max(.025,tone.duration);
        oscillator.type=tone.wave??'sine';
        oscillator.frequency.setValueAtTime(tone.frequency,start);
        if(tone.endFrequency)oscillator.frequency.exponentialRampToValueAtTime(tone.endFrequency,end);
        gain.gain.setValueAtTime(.0001,start);
        gain.gain.linearRampToValueAtTime(Math.min(.12,Math.max(.0001,tone.gain)),start+.008);
        gain.gain.exponentialRampToValueAtTime(.0001,end);
        let filter:BiquadFilterNode|null=null;
        if(tone.filter){
          try{
            filter=context.createBiquadFilter();filter.type='lowpass';
            filter.frequency.setValueAtTime(tone.filter.frequency,start);
            if(tone.filter.endFrequency)filter.frequency.exponentialRampToValueAtTime(tone.filter.endFrequency,end);
            filter.Q.setValueAtTime(Math.min(1,Math.max(.1,tone.filter.Q??.55)),start);
          }catch{try{filter?.disconnect();}catch{/* Optional filter unavailable. */}filter=null;oscillator.type='sine';}
        }
        oscillator.connect(filter??gain);filter?.connect(gain);gain.connect(this.bus(group,context));
        const abort=()=>{if(voice)this.endVoice(voice);};
        voice={oscillator,gain,filter,group,cleanup:()=>signal?.removeEventListener('abort',abort)};
        this.voices.add(voice);signal?.addEventListener('abort',abort,{once:true});
        const owned=voice;oscillator.onended=()=>this.releaseVoice(owned);
        oscillator.start(start);oscillator.stop(end+.01);
      }catch{if(voice)this.endVoice(voice);}
    }
  }
  private releaseVoice(voice:Voice):void{
    voice.cleanup();this.voices.delete(voice);
    try{voice.oscillator.disconnect();voice.filter?.disconnect();voice.gain.disconnect();}catch{/* Already disconnected. */}
  }
  private endVoice(voice:Voice):void{try{voice.oscillator.stop();}catch{/* Already stopped. */}this.releaseVoice(voice);}
  stop(group?:string):void{for(const voice of [...this.voices])if(group===undefined||voice.group===group)this.endVoice(voice);}
  reset():void{this.stop();this.seen=new WeakMap();}
  destroy():void{this.mute();this.listeners.clear();if(this.context){this.context.onstatechange=null;try{void this.context.close().catch(()=>{});}catch{/* Already closed. */}this.context=null;this.buses.clear();}}
}
