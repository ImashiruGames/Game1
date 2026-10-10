import { transformationStatus, experimentAmountLabel, foundationStatus } from './presentation.ts';
import { pairedConfig, parseSetupFields } from './settings.ts';
import { skillName } from './engine/skillCatalog.ts';
import { ownsSquare } from './mechanics.ts';
import './style.css';
import { LabSession, choices } from './session.ts';
import { proposals, proposalOf } from './model.ts';
import type { ProposalId } from './model.ts';
import { labFixtures, fixtureConfig, preparedCases } from './fixtures.ts';
import { getDropOptions, cellKey, isPlayable } from './engine/board.ts';
import { getAvailableBoardSkills } from './engine/skills.ts';
import { previewExperimentAction, hasExperimentAction } from './boardActions.ts';
import type { ExperimentAction } from './boardActions.ts';
import type { Cell } from './engine/types.ts';
import { needsTurnStart } from './engine/turnLifecycle.ts';
import type { BattleAction, BattleEvent, CharacterId, EnemyId } from './engine/types.ts';
const app=document.querySelector<HTMLDivElement>('#app')!;
let selected:ProposalId|'none'='A061', fixture='foundation-on', character:CharacterId='blue',enemy:EnemyId='marujiro',seed=1,auto=true;
let session=new LabSession(fixtureConfig(fixture,character,enemy,seed,selected));
let setupOpen=false, targetMode=false;let targets:Cell[]=[];let pairedSkill:ProposalId='A061';const priorSessions:ReturnType<LabSession['export']>[]=[];
let message='天井の▼を選んで投入します。';
const esc=(s:unknown)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
function eventText(event:BattleEvent):string {
 if(event.type==='experiment')return `${event.skill} ${event.triggered?'発動':'不発'}：${event.detail} / ${experimentAmountLabel(event)}${event.actual!==undefined?` / 実量 ${event.actual}`:''}`;
 if(event.type==='attack')return`${event.actor==='player'?'自分':'敵'} ${event.axis} ${event.linkCount}リンク：${event.damage}ダメージ / HP ${event.hpBefore}→${event.hpAfter}（実損失 ${Math.min(Math.max(0,event.hpBefore),event.damage)}）`;
 if(event.type==='heal')return`${event.actor==='player'?'自分':'敵'} 回復 ${event.amount}（予定${event.requestedAmount}） / HP ${event.hpBefore}→${event.hpAfter}`;
 if(event.type==='drop')return`${event.actor==='player'?'自分':'敵'} ${event.landing.col+1}列 ${event.landing.row+1}行へ投入`;
 if(event.type==='damage')return`${event.source}：${event.target==='enemy'?'敵':'自分'}に${event.damage} / HP ${event.hpBefore}→${event.hpAfter}`;
 if(event.type==='gauge')return`ゲージ ${event.before}→${event.after}（${event.source}）`;
 if(event.type==='battle-end')return event.result.winner==='player'?'勝利':'敗北';
 return JSON.stringify(event);
}
function act(action:BattleAction){targetMode=false;targets=[];const r=session.act(action);message=r.accepted?'行動を記録しました':`実行できません：${r.reason}`;if(r.accepted&&auto){if(session.state.actor==='enemy'&&!session.state.result)session.act({type:'enemy'});if(needsTurnStart(session.state))session.act({type:'start-turn'});}render();}
function restart(config=fixtureConfig(fixture,character,enemy,seed,selected==='none'?undefined:selected)){
 if(session.records.length)priorSessions.push(session.export());targetMode=false;targets=[];setupOpen=false;
 session=new LabSession(config);selected=config.experiment??'none';fixture=config.id;seed=config.seed;character=config.characterId??'blue';if(config.enemyId)enemy=config.enemyId;
 message='同じ初期状態から開始しました。';render();
}
function commitSetup(){
 const value=(id:string)=>(app.querySelector<HTMLInputElement|HTMLSelectElement>(`#${id}`)!).value;
 const fields=parseSetupFields({skill:value('skill'),fixture:value('fixture'),character:value('character'),enemy:value('enemy'),seed:value('seed')},enemy);
 if(!fields){message='シードは0〜4294967295の整数を入力してください。設定はまだ反映していません。';app.querySelector<HTMLElement>('.status')!.textContent=message;return;}
 ({selected,fixture,character,enemy,seed}=fields);if(selected!=='none')pairedSkill=selected;restart();
}
function selectedAction():ExperimentAction|undefined{const id=session.state.config.experiment;if(!id)return;const ids=targets.flatMap(cell=>{const b=session.state.boxes.find(box=>cellKey(box)===cellKey(cell));return b?[b.id]:[];});return{type:'experiment-action',skillId:id,...(id==='B011'?{start:targets[0],end:targets[1]}:{targetIds:ids})} as ExperimentAction;}
function loadCase(kind:'favorable'|'unfavorable'){const id=selected==='none'?pairedSkill:selected;const entry=preparedCases.find(c=>c.skill===id&&c.kind===kind)!;fixture=entry.config.id;seed=entry.config.seed;character=entry.config.characterId??'blue';auto=false;restart();}
function render(){
 const s=session.state,b=s.config.board,options=getDropOptions(s),available=choices(s),cells=new Map(s.boxes.map(x=>[cellKey(x),x]));
 const form=transformationStatus(s);
 const pending=needsTurnStart(s),canAct=s.actor==='player'&&!s.result&&!pending,canDrop=canAct&&!targetMode;
 const draft=targetMode?selectedAction():undefined,preview=draft?previewExperimentAction(s,draft):undefined;
 const visibleFixtures=[...labFixtures,...preparedCases.filter(c=>c.skill===(selected==='none'?pairedSkill:selected)).map(c=>c.config)];
 const extraSkills=s.build?.slots.filter(x=>x!==null)??[];const emptySlots=Math.max(0,2-extraSkills.length-(s.config.experiment?1:0));
 const condition=s.config.experiment==='A061'?foundationStatus(s):s.config.experiment==='A062'?`現在：自分の2×2 ${ownsSquare(s)?'あり / 敵リンクを2軽減':'なし / 軽減なし'}`:'';
 const records=session.records;const triggers=records.flatMap(r=>r.events).filter(e=>e.type==='experiment');
 app.innerHTML=`<header><a href="../next/">← Game1</a><span>GAME1 / EXPERIMENT LAB 0.2.3</span><a href="../docs/skill-experiments/assessment.html">25案の評価</a><a href="../docs/proposals/skill_ideas_explorer_v1.html">設計カタログ</a></header>
 <main><section class="settings"><div class="title"><h1>スキル試験場</h1><span class="badge">実験専用</span></div><details id="setup" ${setupOpen?'open':''}><summary>試行の条件を変更：${s.config.experiment??'装備なし'} / ${esc(s.config.title)} / seed ${s.config.seed}</summary>
 <div class="controls"><label>装備する案<select id="skill"><option value="none" ${selected==='none'?'selected':''}>装備なし / 比較用</option>${proposals.map(p=>`<option value="${p.id}" ${p.id===selected?'selected':''} ${!p.implemented?'disabled':''}>${p.id} ${p.name}${p.implemented?'':'（準備中）'}</option>`).join('')}</select></label>
 <label>盤面<select id="fixture">${visibleFixtures.map(f=>`<option value="${f.id}" ${f.id===fixture?'selected':''}>${f.title}</option>`).join('')}</select></label>
 <label>自分<select id="character" ${fixture.startsWith('case:')?'disabled':''}><option value="blue" ${character==='blue'?'selected':''}>アオイ / 固定：ヘルス</option><option value="red" ${character==='red'?'selected':''}>アカリ / 固定：成長する火</option></select></label>
 <label>敵<select id="enemy" ${fixture.startsWith('case:')?'disabled':''}>${fixture.startsWith('case:')?'<option value="fixture" selected>検証盤面の固定値</option>':''}${[['marujiro','マルジロ'],['hikikizan','ヒキキザン'],['nigirin','ニギリン'],['merarun','メラルン']].map(([id,n])=>`<option value="${id}" ${!fixture.startsWith('case:')&&enemy===id?'selected':''}>${n}</option>`).join('')}</select></label>
 <label>乱数シード<input id="seed" type="number" min="0" max="4294967295" step="1" value="${seed}"></label></div>
 <div class="toolbar"><button id="restart">この条件で再開始</button><button id="compare">${selected==='none'?`${pairedSkill}を戻して比較`:'装備なしで同じ条件を再開始'}</button><label class="check"><input id="auto" type="checkbox" ${auto?'checked':''}>敵を自動で進める</label></div></details>
 <div class="quick-controls"><label>実験<select id="quick-skill"><option value="none" ${selected==='none'?'selected':''}>装備なし</option>${proposals.filter(p=>p.implemented).map(p=>`<option value="${p.id}" ${selected===p.id?'selected':''}>${p.id} ${p.name}</option>`).join('')}</select></label><button id="favorable">発動盤面</button><button id="unfavorable">境界盤面</button><button id="free-play">自由対戦</button><button id="paired">${selected==='none'?`${pairedSkill}を装備`:'装備なしで比較'}</button></div><div class="skill-card"><strong>${s.config.experiment?esc(proposalOf(s.config.experiment).name):'装備なし'}</strong><span>${s.config.experiment?esc(proposalOf(s.config.experiment).description):'キャラの固定スキルと盤面スキルのみ。実験効果は発生しません。'}</span>${condition?`<span class="condition">${condition}</span>`:''}<small>固定：${s.build?skillName(s.build.fixed.id,s.build.fixed.rank):'設定なし'} / ${extraSkills.map(skill=>skillName(skill.id,skill.rank)).join('・')||'追加の既存スキルなし'} / 実験${s.config.experiment?'1':'0'}枠 / 空き${emptySlots}枠</small></div></section>
 <section class="play"><div class="board-panel"><div class="hud"><div><small>自分 / ${s.config.characterId==='blue'?'アオイ':'アカリ'}</small><strong>${Math.max(0,s.hp.player.current)}<em> / ${s.hp.player.max}</em></strong></div><div class="turn">${s.result?(s.result.winner==='player'?'勝利':'敗北'):`${s.turn}手目 / ${s.actor==='player'?'自分の手番':'敵の手番'}`}<small>ゲージ ${s.gauge}</small></div><div><small>敵</small><strong>${Math.max(0,s.hp.enemy.current)}<em> / ${s.hp.enemy.max}</em></strong></div></div>
 <div class="form-banner ${form.active?'active':''}" aria-label="変化状態"><strong>${esc(form.label)}</strong>${form.detail?`<span>${esc(form.detail)}</span>`:''}</div><p class="scenario">${esc(s.config.description)}</p><div class="board" style="--cols:${b.width}">${Array.from({length:b.height},(_,row)=>Array.from({length:b.width},(_,col)=>{const box=cells.get(`${row},${col}`);const o=options.find(x=>x.spawn.row===row&&x.spawn.col===col);return`<div class="cell ${!isPlayable(b,{row,col})?'terrain':''} ${box?box.owner:''} ${targets.some(t=>t.row===row&&t.col===col)?'selected':''} ${box&&preview?.affected.includes(box.id)?'affected':''}" data-row="${row}" data-col="${col}">${o?`<button class="drop" data-drop="${o.id}" aria-label="${col+1}列 ${row+1}行天井から投入" ${!o.available||!canDrop?'disabled':''}>▼</button>`:''}${targetMode&&isPlayable(b,{row,col})?`<button class="target-cell" data-target-row="${row}" data-target-col="${col}" aria-label="${col+1}列${row+1}行を対象にする"></button>`:''}${box?`<span title="${esc(box.id)}">${box.owner==='player'?'P':box.owner==='enemy'?'E':'N'}</span>`:''}</div>`}).join('')).join('')}</div>
 <div class="legend">P 自分　E 敵　N 中立　■ 固定地形</div>${s.config.experiment&&proposalOf(s.config.experiment).kind==='action'?`<div class="target-controls"><button id="target-mode" ${!canAct||!hasExperimentAction(s)?'disabled':''}>${s.config.experiment==='D001'?`瞑想を使う（あと${Math.max(0,(s.experiment?.meditationReadyAt??0)-(s.experiment?.normalActions??0))}手）`:'盤面から対象を選ぶ'}</button>${targetMode?`<p>${s.config.experiment==='B011'?'始点→終点の順に2マス（縦・横・45度）':s.config.experiment==='B019'?'交換する箱を2個':'箱を1個'}。対象 ${preview?.affected.length??0}個 / ${esc(preview?.reason??'')}</p><button id="confirm-target" ${!preview?.valid?'disabled':''}>この対象で実行</button><button id="cancel-target">取消（Esc）</button>`:''}</div>`:''}<p role="status" class="status">${esc(message)}</p><div class="toolbar"><button id="enemy-step" ${s.actor!=='enemy'||s.result?'disabled':''}>敵の行動を進める</button><button id="bonus" ${!pending?'disabled':''}>アカリの追加投入</button><button id="skip" ${!canDrop?'disabled':''}>投入不能ならスキップ</button></div>
 ${canDrop&&getAvailableBoardSkills(s).length?`<details><summary>通常の盤面スキル</summary>${s.config.characterId==='blue'?`<label>消す行<select id="row">${Array.from({length:b.height},(_,i)=>`<option value="${i}">${i+1}行</option>`).join('')}</select></label><button id="board-skill">痛みはお互いに</button>`:'<button id="board-skill">ほむらの火種（HP消費）</button>'}</details>`:''}</div>
 <aside><section class="panel"><h2>いま選べる投入</h2><p class="muted">実行前の予測。${s.config.experiment==='A057'?'会心は含めず通常ダメージを表示（25%で最初の打が2倍）。':'今の盤面から選べる差を確認します。'}</p><div class="choice-list">${available.map(c=>`<button data-drop="${c.id}" ${!canDrop?'disabled':''}><b>${c.col+1}列</b><span>実ダメージ ${c.damage} / 回復 ${c.healing}</span><small>実験発動 ${c.triggers}回</small></button>`).join('')||'<p>今は投入待ちではありません</p>'}</div><p>合法候補 ${available.length} / 効果の種類 ${new Set(available.map(c=>c.signature)).size}</p></section>
 <section class="panel"><h2>この試行の記録</h2><div class="stats"><span>行動 <b>${records.filter(r=>r.accepted).length}</b></span><span>判定 <b>${triggers.length}</b></span><span>発動 <b>${triggers.filter(e=>e.type==='experiment'&&e.triggered).length}</b></span></div><button id="export">操作と結果をJSON保存</button><p class="muted">勝率や火力だけでは「面白さ」を確定できません。発動の分かりやすさ、選択の変化、待ち時間も別に評価します。</p></section></aside></section>
 <section class="panel log"><h2>行動ログ</h2>${records.length?records.slice().reverse().map(r=>`<details ${r===records.at(-1)?'open':''}><summary>#${r.index} ${r.action.type} / ${r.before.actor==='player'?'自分':'敵'} / ${r.accepted?'実行':'却下'}</summary><ul>${r.events.map(e=>`<li class="${e.type==='experiment'?'exp-event':''}">${esc(eventText(e))}</li>`).join('')||`<li>${esc(r.reason??'効果なし')}</li>`}</ul></details>`).join(''):'<p>投入すると、判定と実HPの変化をここに記録します。</p>'}</section></main>`;
 app.querySelector<HTMLSelectElement>('#skill')!.onchange=e=>{selected=(e.target as HTMLSelectElement).value as typeof selected;if(selected!=='none')pairedSkill=selected;};
 app.querySelector<HTMLSelectElement>('#quick-skill')!.onchange=e=>{selected=(e.target as HTMLSelectElement).value as typeof selected;if(selected!=='none')pairedSkill=selected;fixture='open';seed=1;restart();};
 app.querySelector<HTMLDetailsElement>('#setup')!.ontoggle=e=>{setupOpen=(e.target as HTMLDetailsElement).open;};
 app.querySelector('#favorable')!.addEventListener('click',()=>loadCase('favorable'));
 app.querySelector('#unfavorable')!.addEventListener('click',()=>loadCase('unfavorable'));
 app.querySelector('#free-play')!.addEventListener('click',()=>{fixture='open';restart();});
 app.querySelector<HTMLSelectElement>('#fixture')!.onchange=e=>{fixture=(e.target as HTMLSelectElement).value;seed=visibleFixtures.find(f=>f.id===fixture)!.seed;app.querySelector<HTMLInputElement>('#seed')!.value=String(seed);const prepared=preparedCases.find(c=>c.config.id===fixture);if(prepared)character=prepared.config.characterId??'blue';render();};
 app.querySelector<HTMLSelectElement>('#character')!.onchange=e=>{character=(e.target as HTMLSelectElement).value as CharacterId;};
 app.querySelector<HTMLSelectElement>('#enemy')!.onchange=e=>{enemy=(e.target as HTMLSelectElement).value as EnemyId;};
 app.querySelector<HTMLInputElement>('#seed')!.oninput=e=>{const n=Number((e.target as HTMLInputElement).value);if(Number.isSafeInteger(n)&&n>=0&&n<=0xffffffff)seed=n;};
 app.querySelector<HTMLInputElement>('#auto')!.onchange=e=>{auto=(e.target as HTMLInputElement).checked;};
 app.querySelector('#restart')!.addEventListener('click',commitSetup);
 const compare=()=>{const active=session.initial.experiment;if(active)pairedSkill=active;restart(pairedConfig(session.initial,active?undefined:pairedSkill));};
 app.querySelector('#compare')!.addEventListener('click',compare);app.querySelector('#paired')!.addEventListener('click',compare);
 app.querySelector('#target-mode')?.addEventListener('click',()=>{if(s.config.experiment==='D001')act({type:'experiment-action',skillId:'D001'});else{targetMode=true;targets=[];render();}});
 app.querySelector('#cancel-target')?.addEventListener('click',()=>{targetMode=false;targets=[];render();});
 app.querySelector('#confirm-target')?.addEventListener('click',()=>{const action=selectedAction();if(action)act(action);});
 app.querySelectorAll<HTMLElement>('[data-target-row]').forEach(button=>button.addEventListener('click',()=>{const cell={row:Number(button.dataset.targetRow),col:Number(button.dataset.targetCol)};const max=s.config.experiment==='B011'||s.config.experiment==='B019'?2:1;if(targets.length>=max)targets=[];targets.push(cell);render();}));
 app.querySelectorAll<HTMLElement>('[data-drop]').forEach(button=>button.addEventListener('click',()=>act({type:'drop',candidateId:button.dataset.drop!})));
 app.querySelector('#enemy-step')!.addEventListener('click',()=>act({type:'enemy'}));
 app.querySelector('#bonus')!.addEventListener('click',()=>act({type:'start-turn'}));
 app.querySelector('#skip')!.addEventListener('click',()=>act({type:'skip'}));
 app.querySelector('#board-skill')?.addEventListener('click',()=>act(s.config.characterId==='blue'?{type:'board-skill',skillId:'pain-shared',row:Number(app.querySelector<HTMLSelectElement>('#row')!.value)}:{type:'board-skill',skillId:'ember'}));
 app.querySelector('#export')!.addEventListener('click',()=>{const blob=new Blob([JSON.stringify({...session.export(),previousTrials:priorSessions},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`game1-lab-${s.config.experiment??'baseline'}-${s.config.seed}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
}
render();

document.addEventListener('keydown',event=>{if(event.key==='Escape'&&targetMode){targetMode=false;targets=[];render();}});
