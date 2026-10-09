import {kitBalanceOf} from '../meta/kitBalance.ts';
import { freeze } from '../core/immutable.ts';
import { validateConfig } from '../core/validation.ts';
import { validatePlayerBuild, canReceiveSkillReward } from '../core/playerBuild.ts';
import { getAvailableBoardSkills, getDropOptions, instantSlots, needsTurnStart } from '../core/index.ts';
import { gaugeDefinition } from '../core/gauge.ts';
import { tuningOf } from '../core/tuning.ts';
import { prepareEnemyOrder } from './BattleRun.ts';
import { applyRunReward, isSkillReward } from './rewards.ts';
import type { RewardId } from './rewards.ts';
import type { BattleConfig, BattleState, EnemyId } from '../core/types.ts';
import type { BattleRunOptions, BattleRunState } from './BattleRun.ts';
export const SAVE_FORMAT = 'game1-next-save';
export const SAVE_SCHEMA = 1;
export const SAVE_RULES = 'next-1.2-clear50-intrinsic-health';
export const SNAPSHOT_SAVE_RULES = 'next-1.4-kit-balance-snapshot-v1';
export const PROGRESSION_SAVE_RULES = 'next-1.6-progression-v2';
export const LATE_SAVE_RULES = 'next-1.10-encounters-bands-v2';
export const ENCOUNTER_SAVE_RULES = 'next-1.9-encounters-bands-v1';
export const RETIRED_SAVE_RULES = 'next-1.7-explicit-return-v1';
/** 日本語: 深層（別ステージ1〜50階）のラン。旧版はこの保存を読まない。English: Deep-stage runs; older builds refuse rather than misread them. */
export const CHARACTER_SAVE_RULES='next-1.14-mint-violet-v1';
export const DEEP_SAVE_RULES = 'next-1.13-deep-v2';
const MAX_SAVE_LENGTH=2_000_000;
const MAX_SAVE_BOXES=64*64;
// 日本語: 衝突箱を全て飛ばす場合と後続の自動投入でも整数範囲を越えない。
// English: Keep headroom for every possible collision plus the following automatic insertions.
const BOX_ID_HEADROOM=MAX_SAVE_BOXES+8;
export interface PendingReward { readonly offerId: string; readonly rewardId: RewardId | null; readonly replacement?: number }
export interface RunCheckpoint {
  readonly achievements?: import('./runAchievements.ts').RunAchievements;
  readonly runId: string;
  readonly initialConfig: BattleConfig;
  readonly options: { readonly run?: BattleRunOptions };
  readonly state: BattleState;
  readonly run: BattleRunState | null;
  readonly enemyOrder: readonly EnemyId[] | null;
  readonly rewardRng: number;
  /** 日本語: 報酬適用前の確定操作。復帰時はこの元状態から一度だけ完了する。
   * English: A durable reward intent resumes from its pre-effect state, never a partly advanced stage. */
  readonly pendingReward?: PendingReward;
}
export interface SaveEnvelope { readonly format: typeof SAVE_FORMAT; readonly schema: typeof SAVE_SCHEMA; readonly rules: typeof SAVE_RULES | typeof SNAPSHOT_SAVE_RULES | typeof PROGRESSION_SAVE_RULES | typeof RETIRED_SAVE_RULES | typeof ENCOUNTER_SAVE_RULES | typeof LATE_SAVE_RULES | typeof DEEP_SAVE_RULES | typeof CHARACTER_SAVE_RULES; readonly revision: number; readonly savedAt: number; readonly checkpoint: RunCheckpoint; readonly checksum: string }
const require=(ok:unknown,message:string):void=>{if(!ok)throw new Error(`セーブ内容を確認できません：${message}`);};
const integer=(n:unknown,min=0,max=Number.MAX_SAFE_INTEGER)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=min&&n<=max;
function record(v:unknown):v is Record<string,unknown>{return !!v&&typeof v==='object'&&!Array.isArray(v);}
/** Stable means the whole automatic response has finished, including Red's next start. */
export function isCheckpointBoundary(state:BattleState,run:BattleRunState|null):boolean {
  if(run?.status==='transitioning')return false;
  if(state.result)return true;
  return state.actor==='player'&&!needsTurnStart(state)&&(getDropOptions(state).some(o=>o.available)||getAvailableBoardSkills(state).length>0||instantSlots(state).length>0);
}
export function validateCheckpoint(value:unknown):asserts value is RunCheckpoint {
 require(record(value),'形式');const c=value as RunCheckpoint;
 require(record(c.state)&&record(c.options)&&record(c.initialConfig),'構造');
 require(typeof c.runId==='string'&&c.runId.length>=8&&c.runId.length<=100,'ラン識別子');
 if(c.achievements!==undefined){const a=c.achievements;require(record(a)&&a.version===1&&(a.turnKey===null||typeof a.turnKey==='string'&&/^\d+:\d+$/.test(a.turnKey))&&[a.turnDamage,a.bestTurnDamage,a.highestMaxHp].every(n=>integer(n)),'実績の観測記録');}
 const s=c.state;require(record(s.config)&&record(s.config.board),'盤面');
 require(integer(s.config.board.width,1,64)&&integer(s.config.board.height,1,64),'盤面サイズ');
 require(integer(c.initialConfig.board?.width,1,64)&&integer(c.initialConfig.board?.height,1,64),'開始盤面サイズ');
 validateConfig(c.initialConfig);validateConfig(s.config);
 require(s.config.characterId===c.initialConfig.characterId,'キャラクター');
 require(JSON.stringify(s.config.meta)===JSON.stringify(c.initialConfig.meta),'出発時の構成');
 require(JSON.stringify(s.config.board)===JSON.stringify(c.initialConfig.board),'開始盤面との対応');
 require(Array.isArray(s.boxes)&&s.boxes.length<=MAX_SAVE_BOXES,'箱');
 // Reuse the authoritative config validator for runtime boxes, gauge, form and build.
 validateConfig({...s.config,initialBoxes:s.boxes,initialBuild:s.build??undefined,initialGauge:s.gauge,initialTransformation:s.transformation??undefined});
 require(s.actor==='player'||s.actor==='enemy','手番');
 for(const n of [s.enemyTurnCount,s.link3Growth])require(integer(n),'戦闘カウンター');
 require(integer(s.turn,1)&&integer(s.nextBoxId,1,Number.MAX_SAFE_INTEGER-BOX_ID_HEADROOM)&&integer(s.enemyPatternIndex,0,s.config.enemyPattern.length-1),'進行値');
 require(integer(s.rngState,0,0xffff_ffff)&&integer(c.rewardRng,0,0xffff_ffff),'乱数');
 require(s.comboStreak===undefined||s.config.meta?.characterRevision===1&&s.config.meta.rosterId==='mint'&&integer(s.comboStreak),'コンボ連続数');
 require(s.comboActivated===undefined||s.config.meta?.characterRevision===1&&s.config.meta.rosterId==='mint'&&typeof s.comboActivated==='boolean','コンボ発動');
 require(typeof s.playerTurnStarted==='boolean','追加投入開始');
 require(s.barrier===undefined||s.config.meta?.kitVersion===2&&s.config.meta.rosterId==='silver'&&integer(s.barrier,0,kitBalanceOf(s.config).silverBarrier),'バリア');
 require(s.shinyNextDrop===undefined||typeof s.shinyNextDrop==='boolean'&&s.config.meta?.rosterId==='imashiru','次の輝き投入');
 require(s.build===null||record(s.build),'装備');if(s.build)validatePlayerBuild(s.build,s.config);
 require(s.transformation===null||record(s.transformation),'変化');
 require(integer(s.gauge,0,gaugeDefinition(s.config.characterId,tuningOf(s.config))?.cap??0),'ゲージ');
 for(const actor of ['player','enemy'] as const){require(record(s.hp?.[actor]),'HP');const hp=s.hp[actor];require(integer(hp.max,1)&&integer(hp.current,-Number.MAX_SAFE_INTEGER,hp.max),'HP値');}
 if(s.enemyPhase!==undefined){require(s.config.enemyId==='mother-core'&&['normal','critical'].includes(s.enemyPhase.phase)&&integer(s.enemyPhase.completedTurns),'ボス段階');}
 if(s.config.enemyId==='mother-core'){require(s.enemyPhase!==undefined,'ボス段階の欠落');require(s.enemyPhase!.completedTurns<=s.enemyTurnCount&&(s.enemyPhase!.phase!=='normal'||s.enemyPhase!.completedTurns===s.enemyTurnCount),'ボス時計');}
 if(s.result){require(['player','enemy'].includes(s.result.winner)&&['hp-zero','enemy-blocked'].includes(s.result.reason),'勝敗');require(s.result.winner==='player'?s.hp.player.current>0&&s.hp.enemy.current<=0:s.hp.player.current<=0,'勝敗とHP');}
 else require(s.result===null&&s.hp.player.current>0&&s.hp.enemy.current>0,'進行中HP');
 const o=c.options.run;
 if(o){require(o.encounterVersion===undefined||['bands-v1','bands-v2','deep-v2'].includes(o.encounterVersion)&&o.route==='boss-loop'&&(o.encounterVersion!=='deep-v2'||o.finishAtStage===50),'出現表の版');require(o.mode===undefined||['finite','endless'].includes(o.mode),'run方式');require(o.route===undefined||['standard','boss-loop'].includes(o.route),'経路');require(o.rewardMode===undefined||['mixed-v1','categories'].includes(o.rewardMode),'報酬方式');require(o.rewards===undefined||typeof o.rewards==='boolean','報酬設定');require(o.startStage===undefined||integer(o.startStage,1),'開始階');require(o.finishAtStage===undefined||integer(o.finishAtStage,1)&&(o.startStage??1)<=o.finishAtStage,'終了階');require(o.rotationStart===undefined||['marujiro','hikikizan','nigirin','merarun','speed-core','mother-core'].includes(o.rotationStart),'開始敵');}
 const order=prepareEnemyOrder(c.initialConfig,o);require(JSON.stringify(order)===JSON.stringify(c.enemyOrder),'敵順序');
 if(c.run){const r=c.run;require(order&&integer(r.stage,1)&&integer(r.defeatedCount)&&r.currentEnemyId===s.config.enemyId,'run');require(['active','reward','lost','cleared','retired'].includes(r.status),'保存境界');require(o?.finishAtStage===undefined||r.stage<=o.finishAtStage,'終了階を越えるrun');
  const continues=(o?.finishAtStage===undefined||r.stage<o.finishAtStage)&&(o?.mode==='endless'||r.stage<order!.length);
  if(r.status==='cleared')require(!continues,'未完了のクリア');
  const expected=r.stage-(o?.startStage??1)+(r.status==='reward'||r.status==='cleared'?1:0);require(r.defeatedCount===expected,'撃破数');
  require(r.status==='active'||r.status==='retired'?!s.result:r.status==='lost'?s.result?.winner==='enemy':s.result?.winner==='player','run勝敗');
  if(r.status==='retired')require(s.actor==='player'&&!needsTurnStart(s)&&!c.pendingReward,'帰還境界');
  if(r.status==='reward'){require(o?.rewards&&s.build&&continues,'報酬資格');const offer=r.offer;require(offer&&typeof offer.id==='string'&&Array.isArray(offer.choices)&&offer.choices.length<=20,'候補');require(new Set(offer!.choices).size===offer!.choices.length,'候補重複');require(offer!.choices.every(id=>!isSkillReward(id)||canReceiveSkillReward(s.build!,id)&&(!c.initialConfig.meta||c.initialConfig.meta.pool.includes(id))),'スキル候補資格');
   require(offer!.choices.every(id=>isSkillReward(id)||['max-health','three-polish','four-polish','five-polish','large-polish','immediate-heal'].includes(id)),'候補ID');
   if(o?.rewardMode==='categories'){require(['pending','heal','stats','skills'].includes(offer!.category??''),'カテゴリ');if(offer!.category==='pending')require(offer!.choices.length===0,'未選択候補');if(offer!.category==='heal')require(JSON.stringify(offer!.choices)==='["immediate-heal"]'&&c.pendingReward?.rewardId==='immediate-heal','回復候補');if(offer!.category==='stats')require(offer!.choices.every(id=>['max-health','three-polish','four-polish','five-polish'].includes(id)),'強化候補');if(offer!.category==='skills')require(offer!.choices.every(isSkillReward),'スキル候補');}
  }else require(r.offer===undefined,'残った報酬');
 }else require(c.run===null&&order===null,'run欠落');
 require(isCheckpointBoundary(s,c.run),'未解決の自動行動');
 if(c.pendingReward){const p=c.pendingReward,offer=c.run?.offer;require(c.run?.status==='reward'&&offer&&offer.category!=='pending'&&p.offerId===offer.id,'確定報酬');require(p.replacement===undefined||integer(p.replacement,0,(s.build?.slots.length??0)-1),'交換先');require(p.rewardId===null||offer!.choices.includes(p.rewardId),'確定候補');require(p.rewardId===null||applyRunReward(s,p.rewardId,p.replacement)!==null,'報酬適用');}
}
/** A returned run preserves the live battle facts; only its run outcome becomes terminal. */
export function canRetireCheckpoint(c:RunCheckpoint):boolean{return c.run?.status==='active'&&!c.pendingReward&&!c.state.result&&c.state.actor==='player'&&!needsTurnStart(c.state)&&isCheckpointBoundary(c.state,c.run);}
export function prepareRetiredCheckpoint(c:RunCheckpoint):RunCheckpoint {validateCheckpoint(c);require(canRetireCheckpoint(c),'帰還できる自手番ではありません');const next=freeze(structuredClone({...c,run:{...c.run!,status:'retired' as const}}));validateCheckpoint(next);return next;}
function saveRulesFor(checkpoint:RunCheckpoint):SaveEnvelope['rules']{return checkpoint.initialConfig.meta?.characterRevision===1?CHARACTER_SAVE_RULES:checkpoint.options.run?.encounterVersion==='deep-v2'?DEEP_SAVE_RULES:checkpoint.options.run?.encounterVersion==='bands-v2'?LATE_SAVE_RULES:checkpoint.options.run?.encounterVersion?ENCOUNTER_SAVE_RULES:checkpoint.run?.status==='retired'?RETIRED_SAVE_RULES:checkpoint.initialConfig.meta?.progressionVersion===2?PROGRESSION_SAVE_RULES:checkpoint.initialConfig.meta?.kitBalance===undefined?SAVE_RULES:SNAPSHOT_SAVE_RULES;}
// Accidental corruption detection, not an authentication or anti-cheat mechanism.
function checksum(text:string):string {let h=0x811c9dc5;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,0x01000193);}return(h>>>0).toString(16).padStart(8,'0');}
export function encodeSave(checkpoint:RunCheckpoint,revision:number,savedAt=Date.now()):string {
 validateCheckpoint(checkpoint);require(integer(revision,1)&&integer(savedAt),'保存ヘッダー');
 const body={format:SAVE_FORMAT,schema:SAVE_SCHEMA,rules:saveRulesFor(checkpoint),revision,savedAt,checkpoint};const raw=JSON.stringify({...body,checksum:checksum(JSON.stringify(body))});require(raw.length<=MAX_SAVE_LENGTH,'保存サイズ');return raw;
}
export function decodeSave(raw:string):SaveEnvelope {
 require(typeof raw==='string'&&raw.length<=MAX_SAVE_LENGTH,'保存サイズ');let data:unknown;try{data=JSON.parse(raw);}catch{throw new Error('セーブ内容が壊れています。自動で消去せずそのまま保持しました。');}
 require(record(data),'保存形式');const e=data as unknown as SaveEnvelope;
 if(e.format!==SAVE_FORMAT||e.schema!==SAVE_SCHEMA||(e.rules!==SAVE_RULES&&e.rules!==SNAPSHOT_SAVE_RULES&&e.rules!==PROGRESSION_SAVE_RULES&&e.rules!==RETIRED_SAVE_RULES&&e.rules!==ENCOUNTER_SAVE_RULES&&e.rules!==LATE_SAVE_RULES&&e.rules!==DEEP_SAVE_RULES&&e.rules!==CHARACTER_SAVE_RULES))throw new Error('この版では読めないセーブです。元の保存は変更していません。');
 require(integer(e.revision,1)&&integer(e.savedAt),'保存時刻');
 const body={format:e.format,schema:e.schema,rules:e.rules,revision:e.revision,savedAt:e.savedAt,checkpoint:e.checkpoint};require(e.checksum===checksum(JSON.stringify(body)),'破損チェック');validateCheckpoint(e.checkpoint);require(e.rules===saveRulesFor(e.checkpoint),'出発時の調整と保存ルールの対応');return freeze(structuredClone(e));
}
