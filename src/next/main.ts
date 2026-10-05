import {preserveBoardTargetFocus} from './ui/boardFocus.ts';
import {stageLabel,setDeepStage} from './ui/stageLabel.ts';
import {controlIcon} from './ui/controlIcons.ts';
import {createBoxMaterialArrival} from './ui/boxMaterialArrival.ts';
import {installBoxInspection} from './ui/boxInspection.ts';
import {edgeEmitterStyle,edgeEmitterLabel,dropForCell} from './ui/edgeEmitters.ts';
import {skillHudHtml,skillInfoHtml} from './ui/skillHud.ts';
import {transformationIdentity} from './ui/transformationIdentity.ts';
import {isTerminalRun} from './app/BattleRun.ts';
import {canRetireCheckpoint,prepareRetiredCheckpoint} from './app/saveCheckpoint.ts';
import {boardSkillName} from './ui/kitInformation.ts';
import {kitBoardDefinition,kitBoardCatalog,isKitBoard,kitBoardTargets,canUseKitBoard,kitBoardOrientations} from './core/kitBoards.ts';
import type {BoardTarget} from './core/kitBoards.ts';
import {PRESENTATION_VERSION} from './version.ts';
import {reconcileSavedProgress} from './meta/reconciliation.ts';
import {boxTypeLabels} from './core/boxTypes.ts';
import {MusicSceneController} from './audio/musicScene.ts';
import {mountHome,rosterPortrait} from './meta/home.ts';
import {ProfileStore,freezeRunMeta,resultReceipt} from './meta/profile.ts';
import type {RunMeta} from './meta/profile.ts';
import {prepareDeparture} from './meta/departure.ts';
import {roster} from './meta/roster.ts';
import './style.css';
import {installImpactReview} from './ui/impactReview.ts';
import {energyReviewCases,energyReviewFixture} from './ui/energyReviewFixture.ts';
import {createEnergyLinks} from './ui/energyLinks.ts';
import {energyBoxMarkup,energyAppearance} from './ui/energyBox.ts';
import './ui/energyBox.css';
import {createPortraitViewer} from './ui/portraitViewer.ts';
import './ui/portraitViewer.css';
import './ui/dropMotion.css';
import {createBoardSkillPresentation} from './ui/boardSkillPresentation.ts';
import './ui/boardSkillPresentation.css';
import './ui/rowProjection.css';
import {createStageNumberCinematic} from './ui/stageNumberCinematic.ts';
import './ui/stageNumberCinematic.css';
import {createRowDoubleTap} from './ui/rowDoubleTap.ts';
import {createCancelClickGuard} from './ui/cancelClickGuard.ts';
import {projectRowRemoval} from './ui/rowProjection.ts';
import {rowProjectionReviewCases,rowProjectionReviewFixture} from './ui/rowProjectionReviewFixture.ts';
import './ui/portraitReactions.css';
import {createPortraitReactions} from './ui/portraitReactions.ts';
import {createDropMotion} from './ui/dropMotion.ts';
import './ui/rewardPresentation.css';
import {createRewardDialog} from './ui/rewardDialog.ts';
import type {AnimationMotion,BattlePace} from './ui/animationTimeline.ts';
import {animationTimeline} from './ui/animationTimeline.ts';
import {createBattleAnimator} from './ui/battleAnimator.ts';
import {forecastAction,emberForecastText,forecastPrimary,forecastSecondary} from './ui/actionForecast.ts';
import type {ActionForecast,ForecastAction} from './ui/actionForecast.ts';
import {rewardReviewFixture} from './ui/rewardReviewFixture.ts';
import {mountPresentationSettings} from './audio/presentationSettings.ts';
import {mountSoundThemeSettings} from './audio/soundThemeSettings.ts';
import './ui/stagePresentation.css';
import {createStagePresentation} from './ui/stagePresentation.ts';
import './ui/bossPresentation.css';
import {createBossPresentation} from './ui/bossPresentation.ts';
import './ui/turnPresentation.css';
import {createTurnPresentation} from './ui/turnPresentation.ts';
import './ui/enemyIntent.css';
import {renderEnemyIntent} from './ui/enemyIntent.ts';
import './ui/enemyPower.css';
import {renderEnemyPower} from './ui/enemyPower.ts';
import './ui/playerPower.css';
import {renderPlayerPower} from './ui/playerPower.ts';
import './ui/carryPreview.css';
import {renderCarryPreview} from './ui/carryPreview.ts';
import {SampleMusic} from './audio/SampleMusic.ts';
import {SampleAudioDirector} from './audio/SampleAudioDirector.ts';
import {playTransformationWithSample} from './audio/transformationSampleAudio.ts';
import {NEON_AUDIO_ASSETS} from './audio/neonAudioAssets.ts';
import {mountHomeMusicControls} from './audio/homeMusicControls.ts';
import {mountSampleControl} from './audio/sampleAudioControls.ts';
import { BattleController } from './app/BattleController.ts';
import type { BattleView, PersistenceHooks } from './app/BattleController.ts';
import { LocalSave, SaveOwnership, SAVE_KEY, SAVE_PREVIEW } from './app/localSave.ts';
import type { BattleRunState } from './app/BattleRun.ts';
import { getDropOptions, getRowSkillPreview, getAvailableBoardSkills, needsTurnStart, canManualTransform, skillName, skillDescription, gaugeDefinition, tuningOf, instantSlots } from './core/index.ts';
import type { BattleState, BattleEvent, CharacterId, EnemyId, BoardSkillId } from './core/types.ts';
import { prepareTrialSetup } from './config.ts';
import type { TrialSetupFixture } from './config.ts';
import { playerPortraits, enemyPortraits, transformedPortraits } from './portraits.ts';
import {feedbackForEvent,feedbackPosition,feedbackTiming} from './ui/battleFeedback.ts';
import {observeRecentDrop,retainRecentDrop,renderRecentDrop,emptyActionBreakdowns,recordActionBreakdown,lastActionBreakdownsHtml} from './ui/battleReadability.ts';
import type {RecentDrop,LastActionBreakdowns} from './ui/battleReadability.ts';
import './ui/battleReadability.css';
import {consumableUseView} from './ui/consumableReadability.ts';
import {readabilityReviewCases,readabilityReviewFixture,isReadabilityReviewRoute} from './ui/readabilityReviewFixture.ts';
import {shapeFeedbackHtml} from './ui/shapeFeedback.ts';
import type {ShapeFeedback} from './ui/shapeFeedback.ts';
import './ui/shapeFeedback.css';
import {createTransformationCinematic} from './ui/transformationCinematic.ts';
import './ui/transformationCinematic.css';
import type {BattleFeedback} from './ui/battleFeedback.ts';
import {runResultHtml} from './ui/runResult.ts';

/** 日本語: 盤面は常時表示。対象選択は下部に出し、詳細は要求時だけ開く。
 * English: Keep the board visible while targeting; optional details open only on request. */
