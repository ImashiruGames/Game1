import { freezeTargets, randomPlayerBoxes } from './monsterBehavior.ts';
import { assignBoxType } from './boxTypes.ts';
import {absorbBarrier} from './kitBoards.ts';
import { freeze } from './immutable.ts';
import { tuningOf } from './tuning.ts';
import { resolveActiveDrop } from './activeDrop.ts';
import { getDropOptions } from './board.ts';
import { settleBoxTypes } from './boxTypes.ts';
import { damageHp } from './combatEffects.ts';
import { gainGauge } from './gauge.ts';
import { sampleUniformIndex } from './random.ts';
import type { BattleEvent, BattleState, BattleTransition, EnemyIntent, EnemyPhaseState, Link } from './types.ts';

const drop = { type: 'drop' } as const;
const wait = { type: 'wait' } as const;
/** 日本語: 自身の手番時計で予定を作る。入力回数や描画回数を周期にしない。
 * English: Plan from the enemy's own-turn clock, never insertion or render counts. */
export function bossIntent(state: BattleState): EnemyIntent | null {
  const rules = tuningOf(state.config).bosses;
  const bonus = state.config.enemyFixedDamageBonus ?? 0;
  if (state.config.enemyId === 'speed-core') return freeze({ type: 'sequence', steps: (state.enemyTurnCount + 1) % rules.speedPulseEvery === 0 ? [{ type: 'fixed-damage', amount: rules.speedPulseDamage + bonus }, drop] : [drop] });
  if (state.config.enemyId !== 'mother-core') return null;
  const previous = state.enemyPhase ?? { phase: 'normal', completedTurns: state.enemyTurnCount };
  // Compare the ratio directly: no rounding the threshold HP to a whole number.
  const critical = previous.phase === 'critical' || state.hp.enemy.current / state.hp.enemy.max <= rules.motherThresholdPercent / 100;
  const phase: EnemyPhaseState['phase'] = critical ? 'critical' : 'normal';
  const phaseChanged = phase !== previous.phase;
  const position = phaseChanged ? 0 : previous.completedTurns;
  const cycle = critical ? [[{ type: 'fixed-damage' as const, amount: rules.motherPulseDamage + bonus }, drop], [drop]] : [[drop], [drop], [drop], [drop], [wait], [drop, drop], [drop, drop]];
  return freeze({ type: 'sequence', phase, phaseChanged, steps: cycle[position % cycle.length]! });
}

/**日本語: 一投入の攻撃列は完了させる。KO後は次の投入・固定攻撃を始めない。
 * English: Finish an insertion's axis attacks, then stop before any later sub-action after KO. */
