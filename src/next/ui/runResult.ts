import { skillName } from '../core/skillCatalog.ts';
import type { BattleState } from '../core/types.ts';
import type { BattleRunState } from '../app/BattleRun.ts';
const escape=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
/** 日本語: 保存されている事実だけ。ステージ内手数をラン累計として扱わない。
 * English: Render recorded facts only; stage-local counters are never run totals. */
export function runResultHtml(state:BattleState,run:BattleRunState|null,origin:{seed:number;startStage:number;deep?:boolean}):string {
 const retired=run?.status==='retired';
 const clear=run?.status==='cleared'&&state.result?.winner==='player';
 const title=retired?'帰還しました':clear?(origin.startStage===1&&run.stage===50?(origin.deep?'深層クリア！':'50階クリア！'):'検証ラン終了'):state.result?.winner==='player'?'勝利':'ラン終了';
 const build=state.build;const skills=build?[build.fixed,...build.slots].map((s,i)=>`${i===0?'固定':`自由${i}`}：${s?skillName(s.id,s.rank):'空き'}`):[];
 return `<h2>${title}</h2><p>${retired?'生存したままこのランを終了しました。続きからは再開できません。':clear?'このランはここで完了です。':state.result?.winner==='player'?'敵を撃破しました。':state.result?.reason==='enemy-blocked'?'敵の投入先がなくなり代替攻撃で敗北しました。':'HPが0になりこのランは終了しました。'}</p><dl class="result-facts"><div><dt>到達階</dt><dd>${run?.stage??1}</dd></div><div><dt>撃破した敵</dt><dd>${run?.defeatedCount??0}体</dd></div><div><dt>最終HP</dt><dd>${Math.max(0,state.hp.player.current)} / ${state.hp.player.max}</dd></div><div><dt>開始seed</dt><dd>${origin.seed}</dd></div></dl>${origin.startStage>1?`<p>検証開始階：${origin.startStage}（1階からの通しプレイではありません）</p>`:''}<section><h3>最終ビルド</h3><p>${skills.map(escape).join('<br>')}</p>${build?`<p>永久火力：3連＋${build.power[3]} / 4連＋${build.power[4]} / 5以上＋${build.power[5]}</p>`:''}</section>`;
}