const root = document.querySelector<HTMLElement>('#app')!;
const presentationVersion=PRESENTATION_VERSION;
root.innerHTML = `<main class="game" aria-label="Game1 試作${presentationVersion}"><header class="hud"><section class="player-hud"><button type="button" id="player-portrait" class="portrait-viewer-trigger" data-portrait="player" aria-label="自分の姿を見る" disabled><img id="player-image" alt=""></button><div><span id="player-name"></span><strong id="player-hp"></strong><div class="hp-track"><i id="player-fill"></i></div></div></section><section class="enemy-hud"><div><span id="enemy-name"></span><strong id="enemy-hp"></strong><div class="hp-track"><i id="enemy-fill"></i></div></div><button type="button" id="enemy-portrait" class="portrait-viewer-trigger" data-portrait="enemy" aria-label="敵の姿を見る" disabled><img id="enemy-image" alt=""></button></section><div class="gauge-row"><span id="gauge-text"></span><div class="gauge-track"><i id="gauge-fill"></i></div><span id="intent"></span></div></header><div class="strip"><span id="stage"></span><strong id="form"></strong><span id="turn"></span><label class="battle-speed"><select id="battle-speed" aria-label="戦闘速度"><option value="slow">遅</option><option value="medium" selected>中</option><option value="fast">速</option></select><small id="battle-speed-note" role="status" hidden></small></label></div><section class="board-area" aria-label="共有盤面"><div class="board-wrap"><div id="drop-buttons" class="drops"></div><div id="board" class="board"></div></div><div id="feedback-layer" aria-live="polite"></div><dialog id="end" class="end" aria-label="ラン結果"></dialog></section><section id="skill-hud" class="skill-hud" aria-label="所持通常スキル"></section><footer class="controls"><div class="hint-line"><p id="hint" aria-live="polite"></p><span id="save-status" role="status">保存確認中</span></div><div class="action-strip"><div id="actions" class="actions"></div><div id="audio-controls"></div><div id="music-controls"></div></div><p class="meta"><span id="latest"></span><span>試作 ${presentationVersion} · <a href="/">1.0</a> · <a href="/lab/">スキル実験</a></span></p></footer></main><dialog id="details" aria-label="スキルと設定"><div class="dialog-top"><h2>スキルと設定</h2><button data-close="details">閉じる</button></div><p class="build-info">試作 ${presentationVersion} · <a href="/">1.0</a> · <a href="/lab/">スキル実験</a></p><p id="save-description" hidden></p><div id="presentation-controls"></div><div id="details-body"></div><section id="qa-restart-settings" class="settings"><h3>再開始の設定</h3><p>新しい50階ラン：1–24階は基本攻撃、26–39階は単独ギミック、41–49階は上位種。25・40階はスピードコア、50階はマザーコア。敵はシードと階数で抽選し、「通常敵の検証用」の選択は使いません。再開した旧ランは以前の出現順を維持します。</p><label>キャラクター<select id="character"><option value="blue">青の子</option><option value="red">赤の子</option></select></label><label>通常敵の検証用<select id="enemy"><option value="marujiro">マルジロ</option><option value="hikikizan">ヒキキザン</option><option value="nigirin">ニギリン</option><option value="merarun">メラルン</option></select></label><label>変化方式<select id="mode"><option value="manual">手動・ゆっくり充填</option><option value="automatic">旧自動・6リンクと旧充填</option></select></label><label>進行<select id="route"><option value="boss-loop">50階クリア・階層別の敵</option><option value="standard">通常敵で検証・50階まで</option></select></label><label>開始ステージ<input id="start-stage" type="number" min="1" max="50" step="1" value="1"></label><label>検証状態<select id="fixture"><option value="normal">通常の連続対戦</option><option value="charged">ゲージ準備済み</option><option value="reward">報酬直前（3列目で撃破）</option><option value="speed-pulse">中ボス：5手番目の固定攻撃</option><option value="mother-wait">大ボス：5手番目の待機</option><option value="mother-double">大ボス：6手番目の2回投入</option><option value="mother-critical">大ボス：HP20%から新ループ</option></select></label><label>乱数シード<input id="seed" type="number" min="0" max="4294967295" step="1" value="1"></label><input id="reduce" type="checkbox" hidden aria-hidden="true"><button id="restart">この設定で再開始</button><p id="error" role="alert"></p></section></dialog><dialog id="battle-log" aria-labelledby="battle-log-title"><div class="dialog-top"><h2 id="battle-log-title">戦闘ログ</h2><button data-close="battle-log">閉じる</button></div><div id="action-history"></div><ol id="logs"></ol></dialog><dialog id="skill-info" class="skill-card-surface" aria-labelledby="skill-info-title"></dialog><dialog id="reward" aria-label="撃破報酬" aria-labelledby="reward-title"></dialog><dialog id="save-dialog" aria-label="セーブと再開"><h2 id="save-title"></h2><p id="save-message"></p><div id="save-actions"></div></dialog>`;
if(SAVE_PREVIEW){document.title='Game1 · セーブ検証版';root.querySelector('.game')!.setAttribute('aria-label','Game1 セーブ検証版');root.querySelector('.meta>span:last-child')!.insertAdjacentText('afterbegin','セーブ検証版 · ');root.querySelector('#save-description')!.insertAdjacentHTML('afterend','<section class="skill-card"><h3>保存の検証（このページだけ）</h3><label><input id="save-fail-once" type="checkbox"> 次の保存を1回失敗させる</label><p id="save-lifecycle">復帰方式を確認中</p></section>');}
const buildUiReviewRoute=['build-ui-preview','night-qa'].some(name=>window.location.pathname===`/${name}`||window.location.pathname.startsWith(`/${name}/`));
if(buildUiReviewRoute)root.querySelector('#save-description')!.insertAdjacentHTML('afterend','<section class="skill-card"><h3>ビルド画面の検証専用</h3><p>本編と別の保存です。3列目の投入で報酬へ進みます。</p><button data-review-setup="full">自由枠満杯の報酬検証</button><button data-review-setup="long">大きな数値・長い名前の検証</button></section>');
const energyReviewRoute=window.location.pathname==='/energy-qa'||window.location.pathname.startsWith('/energy-qa/');
if(energyReviewRoute)root.querySelector('#save-description')!.insertAdjacentHTML('afterend',`<section class="skill-card"><h3>エネルギーボックスの独立検証</h3><p>本編とは別の保存・演出設定です。</p>${energyReviewCases.map(item=>`<button data-energy-setup="${item.id}">${item.button}</button><p>${item.instructions}</p>`).join('')}</section>`);
if(energyReviewRoute)installImpactReview(root);
const readabilityReviewRoute=isReadabilityReviewRoute(window.location.pathname);
if(readabilityReviewRoute)root.querySelector('#save-description')!.insertAdjacentHTML('afterend',`<section class="skill-card"><h3>効果確認用セットアップ</h3><p>この検証ページだけの配置です。通常プレイでは使いません。新しいランの確認後に切り替えます。</p>${readabilityReviewCases.map(item=>`<button data-readability-setup="${item.id}">${item.button}</button><p>${item.instructions}</p>`).join('')}</section>`);
if(readabilityReviewRoute)root.querySelector('#save-description')!.insertAdjacentHTML('afterend',`<section class="skill-card"><h3>行消去の配置検証</h3><p>この検証ページだけの配置です。通常プレイの保存には触れません。</p>${rowProjectionReviewCases.map(item=>`<button data-row-projection-setup="${item.id}">${item.button}</button><p>${item.instructions}</p>`).join('')}</section>`);
// 日本語: 本編の設定には検証用再開始を出さない。English: Keep test setup out of production settings.
if(!SAVE_PREVIEW&&!energyReviewRoute&&!buildUiReviewRoute&&!readabilityReviewRoute)root.querySelector<HTMLElement>('#qa-restart-settings')!.hidden=true;
const el = <T extends HTMLElement = HTMLElement>(id:string)=>document.getElementById(id) as T;
const escape = (s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const audio = new SampleAudioDirector(NEON_AUDIO_ASSETS);
const music=new SampleMusic(audio);
const musicScene=new MusicSceneController(audio);
mountSampleControl({get enabled(){return audio.effectsEnabled;},get status(){return audio.effectsStatus;},enableGesture:()=>audio.enableEffectsGesture(),setEnabled:value=>audio.setEffectsEnabled(value),subscribe:listener=>audio.subscribe(listener)},el('audio-controls'),{id:'audio-toggle',label:'効果音',icon:'bell',description:'攻撃と変化の効果音です。キャラ別または手動テーマを「スキルと設定」で選べます。BGMとは別に切り替えます。'});
mountSampleControl(music,el('music-controls'),{id:'music-toggle',label:'BGM',icon:'music',description:'ホーム・通常戦闘・中ボス・マザーコアで専用曲へ切り替えます。効果音とは別です。'});
const audioVisibility=()=>audio.setHidden(document.hidden);
document.addEventListener('visibilitychange',audioVisibility);audioVisibility();
mountPresentationSettings(audio,el('presentation-controls'),el<HTMLInputElement>('reduce'),{select:el<HTMLSelectElement>('battle-speed'),note:el('battle-speed-note')});
mountSoundThemeSettings(audio,el('presentation-controls'));
const cancelClickGuard=createCancelClickGuard();
const portraitViewer=createPortraitViewer(root,{onClosePointer:point=>cancelClickGuard.mark(point)});
const transformCinematic=createTransformationCinematic({onSkipPointer:point=>cancelClickGuard.mark(point)});
const dropMotion=createDropMotion(root,()=>energyAppearance(displayed));
const boardSkillPresentation=createBoardSkillPresentation(root);
const energyLinks=createEnergyLinks(root);
const rowDoubleTap=createRowDoubleTap();
const stageNumberCinematic=createStageNumberCinematic({onSkipPointer:point=>cancelClickGuard.mark(point)});
let suppressRestoredTransitionTo:number|null=null;
const portraitReactions=createPortraitReactions(root);
const turnPresentation=createTurnPresentation(root);
const bossPresentation=createBossPresentation(root);
const stagePresentation=createStagePresentation(root);
let activeAnimationMotion:AnimationMotion|undefined;
const presentationMotion=():AnimationMotion=>activeAnimationMotion??({speed:el<HTMLSelectElement>('battle-speed').value as BattlePace,short:el<HTMLInputElement>('reduce').checked,lowMotion:document.body.dataset.reducedMotion==='true'||window.matchMedia('(prefers-reduced-motion: reduce)').matches});
let controller:BattleController;
let displayed:BattleState;
let locked=false;
let currentRun:BattleRunState|null=null;

let selected:{kind:'drop';id:string}|{kind:'row';row:number|null;after?:boolean}|{kind:'ember'}|{kind:'insight'}|{kind:'target';skillId:BoardSkillId;target:BoardTarget|null;orientation:number}|{kind:'instant';slot:number}|null=null;
let last='';
let recentDrop:RecentDrop|null=null;
let lastActions:LastActionBreakdowns=emptyActionBreakdowns();
let readabilityStage:number|null=null;
function resetReadability():void{recentDrop=null;lastActions=emptyActionBreakdowns();readabilityStage=null;}
let highlights:readonly string[]=[];
let highlightTone:'damage'|'heal'|'cost'='damage';
const history:string[]=[];
const details=el<HTMLDialogElement>('details'), reward=el<HTMLDialogElement>('reward');
const rewardDialog=createRewardDialog(reward,{controller:()=>controller,locked:()=>locked,markCommit:event=>cancelClickGuard.mark(event),afterPreview:(state,run)=>stagePresentation.update(state,run,controller.runOrigin,presentationMotion())});
const button=(label:string,attrs:string='',disabled=false)=>`<button ${attrs} ${disabled?'disabled':''}>${label}</button>`;
function available(s=displayed):boolean{return !locked&&!portraitViewer.active&&currentRun?.status!=='retired'&&!s.result&&s.actor==='player'&&!needsTurnStart(s);}
function formText(s:BattleState):string{
 const t=s.transformation;
 if(t?.character==='amber')return `アンバーの変化 · 残${t.remainingOwnTurns??1}自手番`;
 if(t&&['mint','amber','violet','silver','rose'].includes(t.character))return `${roster[t.character].name}の変化 · ${t.scope==='stage'?'この戦闘':'この自手番'}${s.barrier?` · バリア${s.barrier}`:''}`;
 if(t?.character==='imashiru')return 'ピコーン閃いた！ · この自手番';
 if(t?.character==='blue')return `${transformationIdentity(s.config,'blue').name}の変化中 · この戦闘中`;
 if(t?.character==='red'){const caster=transformationIdentity(s.config,'red').name;return t.remainingStarts>0?`${caster}の変化中 · 次の開始 残${t.remainingStarts}回`:`${caster}の変化中 · この手番で終了`;}
 return (canManualTransform(s)?'変化できます':'通常形態')+(s.barrier?` · バリア${s.barrier}`:'');
}
function fitBoard():void{
 if(!displayed)return;const area=el('board').closest<HTMLElement>('.board-area')!;const rect=area.getBoundingClientRect();const {width,height}=displayed.config.board;
 const size=Math.max(24,Math.floor(Math.min((rect.width-28-2*(width-1))/width,(rect.height-34-2*(height-1))/height,64)));
 root.style.setProperty('--cell',`${size}px`);root.style.setProperty('--cols',String(width));root.style.setProperty('--rows',String(height));
}
const boxMaterialArrival=createBoxMaterialArrival();
function renderBoard(s:BattleState):void{
 const restoreFocus=preserveBoardTargetFocus(el('board').parentElement!);
 const arrivingMaterials=boxMaterialArrival.observe(s.boxes);
 dropMotion.clear();
 const motion=presentationMotion(),profile=motion.timeline??animationTimeline(motion);
 document.body.dataset.energyShort=String(profile.short);
 root.style.setProperty('--material-arrival-ms',`${profile.material}ms`);
 const kitTargets=selected?.kind==='target'&&selected.target?kitBoardTargets(s,selected.skillId,selected.target).map(b=>b.id):[];
 const options=getDropOptions(s), can=available(s), target=selected?.kind==='row';
 const projection=can&&selected?.kind==='row'&&selected.after&&selected.row!==null?projectRowRemoval(s,selected.row):null;
 if(selected?.kind==='row'&&selected.after&&!projection)selected={...selected,after:false};
 const boardBoxes=projection?.boxes??s.boxes;const moves=new Map(projection?.moves.map(move=>[move.boxId,move])??[]);
 el('board').classList.toggle('row-projected',!!projection);
 el('board').classList.toggle('row-selection-preview',!!target&&!projection&&selected?.kind==='row'&&selected.row!==null);
 el('board').style.setProperty('--selected-row',String(selected?.kind==='row'?selected.row??0:0));el('board').setAttribute('aria-label',projection?'消去後の予告盤面・未確定':'現在の盤面');
 if(projection)el('board').dataset.rowProjection=String(projection.row+1);else delete el('board').dataset.rowProjection;
 // 日本語: 放出点は上部ヘッダーではなく実際の辺上。内部天井・可変盤面を同じ座標系で扱う。
 // English: Emitters belong to actual edges, never a top header; internal ceilings use the same board geometry.
 el('drop-buttons').innerHTML=target?'':options.map(o=>button('▼',`class="edge-emitter" data-drop="${escape(o.id)}" aria-label="${edgeEmitterLabel(o)}" aria-pressed="${selected?.kind==='drop'&&selected.id===o.id}" style="${edgeEmitterStyle(o.edge)}"`,!can||!o.available||!!selected&&selected.kind!=='drop')).join('');
 const landing=selected?.kind==='drop'?options.find(o=>o.id===(selected?.kind==='drop'?selected.id:null))?.landing:null;
 let cells='';
 for(let row=0;row<s.config.board.height;row++)for(let col=0;col<s.config.board.width;col++){
  const box=boardBoxes.find(b=>b.row===row&&b.col===col),terrain=s.config.board.terrain.some(c=>c.row===row&&c.col===col),invalid=s.config.board.invalidCells.some(c=>c.row===row&&c.col===col);
  const ghost=landing?.row===row&&landing.col===col;const own=box?.owner;
  const cls=['cell',!projection&&box&&arrivingMaterials.has(box.id)?'type-arriving':'',box&&kitTargets.includes(box.id)?'kit-target':'',own??'',terrain?'terrain':'',invalid?'invalid':'',ghost?'ghost':'',!projection&&selected?.kind==='row'&&selected.row===row?'row-target':'',!projection&&box&&highlights.includes(box.id)?`hit hit-${highlightTone}`:'',box&&moves.has(box.id)?'projection-moved':''].join(' ');
  cells+=`<button class="${cls}" data-cell-row="${row}" data-cell-col="${col}" ${box?`data-box-id="${escape(box.id)}"`:""} aria-label="${projection?'予告 ':''}${row+1}行${col+1}列 ${own==='player'?'自箱':own==='enemy'?'敵箱':own==='neutral'?'中立箱':terrain?'地形':'空き'}${box&&box.type!=='normal'?`・${boxTypeLabels[box.type]}タイプ`:''}${box&&moves.has(box.id)?` · ${moves.get(box.id)!.from.row+1}行から落下`:''}" ${(!can||!!projection||invalid||terrain)&&!box?'disabled':''} ${box?'aria-keyshortcuts="I Shift+F10"':''}>${box?energyBoxMarkup(box,energyAppearance(s)):ghost?energyBoxMarkup({owner:'player',row,col,...(s.shinyNextDrop||s.transformation?.character==='imashiru'?{type:'shiny' as const}:{})},energyAppearance(s)):terrain?'▪':''}${target&&!projection&&col===0?`<small>${row+1}</small>`:''}${box&&moves.has(box.id)?'<span class="projection-fall" aria-hidden="true">↓</span>':''}</button>`;
 }
 el('board').innerHTML=cells;
 if(projection){
  const legend=el('board').parentElement?.querySelector<HTMLElement>('.carry-legend');
  if(legend){legend.textContent='薄い箱＝消去後 / ↓＝落下した箱';legend.title='現在の行消去と重力だけの予告です。敵の次の行動は含みません。';legend.setAttribute('aria-label',legend.title);}
 }else{renderCarryPreview(el('board'),s,currentRun?.stage!==50);recentDrop=retainRecentDrop(recentDrop,s.boxes);renderRecentDrop(el('board'),recentDrop,s.boxes);}
 fitBoard();restoreFocus();
}
function selectedForecast(s:BattleState):ActionForecast|null{
 if(!selected||!available(s))return null;
 let action:ForecastAction|null=null;
 if(selected.kind==='drop')action={type:'drop',candidateId:selected.id};
 else if(selected.kind==='row'&&selected.row!==null)action={type:'board-skill',skillId:'pain-shared',row:selected.row};
 else if(selected.kind==='target'&&selected.target)action={type:'board-skill',skillId:selected.skillId,target:selected.target};
 else if(selected.kind==='insight')action={type:'board-skill',skillId:'imashiru-insight'};
 else if(selected.kind==='ember')action={type:'board-skill',skillId:'ember'};
 else if(selected.kind==='instant')action={type:'instant-skill',slot:selected.slot};
 return action?forecastAction(s,action):null;
}
function renderActions(s:BattleState):void{
 const can=available(s);let hint='列をタップして着地点を確認';let markup='';
 if(selected?.kind==='row'){
  const p=selected.row===null?null:getRowSkillPreview(s,selected.row);
  hint=p?`${selected.row!+1}行目をもう一度タップ`:'消す行を盤面で選んでください';
  markup=button('取消','data-cancel="true"',!can);
 }else if(selected?.kind==='target'){const d=kitBoardDefinition(s.config,selected.skillId)!;hint=`${d.name} · ゲージ${d.gauge}${d.hp?` · HP${d.hp}`:''} · 盤面の対象をタップ`;markup=button('対象を確定','data-confirm="true"',!can||!selected.target||!canUseKitBoard(s,selected.skillId,selected.target))+(kitBoardOrientations(selected.skillId)>1?button('向きを変える','data-kit-rotate="true"',!can):'')+button('取消','data-cancel="true"',!can);
 }else if(selected?.kind==='insight'){hint='ゲージ −30 · 1手消費 · 次の自箱を輝きタイプに';markup=button('いま、知りたい！を使う','data-confirm="true"',!can)+button('取消','data-cancel="true"',!can);
 }else if(selected?.kind==='ember'){
  const rules=tuningOf(s.config).board;hint=`自HP −${rules.emberCost} · 敵箱を最大${rules.emberConversions}個、自箱へ`;
  const preview=forecastAction(s,{type:'board-skill',skillId:'ember'});
  markup=button(preview?emberForecastText(preview).confirm:'火種を使う','data-confirm="true"',!can)+button('取消','data-cancel="true"',!can);
 }else if(selected?.kind==='instant'){
  const skill=s.build?.slots[selected.slot],use=consumableUseView(skill,selected.slot,s.build?.slots.length);hint=use?.actionHint??(skill?skillDescription(skill.id,skill.rank,tuningOf(s.config)):'');
  markup=button(use?.confirmLabel??'スキルを使う','data-confirm="true"',!can)+button('取消','data-cancel="true"',!can);
 }else{
  if(selected?.kind==='drop'){
   hint='着地点を確認してください';
  }
  markup=button(s.config.meta&&kitBoardCatalog[s.config.meta.board]?kitBoardCatalog[s.config.meta.board]!.name:s.config.meta?.board==='imashiru-insight'?'いま、知りたい！':getAvailableBoardSkills(s)[0]==='ember'?'ほむらの火種':'痛みはお互いに','data-board="true"',!can||!getAvailableBoardSkills(s).length)+button('変化する','data-transform="true" class="transform-button"',!can||!canManualTransform(s))+button(controlIcon('settings'),'data-details="true" class="settings-icon-button" aria-label="スキルと設定" title="スキルと設定"');
 }
 if(locked)hint='解決中…';else if(s.result)hint=currentRun?.status==='reward'?'撃破報酬を選択':s.result.winner==='enemy'?'ラン終了':'撃破';else if(s.actor==='enemy')hint='相手の手番';
 // 日本語: 盤面の着地点・白い行選択を残し、投入と行消去の予測欄は省く。
 // English: Keep in-board targets, without separate drop/row prediction panels.
 const forecast=selected?.kind==='drop'||selected?.kind==='row'?null:selectedForecast(s);
 if(forecast){
  const option=selected?.kind==='drop'?getDropOptions(s).find(o=>o.id===(selected?.kind==='drop'?selected.id:null)):null;
  const location=option?.landing?`${option.landing.col+1}列${option.landing.row+1}行`:selected?.kind==='row'?`${selected.row!+1}行目`:selected?.kind==='instant'?consumableUseView(s.build?.slots[selected.slot],selected.slot,s.build?.slots.length)?.actionHint??'':selected?.kind==='target'&&selected.target?`${selected.target.row+1}行${selected.target.col+1}列 · 1手消費`:selected?.kind==='insight'?'次の自箱を輝きに · 1手消費':selected?.kind==='ember'?'敵箱を自箱へ':'';
  const ember=selected?.kind==='ember'?emberForecastText(forecast):null;
  const row=selected?.kind==='row'&&selected.row!==null?getRowSkillPreview(s,selected.row):null;
  const basis=row?`自箱${row.playerCount}個→敵−${row.enemyDamage} / 敵箱${row.enemyCount}個→自−${row.playerDamage}`:null;
  const rowNote=row?(row.boxIds.length===0?'空の行です · 効果なしでも1手消費':`1手消費 · ${row.neutralCount?`中立箱${row.neutralCount}個は被害なし · `:''}落下でリンクは発動しません`):null;
  el('hint').innerHTML=`<strong>${escape(ember?.primary??forecastPrimary(forecast))}</strong><small>${escape(ember?.secondary??basis??forecastSecondary(forecast,location))}</small>${rowNote?`<small>${escape(rowNote)}</small>`:''}`;
  el('hint').title=`${forecastPrimary(forecast)} · ${forecastSecondary(forecast,location)} · 攻撃合計${forecast.damage}（反射を含む）・敵の次手は含まない`;
 }else{el('hint').textContent=hint;el('hint').removeAttribute('title');}
 el('hint').classList.toggle('row-forecast',!!forecast&&selected?.kind==='row');el('hint').classList.toggle('ember-forecast',!!forecast&&selected?.kind==='ember');el('hint').classList.toggle('has-forecast',!!forecast);el('actions').innerHTML=markup;
}
function render(s:BattleState,resolving:boolean,run:BattleRunState|null,enemyAction:BattleState|null=null):void{
 if(resolving||s.result||s.actor!=='player'||needsTurnStart(s)){portraitViewer.close(false);el<HTMLDialogElement>('skill-info').close();}
 void musicScene.updateBattle(s.config.enemyId);
 const soundCharacter=s.config.characterId??'blue';if(audio.effectsPlayerCharacter!==soundCharacter)void audio.setPlayerCharacter(soundCharacter);
 const nextReadabilityStage=run?.stage??1;if(readabilityStage!==nextReadabilityStage){recentDrop=null;lastActions=emptyActionBreakdowns();readabilityStage=nextReadabilityStage;}
 if(resolving)rowDoubleTap.reset();
 if(resolving&&selected?.kind==='row'&&selected.after)selected={...selected,after:false};
 displayed=s;locked=resolving;currentRun=run;
 if(resolving&&!controller?.persistenceBlocked)el('save-status').textContent='保存待ち';
 const rosterId=s.config.meta?.rosterId;const portrait=rosterId&&(roster[rosterId].prototype||rosterId==='imashiru')?rosterPortrait(rosterId,!!s.transformation):s.transformation?transformedPortraits[s.config.characterId!]:playerPortraits[s.config.characterId!];const enemy=enemyPortraits[s.config.enemyId!];
 for(const [id,src,alt] of [['player-image',portrait.src,portrait.alt],['enemy-image',enemy.src,enemy.alt]]){
  const img=el<HTMLImageElement>(id!);img.src=src!;img.alt=alt!;
  const inspect=el<HTMLButtonElement>(id!.replace('-image','-portrait'));
  const title=id==='player-image'?`${rosterId?roster[rosterId].name:playerPortraits[s.config.characterId!].label}${s.transformation?'（変化後）':''}`:enemy.label;
  inspect.disabled=!available(s);inspect.dataset.portraitTitle=title;inspect.title=`${title}の姿を見る`;inspect.setAttribute('aria-label',inspect.title);
 }
 el('player-name').textContent=rosterId?roster[rosterId].name:playerPortraits[s.config.characterId!].label;el('enemy-name').textContent=enemy.label;
 for(const actor of ['player','enemy'] as const){const hp=s.hp[actor];el(`${actor}-hp`).innerHTML=`${Math.max(0,hp.current)}<small> / ${hp.max}</small>`;el(`${actor}-hp`).title=`${Math.max(0,hp.current)} / ${hp.max}`;el(`${actor}-fill`).style.width=`${Math.max(0,hp.current)/hp.max*100}%`;}
 const gauge=gaugeDefinition(s.config.characterId,tuningOf(s.config))!;el('gauge-text').textContent=`変化 ${s.gauge}/${gauge.cost}`;el('gauge-fill').style.width=`${Math.min(1,s.gauge/gauge.cost)*100}%`;
 renderEnemyIntent(el('intent'),s,enemyAction);el('form').textContent=formText(s)+(s.shinyNextDrop?' · 次の自箱：輝き':'');setDeepStage(controller.runOrigin.deep);el('stage').textContent=stageLabel(run?.stage??1);el('turn').textContent=`${s.turn}手目`;
 renderPlayerPower(root.querySelector<HTMLElement>('.player-hud>div')!,s);
 renderEnemyPower(root.querySelector<HTMLElement>('.enemy-hud>div')!,s);
 el('latest').textContent=last;el('skill-hud').innerHTML=skillHudHtml(s,available(s));renderBoard(s);renderActions(s);rewardDialog.render(s,run,locked);
 turnPresentation.update(s,resolving,run,presentationMotion());
 if(run?.status!=='retired')bossPresentation.update(s,presentationMotion());
 const end=el<HTMLDialogElement>('end');const ended=run?.status==='retired'||!!s.result&&run?.status!=='reward'&&run?.status!=='transitioning';if(!ended){if(end.open)end.close();}else{end.innerHTML=runResultHtml(s,run,controller.runOrigin)+settlementHtml()+`<div class="result-actions">${button('ホームへ・育成する','data-home-return="true" class="primary"',locked)}${button('設定を開く','data-details="true"',locked)}</div>`;if(!locked&&!end.open)end.showModal();}
 stagePresentation.update(s,run,controller.runOrigin,presentationMotion());
}
function openDetails():void{
 // 日本語: 設定は設定だけ。ログは独立したダイアログで開き、ホーム復帰は従来どおり保存を維持。
 // English: Keep settings compact; history has its own dialog and home navigation preserves the run.
 el('details-body').innerHTML=`<nav class="settings-navigation">${button('戦闘ログ','data-battle-log="true"')}${button(controlIcon('home')+'ホームへ','data-home-return="true"',locked)}</nav>`;
 details.showModal();
}
function openBattleLog():void{
 el('action-history').innerHTML=lastActionBreakdownsHtml(lastActions);
 el('logs').innerHTML=history.slice(-160).map(line=>`<li>${escape(line)}</li>`).join('')||'<li>まだ行動していません</li>';
 details.close();el<HTMLDialogElement>('battle-log').showModal();
}
function closeBattleLog():void{
 el<HTMLDialogElement>('battle-log').close();
 if(!home.active){details.showModal();details.querySelector<HTMLButtonElement>('[data-battle-log]')?.focus({preventScroll:true});}
}
function describe(event:BattleEvent,before?:BattleState):string|null{
 if(event.type==='enemy-box-changed'&&event.boxType==='absolute-zero')return event.boxIds.length?`敵が自箱${event.boxIds.length}個を絶対零度に変更`:'敵の冷気：対象なし';
 if(event.type==='enemy-box-changed'&&event.boxType==='neutral')return event.boxIds.length?`敵が自箱${event.boxIds.length}個を中立箱に変更`:'敵のもこもこ：対象なし';
 if(event.type==='enemy-box-changed')return event.boxIds.length?`敵が自箱${event.boxIds.length}個をフローズンに変更`:'敵の凍結：対象なし';
 if(event.type==='enemy-wait')return '敵は待機';
 if(event.type==='enemy-phase')return 'マザーコア：低HPの行動へ移行';
 if(event.type==='drop')return `${event.actor==='player'?'自分':'敵'}：${event.landing.col+1}列${event.landing.row+1}行へ投入`;
 if(event.type==='attack'||event.type==='damage'){const f=feedbackForEvent(event,[]);return `${f?.detail}：${event.damage}ダメージ（HP ${event.hpBefore}→${event.hpAfter}）`;}
 if(event.type==='heal'){const f=feedbackForEvent(event,[]);return `${f?.detail}：実回復${event.amount}（HP ${event.hpBefore}→${event.hpAfter}）`;}
 if(event.type==='transformation'){const caster=before?transformationIdentity(before.config,event.character).name:roster[event.character].name;return `${caster}が変化・ゲージ −${event.cost}`;}
 if(event.type==='transformation-ended'){const caster=before?transformationIdentity(before.config,event.character).name:roster[event.character].name;return `${caster}の変化が終了`;}
 if(event.type==='boxes-thawed')return `フローズン${event.boxIds.length}個が溶けて通常タイプに戻る`;
 if(event.type==='rubble-crushed')return `ガレキ${event.boxIds.length}個が重みで崩れる（落下では攻撃しない）`;
 if(event.type==='type-damage')return `${event.source==='poison'?'どく':'トゲ'}：${event.damage}ダメージ（HP ${event.hpBefore}→${event.hpAfter}）`;
 if(event.type==='kit-board-changed')return `盤面を変更：${event.boxIds.length}箱（受動・リンク発動なし）`;
 if(event.type==='barrier')return `バリア ${event.before}→${event.after}`;
 if(event.type==='gauge-spent')return `ゲージ消費 ${event.amount}`;
 if(event.type==='shiny-prepared')return 'いま、知りたい！：ゲージ30消費・次の自箱を輝きに';
 if(event.type==='boxes-shining')return `自箱${event.boxIds.length}個を輝きに変換（この変換自体では攻撃しない）`;
 if(event.type==='turn-start'){const caster=before?transformationIdentity(before.config,'red').name:'赤の子';return event.skipped?`${caster}：追加投入なし・残り回数を消費`:`${caster}の追加投入・残り${event.remainingStarts}回`;}
 if(event.type==='instant-kill')return '敵の投入不能：自分HP 0';
 if(event.type==='link-growth')return `成長する火：3リンク火力＋${event.amount}（この戦闘＋${event.after}）`;
 if(event.type==='boxes-converted')return `敵箱${event.boxIds.length}個を自箱へ変換（受動リンクは発動しない）`;
 if(event.type==='row-cleared')return `${event.row+1}行目を消去：自箱${event.playerCount}・敵箱${event.enemyCount}・中立${event.neutralCount}`;
 if(event.type==='board-skill')return `${boardSkillName(event.skillId)}を使用`;
 if(event.type==='instant-skill')return `${skillName(event.skillId,event.rank)}を使用（1手・残り0回）`;
 return null;
}
function showFeedback(feedback:BattleFeedback,state:BattleState,reduced:boolean,shape:ShapeFeedback|null=null,holdMs=feedbackTiming(reduced).hold):HTMLElement{
 const area=root.querySelector<HTMLElement>('.board-area')!,layer=el('feedback-layer');const areaRect=area.getBoundingClientRect();
 const bubble=document.createElement('div');bubble.className=`floating-feedback ${feedback.tone}`;const strong=document.createElement('strong');strong.textContent=feedback.text;const small=document.createElement('small');small.textContent=shape?.detail??feedback.detail;bubble.append(strong,small);if(shape)bubble.insertAdjacentHTML('afterbegin',shapeFeedbackHtml(shape));layer.replaceChildren(bubble);
 const cells=state.boxes.filter(box=>feedback.boxIds.includes(box.id)).flatMap(box=>{const cell=el('board').querySelector<HTMLElement>(`[data-cell-row="${box.row}"][data-cell-col="${box.col}"]`);if(!cell)return [];const r=cell.getBoundingClientRect();return [{left:r.left-areaRect.left,right:r.right-areaRect.left,top:r.top-areaRect.top,bottom:r.bottom-areaRect.top}];});
 const p=feedbackPosition({width:areaRect.width,height:areaRect.height},cells,{width:bubble.offsetWidth,height:bubble.offsetHeight},feedback.anchor,boardSkillPresentation.feedbackInsetTop());bubble.style.left=`${p.x}px`;bubble.style.top=`${p.y}px`;bubble.style.setProperty('--rise',`${-p.rise}px`);bubble.style.setProperty('--hold',`${holdMs}ms`);if(!reduced)bubble.classList.add('moving');return bubble;
}
const initialSetup=prepareTrialSetup({character:'blue',firstEnemy:'marujiro',seed:1,mode:'manual',stage:1,fixture:'normal',route:'boss-loop'});
const view:BattleView={
 render,
 animate:createBattleAnimator({
  motion:presentationMotion,
  begin:motion=>{activeAnimationMotion=motion;},
  end:()=>{activeAnimationMotion=undefined;dropMotion.clear();portraitReactions.clear();boardSkillPresentation.clear();energyLinks.clear();},
  playSound:(event,resolution,index,signal,before)=>audio.playEvent(event,resolution,index,signal,{playerCharacterId:before.config.characterId??'blue'}),
  describe(event,before){const label=describe(event,before);if(label){last=label;history.push(`${before.turn}手目 ${label}`);}},
  observe:event=>{recentDrop=observeRecentDrop(recentDrop,event);},
  highlight(ids,tone){if(!ids.length)energyLinks.clear();highlights=ids;if(tone)highlightTone=tone;},
  render:(state,enemyAction=null)=>render(state,true,controller.runSnapshot,enemyAction),
  drop:(event,signal,motion)=>dropMotion.play(event,{signal,motion}),
  react:(event,signal,motion)=>portraitReactions.play(event,{signal,motion}),
  boardSkill:(event,resolution,before,signal,motion)=>{if(boardSkillPresentation.play(event,resolution,before,{signal,motion}))return event.type==='board-skill'?motion.timeline!.skill.name:motion.timeline!.skill.effect;},
  energy:(event,links,state,signal,motion)=>{energyLinks.play(event,links,state,signal,motion);},
  impact:event=>energyLinks.impact(event),
  feedback:showFeedback,
  transform:(event,resolution,index,signal,motion,before)=>playTransformationWithSample(audio,transformCinematic,{eventId:event,event,portraitCharacter:transformationIdentity(before.config,event.character).id,formName:transformationIdentity(before.config,event.character).formName,beforeSrc:rosterPortrait(before.config.meta?.rosterId??before.config.characterId??'blue').src,afterSrc:rosterPortrait(before.config.meta?.rosterId??before.config.characterId??'blue',true).src,signal,motion},resolution,index,{playerCharacterId:before.config.characterId??'blue'}),
  complete:(resolution,turn)=>{lastActions=recordActionBreakdown(lastActions,resolution,turn);},
 }),
 async animateStageTransition(_before,after,run,signal){
  boardSkillPresentation.clear();energyLinks.clear();
  last=`${stageLabel(run.stage)} · 次の戦闘`;render(after,true,run);
  const restored=suppressRestoredTransitionTo===run.stage;if(restored)suppressRestoredTransitionTo=null;
  await stageNumberCinematic.play({eventId:after,event:{type:'stage-transition',fromStage:run.stage-1,toStage:run.stage},restored,signal,motion:presentationMotion()});
 },
 reset(){portraitViewer.close(false);boardSkillPresentation.clear();energyLinks.clear();stageNumberCinematic.reset();suppressRestoredTransitionTo=null;cancelClickGuard.reset();rowDoubleTap.reset();dropMotion.clear();portraitReactions.clear();resetReadability();transformCinematic.cancel('restart');audio.reset();music.restart();turnPresentation.reset();bossPresentation.reset();stagePresentation.reset();selected=null;highlights=[];el('feedback-layer').replaceChildren();const end=el<HTMLDialogElement>('end');if(end.open)end.close();history.length=0;last='';rewardDialog.reset();},
 reportError(){portraitViewer.close(false);boardSkillPresentation.clear();energyLinks.clear();stageNumberCinematic.cancel('presentation-error');rowDoubleTap.reset();dropMotion.clear();portraitReactions.clear();resetReadability();last='表示を更新しました。確定した行動は保持されています';}
};
const ownership=new SaveOwnership();
let save:LocalSave|undefined;
let profileStore:ProfileStore|undefined;
let profileReady=false;
let profileReadComplete=false;
let saveRecovery:'controller'|'boot'='controller';
let bootEpoch=0;
const saveDialog=el<HTMLDialogElement>('save-dialog');
function restoreSetupFields():void{const cp=controller.exportCheckpoint();el<HTMLSelectElement>('character').value=cp.initialConfig.characterId??'blue';el<HTMLSelectElement>('enemy').value=cp.options.run?.rotationStart??cp.initialConfig.enemyId??'marujiro';el<HTMLInputElement>('seed').value=String(cp.initialConfig.seed);el<HTMLInputElement>('start-stage').value=String(cp.options.run?.startStage??1);el<HTMLSelectElement>('route').value=cp.options.run?.route??'standard';el<HTMLSelectElement>('mode').value=cp.initialConfig.strategy?.transformation==='manual-charge'?'manual':'automatic';el<HTMLSelectElement>('fixture').value='normal';}
function savePrompt(title:string,message:string,actions:string):void{el('save-title').textContent=title;el('save-message').textContent=message;el('save-actions').innerHTML=actions;if(!saveDialog.open)saveDialog.showModal();}
// 日本語: 最後に保存できた時刻（分かるときだけ）。English: Last successful save time, when known.
function lastSavedLabel():string{const at=save?.latest?.savedAt;return typeof at==='number'&&at>0?`（${new Date(at).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})}）`:'';}
function reportSaveError(error:unknown):void{portraitViewer.close(false);el('save-status').textContent='保存停止';savePrompt('保存を確認してください',error instanceof Error?error.message:'自動保存できませんでした',button('保存を再試行','data-save="retry" class="save-primary"')+button(`未保存分を破棄して、最後の保存${lastSavedLabel()}へ戻る`,'data-save="restore"'));}
const home=mountHome(root,{mountMusic:host=>mountHomeMusicControls(music,audio,host),store:()=>profileStore!,saved:()=>save?.latest?.checkpoint??null,preview:SAVE_PREVIEW,async qa(kind){if(!SAVE_PREVIEW)return;if(kind==='selected-kit'){const p=profileStore!.current,x=prepareDeparture(freezeRunMeta(p,p.selected,false),19),initialGauge=gaugeDefinition(x.config.characterId,tuningOf(x.config))!.cap;await newRun({...x,config:{...x.config,initialGauge,initialBoxes:[[7,0,'player'],[7,1,'player'],[7,2,'player'],[6,0,'player'],[6,1,'player'],[7,3,'enemy'],[7,4,'enemy'],[7,5,'enemy'],[6,3,'enemy'],[6,4,'enemy']].map(([row,col,owner],i)=>({id:`kit-qa:${i}`,row:Number(row),col:Number(col),owner:owner as 'player'|'enemy',type:'normal' as const,status:'normal' as const})),combatants:{player:{...x.config.combatants.player,maxHp:1000,initialHp:1000},enemy:{...x.config.combatants.enemy,maxHp:1000,initialHp:1000}}}});}else if(kind==='types'){const x=prepareTrialSetup({character:'blue',firstEnemy:'marujiro',seed:13,mode:'manual',stage:1,fixture:'normal',route:'boss-loop'});await newRun({...x,config:{...x.config,initialBoxes:[{id:'type:0',row:7,col:0,owner:'player',type:'rubble',status:'normal'},{id:'type:1',row:6,col:0,owner:'player',type:'normal',status:'normal'},{id:'type:2',row:7,col:1,owner:'player',type:'poison',status:'normal'},{id:'type:3',row:7,col:2,owner:'enemy',type:'deadly-poison',status:'normal'},{id:'type:4',row:7,col:3,owner:'player',type:'frozen',status:'normal'},{id:'type:5',row:7,col:4,owner:'player',type:'shiny',status:'normal'},{id:'type:6',row:7,col:5,owner:'neutral',type:'thorn',status:'normal'}],combatants:{player:{...x.config.combatants.player,maxHp:1000,initialHp:1000},enemy:{...x.config.combatants.enemy,maxHp:1000,initialHp:1000}}}});}else if(kind==='imashiru'){const p=profileStore!.current;const meta=profileStore!.current.ownedCharacters.includes('imashiru')?prepareDeparture(freezeRunMeta(p,'imashiru',false),11):null;if(!meta)return;await newRun({...meta,config:{...meta.config,initialGauge:230,initialBoxes:[0,1].map(col=>({id:`imashiru-qa:${col}`,row:7,col,owner:'player' as const,type:'normal' as const,status:'normal' as const})),combatants:{...meta.config.combatants,enemy:{...meta.config.combatants.enemy,maxHp:999,initialHp:999}}}});}else await newRun(prepareTrialSetup({character:'blue',firstEnemy:'marujiro',seed:1,mode:'manual',stage:kind==='speed'?25:50,fixture:'charged',route:'boss-loop'}));},continue(){saveDialog.close();void musicScene.enterBattle(controller.snapshot.config.enemyId);void controller.start();},retire:requestRetirement,async launch(meta:RunMeta,route){const seed=crypto.getRandomValues(new Uint32Array(1))[0]!;await newRun(prepareDeparture(meta,seed,route));}});
function reconcileSavedSettlement():void{if(!profileStore||!save)throw new Error('保存の準備ができていません');reconcileSavedProgress(save,profileStore);}
function showHome():void{el<HTMLDialogElement>('battle-log').close();el<HTMLDialogElement>('skill-info').close();if(!profileStore)return;try{reconcileSavedSettlement();}catch(error){saveRecovery='boot';reportSaveError(error);return;}details.close();rewardDialog.reset();el<HTMLDialogElement>('end').close();saveDialog.close();selected=null;void musicScene.showHome();home.show();}
function requestRetirement():boolean {
 if(!save||!profileStore||controller.isResolving||controller.persistenceBlocked)return false;
 save.guard();profileStore.guard();
 const expected=controller.exportCheckpoint();
 if(!canRetireCheckpoint(expected))throw new Error('帰還は報酬の確定・自動行動後の自手番で行えます');
 const terminal=prepareRetiredCheckpoint(expected),receipt=resultReceipt(profileStore.current,terminal);
 const character=expected.initialConfig.meta?.rosterId,name=character?roster[character].name:'このキャラ';
 const payout=receipt?`${receipt.coins}コイン・${receipt.xp}EXP`:'成長報酬なし（正式出発の記録がない、または検証ラン）';
 if(!window.confirm(`${name}のランを終了して帰還します。撃破${expected.run!.defeatedCount}体：${payout}。このランは続きから再開できません。クリア追加報酬・トロフィーは付きません。帰還しますか？`))return false;
 save.guard();profileStore.guard();
 if(JSON.stringify(save.latest?.checkpoint)!==JSON.stringify(expected))throw new Error('保存されたランが変わりました。帰還せずに停止しました');
 const accepted=controller.retire(expected);
 if(accepted){home.hide();selected=null;details.close();rewardDialog.reset();saveDialog.close();}
 return accepted;
}

function settlementHtml():string{const cp=save?.latest?.checkpoint;if(!cp)return '';const r=profileStore?.current.receipts[cp.runId];if(r)return `<section class="skill-card"><h3>ラン報酬・保存済み</h3><p>${roster[r.character].name} EXP ＋${r.xp} · コイン ＋${r.coins}</p><p>${r.clear?'50階クリア追加報酬を含みます。':'撃破した敵の数に応じた報酬です。'}${r.trophies.length?` トロフィー${r.trophies.length}個を獲得！`:''}</p></section>`;return '<p>このランは更新前または検証用のため、成長報酬・トロフィーの対象外です。</p>';}
const persistence:PersistenceHooks={beforeAction(){if(!save||!profileStore)throw new Error('保存の準備ができていません');save.guard();profileStore.guard();},write(checkpoint){save!.write(checkpoint);profileStore!.settle(checkpoint);el('save-status').textContent='保存済';},failed(error){saveRecovery='controller';reportSaveError(error);}};
async function boot():Promise<void>{
 profileReady=false;profileReadComplete=false;void musicScene.showHome();home.hide();portraitViewer.close(false);boardSkillPresentation.clear();energyLinks.clear();stageNumberCinematic.reset();suppressRestoredTransitionTo=null;cancelClickGuard.reset();rowDoubleTap.reset();dropMotion.clear();portraitReactions.clear();resetReadability();const epoch=++bootEpoch;controller?.destroy();turnPresentation.reset();bossPresentation.reset();stagePresentation.reset();el('feedback-layer').replaceChildren();const result=el<HTMLDialogElement>('end');if(result.open)result.close();selected=null;highlights=[];last='';history.length=0;if(details.open)details.close();rewardDialog.reset();
 savePrompt('セーブを確認中','このブラウザの保存を確認しています','');
 try{
  if(!await ownership.acquire(navigator.locks)){savePrompt('別のタブでプレイ中','同時の上書きを防ぐため、このタブは開始していません。ほかのプレイ中のタブを閉じてから再確認してください。',button('再確認','data-save="read"'));return;}
  if(epoch!==bootEpoch)return;
  save=new LocalSave({getItem:key=>window.localStorage.getItem(key),setItem(key,value){const failure=el<HTMLInputElement>('save-fail-once');if(SAVE_PREVIEW&&failure?.checked){failure.checked=false;throw new DOMException('Preview quota failure','QuotaExceededError');}window.localStorage.setItem(key,value);}},()=>ownership.owned);
  profileStore=new ProfileStore(window.localStorage,()=>ownership.owned,window.location.pathname);profileStore.read();profileReadComplete=true;
  const saved=save.read();
  if(saved){if(!saved.checkpoint.initialConfig.meta&&!localStorage.getItem(SAVE_KEY+'.pre-profile-backup'))localStorage.setItem(SAVE_KEY+'.pre-profile-backup',localStorage.getItem(SAVE_KEY)!);profileStore.settle(saved.checkpoint);}
  profileReady=true;saveRecovery='controller';
  if(saved){const restoredCheckpoint=saved.checkpoint;suppressRestoredTransitionTo=restoredCheckpoint.run&&(restoredCheckpoint.pendingReward||restoredCheckpoint.run.offer?.category==='heal')?restoredCheckpoint.run.stage+1:null;controller=BattleController.restore(saved.checkpoint,view,persistence);restoreSetupFields();render(controller.snapshot,true,controller.runSnapshot);}
  else controller=new BattleController(initialSetup.config,view,initialSetup.options,persistence);
  if(epoch===bootEpoch)showHome();
 }catch(error){if(epoch!==bootEpoch)return;savePrompt('セーブを読み込めません',error instanceof Error?error.message:'保存を確認できません。元の内容は保持しています。',button('再確認','data-save="read"')+(ownership.owned&&(profileReady||profileReadComplete&&!save?.latest)&&save?.hasExisting?button('新しいラン','data-save="new"'):''));}
}
async function newRun(setup=initialSetup):Promise<void>{
 if(!save||!ownership.owned)return;
 if(save.hasExisting&&!save.latest&&!window.confirm('読めないセーブを退避して、新しいランを始めますか？元の保存を端末内に1世代残します。'))return;
 const active=save.latest?.checkpoint.run&&!isTerminalRun(save.latest.checkpoint.run);
 if(active&&!window.confirm('進行中のランを終了し、新しいランに置き換えますか？途中終了では成長報酬は獲得できません。'))return;
 try{reconcileSavedSettlement();const next=new BattleController(setup.config,view,setup.options,persistence);const checkpoint=setup.config.meta?next.exportCheckpoint():null;if(save.hasExisting)localStorage.setItem(SAVE_KEY+'.previous-run-backup',localStorage.getItem(SAVE_KEY)!);if(checkpoint){profileStore!.register(checkpoint);save.write(checkpoint);}home.hide();controller?.destroy();controller=next;selected=null;view.reset?.();void musicScene.enterBattle(controller.snapshot.config.enemyId);await controller.start();if(!controller.persistenceBlocked)saveDialog.close();}
 catch(error){saveRecovery='boot';reportSaveError(error);}
}
saveDialog.addEventListener('cancel',event=>event.preventDefault());
saveDialog.addEventListener('click',event=>{const action=(event.target as Element).closest<HTMLButtonElement>('[data-save]')?.dataset.save;if(!action)return;
 if(action==='read'){void boot();return;}
 if(action==='new'){showHome();return;}
 if(action==='continue'){home.hide();saveDialog.close();void musicScene.enterBattle(controller.snapshot.config.enemyId);void controller.start();return;}
 if(action==='retry'){if(saveRecovery==='boot'){void boot();return;}if(controller?.retrySave()){saveDialog.close();void controller.start();}return;}
 if(action==='restore'&&window.confirm('未保存の進行を戻し、最後の保存を読み直しますか？'))void boot();
});
async function commit():Promise<void>{
 if(!selected||!available())return;const choice=selected;rowDoubleTap.reset();selected=null;
 if(choice.kind==='drop')await controller.drop(choice.id);
 else if(choice.kind==='row'&&choice.row!==null)await controller.boardSkill('pain-shared',choice.row);
 else if(choice.kind==='target'&&choice.target)await controller.boardSkill(choice.skillId,undefined,choice.target);
 else if(choice.kind==='insight')await controller.boardSkill('imashiru-insight');
 else if(choice.kind==='ember')await controller.boardSkill('ember');
 else if(choice.kind==='instant')await controller.instantSkill(choice.slot);
}
// Capture before direct audio/settings handlers: a dismissed modal must not toggle them.
installBoxInspection(root,{state:()=>displayed,ready:()=>!locked&&!!displayed&&!portraitViewer.active,clearSelection:()=>{rowDoubleTap.reset();selected=null;render(controller.snapshot,locked,controller.runSnapshot);}});
root.addEventListener('click',event=>{if((portraitViewer.active&&!(event.target as Element).closest('#portrait-viewer'))||cancelClickGuard.blocks(event)){event.preventDefault();event.stopImmediatePropagation();}},true);
root.addEventListener('click',event=>{
 const b=(event.target as Element).closest<HTMLButtonElement>('button');if(!b||b.disabled){rowDoubleTap.reset();return;}
 if(b.dataset.cellRow===undefined||selected?.kind!=='row'||selected.after)rowDoubleTap.reset();
 if(b.dataset.portrait){
  if(available()&&!root.querySelector('dialog[open]')){
   const img=el<HTMLImageElement>(`${b.dataset.portrait}-image`);rowDoubleTap.reset();
   portraitViewer.open({src:img.currentSrc||img.src,alt:img.alt,title:b.dataset.portraitTitle??img.alt,trigger:b});
  }return;
 }
 if(b.dataset.homeReturn){if(!locked)showHome();return;}
 if(b.dataset.close){if(b.dataset.close==='skill-info'||b.dataset.close==='battle-log')cancelClickGuard.mark(event);if(b.dataset.close==='battle-log')closeBattleLog();else el<HTMLDialogElement>(b.dataset.close).close();return;}
 if(b.dataset.skillInfo!==undefined){if(locked||!displayed||root.querySelector('dialog[open]'))return;const html=skillInfoHtml(displayed,Number(b.dataset.skillInfo));if(html){rowDoubleTap.reset();const dialog=el<HTMLDialogElement>('skill-info');dialog.innerHTML=html;dialog.showModal();}return;}
 if(b.dataset.details){openDetails();return;}
 if(b.dataset.battleLog){openBattleLog();return;}
 if(energyReviewRoute&&b.dataset.energySetup){const item=energyReviewCases.find(item=>item.id===b.dataset.energySetup);if(item){details.close();void newRun(energyReviewFixture(item.id));}return;}
 if(readabilityReviewRoute&&b.dataset.rowProjectionSetup){const item=rowProjectionReviewCases.find(item=>item.id===b.dataset.rowProjectionSetup);if(item){details.close();void newRun(rowProjectionReviewFixture(item.id));}return;}
 if(readabilityReviewRoute&&b.dataset.readabilitySetup){const item=readabilityReviewCases.find(item=>item.id===b.dataset.readabilitySetup);if(item){details.close();void newRun(readabilityReviewFixture(item.id));}return;}
 if(buildUiReviewRoute&&(b.dataset.reviewSetup==='full'||b.dataset.reviewSetup==='long')){details.close();void newRun(rewardReviewFixture(b.dataset.reviewSetup));return;}
 if(b.dataset.restart){showHome();return;}
 if(b.dataset.drop&&available()){if(selected?.kind==='drop'&&selected.id===b.dataset.drop)void commit();else{selected={kind:'drop',id:b.dataset.drop};render(controller.snapshot,false,controller.runSnapshot);}return;}
 if(b.dataset.kitRotate&&available()&&selected?.kind==='target'){selected={...selected,orientation:(selected.orientation+1)%kitBoardOrientations(selected.skillId),target:selected.target?{...selected.target,orientation:(selected.orientation+1)%kitBoardOrientations(selected.skillId)}:null};render(controller.snapshot,false,controller.runSnapshot);return;}
 if(b.dataset.cellRow!==undefined&&available()){
  if(el('board').classList.contains('row-projected'))return;
  if(selected?.kind==='target'){const target={row:Number(b.dataset.cellRow),col:Number(b.dataset.cellCol),orientation:selected.orientation};const same=selected.target?.row===target.row&&selected.target?.col===target.col;selected={...selected,target};if(same&&canUseKitBoard(displayed,selected.skillId,target))void commit();else render(controller.snapshot,false,controller.runSnapshot);return;}
  if(selected?.kind==='row'){if(selected.after)return;const row=Number(b.dataset.cellRow);if(!getRowSkillPreview(controller.snapshot,row).valid){rowDoubleTap.reset();return;}const confirm=selected.row===row;selected={kind:'row',row};if(confirm)void commit();else render(controller.snapshot,false,controller.runSnapshot);}
  else if(!selected||selected.kind==='drop'){const o=dropForCell(getDropOptions(displayed),{row:Number(b.dataset.cellRow),col:Number(b.dataset.cellCol)});if(o){if(selected?.kind==='drop'&&selected.id===o.id)void commit();else{selected={kind:'drop',id:o.id};render(controller.snapshot,false,controller.runSnapshot);}}}return;
 }
 if(b.dataset.rowProjection&&available()&&selected?.kind==='row'&&selected.row!==null){if(!getRowSkillPreview(controller.snapshot,selected.row).valid)return;selected={...selected,after:b.dataset.rowProjection==='after'};render(controller.snapshot,false,controller.runSnapshot);root.querySelector<HTMLButtonElement>('button[data-row-projection]')?.focus({preventScroll:true});return;}
 if(b.dataset.board&&available()){const id=getAvailableBoardSkills(displayed)[0]!;selected=isKitBoard(id)?{kind:'target',skillId:id,target:null,orientation:0}:id==='imashiru-insight'?{kind:'insight'}:getAvailableBoardSkills(displayed)[0]==='ember'?{kind:'ember'}:{kind:'row',row:null};render(controller.snapshot,false,controller.runSnapshot);return;}
 if(b.dataset.cancel){boardSkillPresentation.clear();energyLinks.clear();cancelClickGuard.mark(event);selected=null;render(controller.snapshot,locked,controller.runSnapshot);return;}
 if(b.dataset.confirm){void commit();return;}
 if(b.dataset.transform){selected=null;void controller.transform();return;}
 if(b.dataset.instant!==undefined&&available()&&instantSlots(displayed).includes(Number(b.dataset.instant))){details.close();el<HTMLDialogElement>('skill-info').close();selected={kind:'instant',slot:Number(b.dataset.instant)};render(controller.snapshot,locked,controller.runSnapshot);return;}
 rewardDialog.handleInput(b,event);
});
el<HTMLDialogElement>('skill-info').addEventListener('cancel',event=>{event.preventDefault();event.stopPropagation();el<HTMLDialogElement>('skill-info').close();});
el<HTMLDialogElement>('battle-log').addEventListener('cancel',event=>{event.preventDefault();event.stopPropagation();closeBattleLog();});
el<HTMLDialogElement>('end').addEventListener('cancel',event=>event.preventDefault());
el('restart').addEventListener('click',()=>{
 const rawSeed=el<HTMLInputElement>('seed').value.trim();const seed=Number(rawSeed);if(!rawSeed||!Number.isInteger(seed)||seed<0||seed>4294967295){el('error').textContent='シードは0〜4294967295の整数にしてください';return;}
 el('error').textContent='';
 try {const setup=prepareTrialSetup({fixture:el<HTMLSelectElement>('fixture').value as TrialSetupFixture,character:el<HTMLSelectElement>('character').value as CharacterId,firstEnemy:el<HTMLSelectElement>('enemy').value as EnemyId,seed,mode:el<HTMLSelectElement>('mode').value as 'manual'|'automatic',stage:Number(el<HTMLInputElement>('start-stage').value),route:el<HTMLSelectElement>('route').value as 'standard'|'boss-loop'});details.close();void newRun(setup);}
 catch(error){el('error').textContent=error instanceof Error?error.message:'設定を確認してください';}
});
window.addEventListener('keydown',event=>{if(portraitViewer.active||el<HTMLDialogElement>('skill-info').open||el<HTMLDialogElement>('battle-log').open)return;if(event.key==='Escape'){boardSkillPresentation.clear();energyLinks.clear();}if(event.key==='Escape'&&selected&&!details.open&&!reward.open){rowDoubleTap.reset();selected=null;render(controller.snapshot,locked,controller.runSnapshot);}});
new ResizeObserver(fitBoard).observe(root.querySelector('.board-area')!);
window.addEventListener('pagehide',()=>{el<HTMLDialogElement>('skill-info').close();portraitViewer.close(false);boardSkillPresentation.clear();energyLinks.clear();stageNumberCinematic.cancel('pagehide');rowDoubleTap.reset();dropMotion.clear();portraitReactions.clear();transformCinematic.cancel('pagehide');audio.setHidden(true);audio.reset();bootEpoch++;controller?.destroy();ownership.release();});
window.addEventListener('pageshow',event=>{audio.setHidden(document.hidden);if(SAVE_PREVIEW)el('save-lifecycle').textContent=event.persisted?'BFCacheから復帰':'新しくページを読み込み';if(event.persisted)void boot();});
window.addEventListener('storage',event=>{if((event.key===SAVE_KEY||event.key===profileStore?.key)&&ownership.owned){try{save?.guard();profileStore?.guard();}catch(error){controller?.destroy();reportSaveError(error);}}});
void boot();