export function resolveEnemySequence(initial: BattleState, intent: Extract<EnemyIntent,{type:'sequence'}>): BattleTransition & { readonly activeOrigins: readonly { readonly originBoxId: string; readonly links: readonly Link[] }[] } {
  let state=initial;let guardUsed=false;const events:BattleEvent[]=[];
  const activeOrigins:Array<{originBoxId:string;links:readonly Link[]}>=[];
  const accept=(step:BattleTransition)=>{state=step.state;events.push(...step.events);};
  if (intent.phase) {
    state={...state,enemyPhase:{phase:intent.phase,completedTurns:(intent.phaseChanged?0:state.enemyPhase?.completedTurns??0)+1}};
    if(intent.phaseChanged)events.push({type:'enemy-phase',phase:'critical'});
  }
  for(const step of intent.steps){
    if(state.hp.player.current<=0||state.hp.enemy.current<=0)break;
    if(step.type==='wait'){events.push({type:'enemy-wait',actor:'enemy'});continue;}
    if(step.type==='fixed-damage'){
      const oldBarrier=state.barrier??0,guard=absorbBarrier(state,step.amount);state=guard.state;if(guard.absorbed)events.push({type:'barrier',before:oldBarrier,after:state.barrier??0});
      const change=damageHp(state.hp.player,guard.amount);
      state={...state,hp:{...state.hp,player:change.hp}};
      events.push({type:'damage',actor:'enemy',target:'player',source:'boss-fixed',damage:guard.amount,hpBefore:change.before,hpAfter:change.after});
      accept(gainGauge(state,change.actual*tuningOf(state.config).gauge.damagePerHp,'damage'));
      continue;
    }
    if(step.type==='freeze'){
      const ids=freezeTargets(state,step.count).map(b=>b.id), targets=new Set(ids);
      state={...state,boxes:state.boxes.map(b=>targets.has(b.id)?assignBoxType(b,'frozen'):b)};
      events.push({type:'enemy-box-changed',boxIds:ids,boxType:'frozen'});continue;
    }
    if(step.type==='absolute-zero'||step.type==='neutralize'){
      // 日本語: ヒョクル=絶対零度へ上書き、モコウサギ=中立化（タイプは維持）。English: Hyokuru overwrites to absolute zero; Mokousagi neutralizes ownership, keeping type.
      const pick=randomPlayerBoxes(state,step.count,b=>step.type==='absolute-zero'?b.type!=='absolute-zero':true),targets=new Set(pick.ids);
      state={...state,rngState:pick.rngState,boxes:state.boxes.map(b=>!targets.has(b.id)?b:step.type==='absolute-zero'?assignBoxType(b,'absolute-zero'):{...b,owner:'neutral' as const})};
      events.push({type:'enemy-box-changed',boxIds:pick.ids,boxType:step.type==='absolute-zero'?'absolute-zero':'neutral'});continue;
    }
    if(step.type==='rubble-drop'){
      // 日本語: ゼロガード・X。ランダムな放出点からガレキの中立箱。リンク・形・トゲは発生しない受動的な落下。
      // English: Zeroguard-X drops a neutral rubble box from a random emitter; passive, so no links, shapes or thorns.
      const open=getDropOptions(state).filter(o=>o.available&&o.landing);if(!open.length){events.push({type:'enemy-wait',actor:'enemy'});continue;}
      const roll=sampleUniformIndex(state.rngState,open.length),option=open[roll.index]!;let next=state.nextBoxId;while(state.boxes.some(b=>b.id===`drop:${next}`))next+=1;
      const box={id:`drop:${next}`,...option.landing!,owner:'neutral' as const,type:'rubble' as const,status:'normal' as const};
      state={...state,rngState:roll.rngState,nextBoxId:next+1,boxes:[...state.boxes,box]};
      events.push({type:'drop',actor:'enemy',box,candidateId:option.id,spawn:option.spawn,landing:option.landing!,path:option.path});
      const settled=settleBoxTypes(state.config.board,state.boxes);state={...state,boxes:settled.boxes};if(settled.crushed.length)events.push({type:'rubble-crushed',boxIds:settled.crushed});
      continue;
    }
    const legal=getDropOptions(state).filter(o=>o.available);
    if(!legal.length){
      const hp=state.hp.player.current;
      events.push({type:'blocked',actor:'enemy',plannedAction:'drop'},{type:'instant-kill',actor:'enemy',target:'player',damage:hp,hpBefore:hp,hpAfter:0});
      state={...state,hp:{...state.hp,player:{...state.hp.player,current:0}}};
      accept(gainGauge(state,hp*tuningOf(state.config).gauge.damagePerHp,'damage'));
      break;
    }
    const roll=sampleUniformIndex(state.rngState,legal.length);
    const result=resolveActiveDrop({...state,rngState:roll.rngState},legal[roll.index]!,guardUsed,step.boxType);
    accept(result);guardUsed=result.firstGuardUsed;activeOrigins.push({originBoxId:result.originBoxId,links:result.links});
    const settled=settleBoxTypes(state.config.board,state.boxes);
    state={...state,boxes:settled.boxes};
    if(settled.crushed.length)events.push({type:'rubble-crushed',boxIds:settled.crushed});
  }
  return {state,events,activeOrigins};
}
