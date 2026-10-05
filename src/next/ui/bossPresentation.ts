import type {BattleState} from '../core/types.ts';
import {getEnemyIntent} from '../core/index.ts';
import {tuningOf} from '../core/tuning.ts';

export interface BossCue {
 readonly kind:'speed'|'mother';
 readonly phase:'normal'|'pending'|'critical'|'finished';
 readonly danger:boolean;
 readonly symbol:string;
 readonly mark:string;
 readonly description:string;
}
/** Read the engine's exact-ratio intent. Displayed percentages never decide phase. */
export function bossCue(state:BattleState):BossCue|null {
 const id=state.config.enemyId;
 if(id!=='speed-core'&&id!=='mother-core')return null;
 const kind=id==='speed-core'?'speed':'mother';
 if(state.result||state.hp.enemy.current<=0)return {kind,phase:'finished',danger:false,symbol:'◆',mark:'BOSS',description:'ボス戦終了'};
 const rules=tuningOf(state.config).bosses,bonus=state.config.enemyFixedDamageBonus??0;
 if(kind==='speed')return {kind,phase:'normal',danger:false,symbol:'◆',mark:'BOSS',description:`中ボス · 自身${rules.speedPulseEvery}手番ごと固定${rules.speedPulseDamage+bonus}ダメージ＋投入`};
 const intent=getEnemyIntent(state),critical=intent.type==='sequence'&&intent.phase==='critical';
 if(!critical)return {kind,phase:'normal',danger:false,symbol:'◆',mark:'BOSS',description:`大ボス · HP${rules.motherThresholdPercent}%以下で次の相手手番から低HPループ`};
 const pending=state.enemyPhase?.phase!=='critical';
 const cycle=`固定${rules.motherPulseDamage+bonus}ダメージ＋投入 → 投入（相手手番ごとに交互）`;
 return {kind,phase:pending?'pending':'critical',danger:true,symbol:'▲',mark:pending?'予告':'低HP',description:pending?`HP${rules.motherThresholdPercent}%以下 · 次の相手手番から ${cycle}`:`低HPループ · ${cycle}`};
}
export function createBossPresentation(root:HTMLElement) {
 const enemy=root.querySelector<HTMLElement>('.enemy-hud')!;
 const name=root.querySelector<HTMLElement>('#enemy-name')!;
 const mark=document.createElement('span');mark.className='boss-phase-mark';mark.setAttribute('aria-hidden','true');mark.hidden=true;enemy.append(mark);
 let previousConfig:BattleState['config']|undefined,previousDanger:boolean|undefined;
 mark.addEventListener('animationend',event=>{if(event.animationName==='boss-phase-enter')mark.classList.remove('boss-phase-enter');});
 return {
  update(state:BattleState,motion:{readonly short:boolean;readonly lowMotion:boolean}):void {
   const cue=bossCue(state),changed=previousConfig!==state.config;
   if(changed){previousDanger=undefined;mark.classList.remove('boss-phase-enter');}
   previousConfig=state.config;
   if(!cue){mark.hidden=true;delete enemy.dataset.bossKind;delete enemy.dataset.bossPhase;delete enemy.dataset.bossDanger;enemy.removeAttribute('aria-label');name.removeAttribute('title');previousDanger=undefined;return;}
   const base=name.textContent?.replace(/^[◆▲]\s*/,'')??'';
   name.textContent=`${cue.symbol} ${base}`;name.title=cue.description;
   enemy.dataset.bossKind=cue.kind;enemy.dataset.bossPhase=cue.phase;enemy.dataset.bossDanger=String(cue.danger);
   enemy.setAttribute('aria-label',`${base} · ${cue.description}`);mark.textContent=cue.mark;mark.hidden=false;
   // The mark owns its accent, independent of the HUD turn animation.
   // One accent when real HP first crosses the threshold, never on every render/turn.
   if(cue.danger&&previousDanger===false&&!motion.short&&!motion.lowMotion)mark.classList.add('boss-phase-enter');
   if(!cue.danger||motion.short||motion.lowMotion)mark.classList.remove('boss-phase-enter');
   previousDanger=cue.danger;
  },
  reset():void {
   previousConfig=undefined;previousDanger=undefined;mark.hidden=true;mark.classList.remove('boss-phase-enter');
   delete enemy.dataset.bossKind;delete enemy.dataset.bossPhase;delete enemy.dataset.bossDanger;enemy.removeAttribute('aria-label');name.removeAttribute('title');
  },
 };
}
