import type { BattleEvent } from '../core/types.ts';

/** Original, deterministic oscillator recipes. No samples or game RNG. */
export interface Tone {
  readonly frequency: number;
  readonly endFrequency?: number;
  readonly duration: number;
  readonly delay?: number;
  readonly gain: number;
  readonly wave?: OscillatorType;
  readonly filter?: {readonly frequency:number;readonly endFrequency?:number;readonly Q?:number};
}
const note=(frequency:number,duration=.10,gain=.075,delay=0,wave:OscillatorType='sine',endFrequency?:number):Tone=>({frequency,duration,gain,delay,wave,endFrequency});
export function tonesForBattleEvent(event:BattleEvent):readonly Tone[]{
  switch(event.type){
    case 'drop':return [note(event.actor==='player'?190:135,.085,.075,0,'triangle',65)];
    case 'attack':{
      if(event.damage<=0)return [];
      const axis={vertical:0,horizontal:1,'diagonal-down':2,'diagonal-up':3}[event.axis];
      const f=[262,330,392,523][axis]!*(event.actor==='enemy'?.7:1);
      return [note(f,.10,.075,0,'triangle',f*.82)];
    }
    case 'heal':{
      const activation=event.source==='health'?[note(440,.07,.035)]:[];
      return event.amount>0?[...activation,note(523,.16,.055,.025),note(659,.16,.045,.09)]:activation;
    }
    case 'damage':{
      if(event.damage<=0)return [];
      if(event.actor===event.target)return [note(155,.17,.07,0,'triangle',80)];
      if(event.source==='blue-transformation')return [note(784,.11,.05,0,'sine',392)];
      if(event.source==='corner-strike'||event.source==='square-strike')return [note(330,.12,.065,0,'triangle',165),note(660,.10,.035,.015)];
      return [note(110,.15,.085,0,'triangle',55)];
    }
    case 'transformation':return [note(262,.2,.045),note(392,.22,.04,.07),note(523,.22,.04,.14)];
    case 'battle-end':return event.result.winner==='player'
      ?[note(392,.16,.05),note(523,.2,.045,.12),note(659,.28,.04,.24)]
      :[note(196,.22,.05),note(147,.3,.04,.14)];
    default:return [];
  }
}
