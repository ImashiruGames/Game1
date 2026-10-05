import { monsterBehavior, freezeTargets } from '../core/monsterBehavior.ts';
import { getEnemyIntent } from '../core/skills.ts';
import { tuningOf } from '../core/tuning.ts';
import type { BattleState, EnemyIntent, EnemyPhaseState } from '../core/types.ts';

export interface EnemyIntentView {
  readonly label: string;
  readonly detail: string;
  readonly ownTurn: number;
  readonly action: string;
  readonly cycle: { readonly position: number; readonly length: number; readonly phase: EnemyPhaseState['phase'] | 'speed' | 'monster'; readonly steps: readonly string[] } | null;
  readonly active: boolean;
}

export function enemyActionLabel(intent: EnemyIntent): string {
  if (intent.type === 'drop') return '投入';
  if (intent.type === 'heal') return `HP+${intent.amount}`;
  if (intent.steps.length === 2 && intent.steps.every(step => step.type === 'drop')) return '投入×2';
  return intent.steps.map(step => step.type === 'freeze' ? `凍結 最大${step.count}` : step.type==='drop'&&step.boxType==='thorn' ? 'トゲ投入' : step.type === 'fixed-damage' ? `固定${step.amount}` : step.type === 'wait' ? '待機' : '投入').join('→');
}

/** The active plan may be a pre-action snapshot. Neither branch simulates a drop or advances RNG. */
export function enemyIntentView(state: BattleState, activeEnemyState: BattleState | null = null): EnemyIntentView {
  const source = activeEnemyState ?? state;
  const ownTurn = source.enemyTurnCount + 1;
  if (state.result && !activeEnemyState) return { label: '戦闘終了', detail: 'この戦闘の敵行動は終了しました。', ownTurn: source.enemyTurnCount, action: '', cycle: null, active: false };
  const intent = getEnemyIntent(source);
  const freezeStep=intent.type==='sequence'?intent.steps.find(step=>step.type==='freeze'):undefined;
  const targets=freezeStep?.type==='freeze'?freezeTargets(source,freezeStep.count):[];
  const action = freezeStep ? `凍結${targets.length}個${targets.length?'':'（対象なし）'}` : enemyActionLabel(intent);
  const active = activeEnemyState !== null;
  const prefix = active ? '実行' : '次';
  const rules = tuningOf(source.config).bosses;
  let cycle: EnemyIntentView['cycle'] = null;
  if (source.config.enemyId === 'speed-core') {
    cycle = { position: source.enemyTurnCount % rules.speedPulseEvery + 1, length: rules.speedPulseEvery, phase: 'speed', steps: [] };
  } else if (source.config.enemyId === 'mother-core' && intent.type === 'sequence') {
    const phase = intent.phase ?? 'normal';
    const position = intent.phaseChanged ? 0 : source.enemyPhase?.completedTurns ?? source.enemyTurnCount;
    const length = phase === 'critical' ? 2 : 7;
    cycle = { position: position % length + 1, length, phase, steps: [] };
  }
  const behavior=monsterBehavior(source.config.enemyId);
  if(behavior)cycle={position:source.enemyTurnCount%behavior.every+1,length:behavior.every,phase:'monster',steps:[]};
  if (cycle) {
    // Read the same intent function at each clock position, keeping the current phase and HP.
    // This is a schedule only: no board actions, random choices, or future HP predictions.
    const phase = cycle.phase;
    cycle = { ...cycle, steps: Array.from({ length: Math.min(cycle.length,32) }, (_, index) => enemyActionLabel(getEnemyIntent({ ...source, enemyTurnCount: index, enemyPhase: phase === 'speed'||phase==='monster' ? undefined : { phase, completedTurns: index } }))) };
  }
  const phaseText = cycle?.phase === 'critical' ? '低HP周期' : cycle?.phase === 'normal' ? '通常周期' : '周期';
  const targetText=freezeStep?`凍結対象：${targets.length?targets.map(b=>`${b.col+1}列・上から${b.row+1}段`).join('、'):'なし（今回は何もせず手番終了）'}。自分の操作で箱が変われば対象も更新します。`:behavior?.skill==='thorn'?'トゲは周囲8マスの能動投入に反応し、投入した側にダメージ。敵自身も対象です。':'';
  const detail = `${targetText}敵自身の${ownTurn}手番目${cycle ? `、${phaseText}${cycle.position}/${cycle.length}` : ''}。${active ? '実行中の予定' : '次の予定'}：${action}。${source.config.enemyId === 'mother-core' ? `HP${rules.motherThresholdPercent}%以下へ入ると次の敵手番から2手周期です。` : ''}投入×2は1手番の中で1回ずつ順に解決します。途中でKOなら残りは中止します。投入先の列は、行動時に決まります。`;
  return { label: `${prefix}${cycle ? ` ${cycle.position}/${cycle.length}` : ''} ${action}`, detail, ownTurn, action, cycle, active };
}

export function enemyIntentDetailsHtml(state: BattleState, activeEnemyState: BattleState | null = null): string {
  const view = enemyIntentView(state, activeEnemyState);
  if (!view.cycle) return '';
  return `<section class="skill-card boss-cycle-details"><h3>${view.cycle.phase==='monster'?'敵の行動周期':'ボスの行動周期'}</h3><p>${view.detail}</p><ol>${view.cycle.steps.map((step, index) => `<li${index + 1 === view.cycle!.position ? ' class="current" aria-current="step"' : ''}><span>${index + 1}</span>${step}${index + 1 === view.cycle!.position ? `<b>${view.active ? '実行中' : '次'}</b>` : ''}</li>`).join('')}</ol>${view.cycle.steps.length<view.cycle.length?`<p>長い周期のため、一覧は先頭${view.cycle.steps.length}手だけ表示しています。周期全体は${view.cycle.length}手です。</p>`:''}<p>敵自身の完了手番：${view.ownTurn - 1}。画面の全体手数や投入した箱数では数えません。通常周期の予告は現在のHPを基準にしています。</p></section>`;
}

export function renderEnemyIntent(host: HTMLElement, state: BattleState, activeEnemyState: BattleState | null = null): void {
  const view = enemyIntentView(state, activeEnemyState);
  host.textContent = view.label;
  host.title = view.detail;
  host.setAttribute('aria-label', view.detail);
  host.classList.toggle('boss-intent', view.cycle !== null);
}
