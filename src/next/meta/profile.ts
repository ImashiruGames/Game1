import {tutorialCatalog} from './tutorialCatalog.ts';
import {validTreeTutorial} from './treeTutorial.ts';
import type {TreeTutorialProgress} from './treeTutorial.ts';
import {paidTreePoints,nextTreeCost} from './treePricing.ts';
import {boardUnlockStages,sequentialBoardChoices} from './boardUnlockStages.ts';
import {missingTrophySkills} from './trophies.ts';
import {CURRENT_KIT_BALANCE,CURRENT_BOARD_BALANCE} from './kitBalance.ts';
import type {KitBalanceSnapshot,BoardBalanceSnapshot} from './kitBalance.ts';
import {KIT_VERSION,LEGACY_STARTERS,LEGACY_BOARDS,BOARD_CATALOG_VERSION,characterBoardChoices,legacyBoardChoices} from './kits.ts';
import { roster,rosterIds,isRosterId } from './roster.ts';
import type {RosterId} from './roster.ts';
import type {NormalSkillId,BoardSkillId} from '../core/types.ts';
import type {RunCheckpoint} from '../app/saveCheckpoint.ts';
import {normalSkillIds,skillCatalog} from '../core/skillCatalog.ts';
import {sampleUniformIndex} from '../core/random.ts';
import {saveNamespace} from '../app/localSave.ts';
import type {SaveStorage} from '../app/localSave.ts';
export const META={schema:2,initialPoints:2,pointsPerLevel:2,maxLevel:50,xpBase:40,xpStep:20,xpPerEnemy:10,coinsPerEnemy:5,clearXp:250,clearCoins:200,poolMin:6,poolMax:20,gachaCost:100,gachaBatchCost:900,deepXpPerEnemy:15,deepCoinsPerEnemy:8,deepClearXp:500,deepClearCoins:400,energyXp:50,characterRate:20,skillRate:40,energyRate:40,duplicateCharacterEnergy:3,duplicateSkillCoins:20} as const;
export const starterInventory:readonly NormalSkillId[]=['grow-fire','corner-strike','square-strike','horizontal-slash','charge','first-guard'];
export const REWARD_HEAL_PER_RANK=2;
export const treeNodes={rewardHeal:{name:'報酬の即時回復',description:'BUILD REWARDの即時回復＋2 / 段階（他の回復は対象外）',max:5,cost:1},three:{name:'3リンク基礎火力',description:'初期火力＋1 / 段階',max:5,cost:1},four:{name:'4リンク基礎火力',description:'初期火力＋1 / 段階',max:5,cost:1},five:{name:'5以上リンク基礎火力',description:'初期火力＋2 / 段階',max:5,cost:1},slots:{name:'通常スキル自由枠',description:'自由枠＋1 / 段階（最大4枠）',max:2,cost:3},board:{name:'専用盤面スキルの解放',description:'上から順に1つずつ解放。各段階3・10・25pt（追加技2つのキャラは2段階まで）',max:3,cost:3}} as const;
export type TreeId=keyof typeof treeNodes;export type Tree=Record<Exclude<TreeId,'rewardHeal'>,number>&{rewardHeal?:number};
export interface CharacterProgress {treeCostVersion?:2;legacyLevelFloor?:number;legacyPointFloor?:number;xp:number;tree:Tree;pool:NormalSkillId[];board:BoardSkillId}
export interface Receipt {runId:string;character:RosterId;xp:number;coins:number;defeated:number;clear:boolean;trophies:string[];at:number}
export interface DrawResult {id:number;kind:'character'|'skill'|'energy';item:string;duplicate:boolean;coins:number;energy:number}
export interface GachaBatch {profile:Profile;results:DrawResult[]}
export interface Profile {characterRevision?:1;growthVersion?:3;importedGrowthSources?:string[];treeTutorial?:TreeTutorialProgress;treeVersion?:2;schema:1|2;boardCatalogVersion?:2;progressionVersion?:2;revision:number;selected:RosterId;coins:number;energy:number;ownedCharacters:RosterId[];ownedSkills:NormalSkillId[];characters:Record<RosterId,CharacterProgress>;trophies:Record<string,number>;receipts:Record<string,Receipt>;launches:Record<string,{character:RosterId;snapshot:string}>;rng:number;drawCount:number;pendingDraw:boolean;lastDraw:DrawResult|null}
export interface RunMeta {characterRevision?:1;treeCostVersion?:2;balanceVersion?:2;treeVersion?:2;version:1;boardCatalogVersion?:2;boardBalance?:BoardBalanceSnapshot;progressionVersion?:2;kitVersion?:2;kitBalance?:KitBalanceSnapshot;rosterId:RosterId;level:number;tree:Tree;pool:NormalSkillId[];board:BoardSkillId;slots:number;eligible:boolean}
const emptyTree=():Tree=>({three:0,four:0,five:0,slots:0,board:0,rewardHeal:0});
export function eligibleSkills(p:Profile,id:RosterId):NormalSkillId[]{return normalSkillIds.filter(skill=>(p.ownedSkills.includes(skill)||roster[id].starter===skill||LEGACY_STARTERS[id]===skill)&&skillCatalog[skill].rewardAccess!=='never'&&(skillCatalog[skill].rewardAccess!=='starter-upgrade-only'||roster[id].starter===skill));}
export function createProfile(seed=crypto.getRandomValues(new Uint32Array(1))[0]!):Profile {const p:Profile={characterRevision:1,growthVersion:3,treeVersion:2,schema:2,boardCatalogVersion:BOARD_CATALOG_VERSION,progressionVersion:2,revision:0,selected:'blue',coins:0,energy:0,ownedCharacters:['blue','red'],ownedSkills:[...starterInventory],characters:{} as Profile['characters'],trophies:{},receipts:{},launches:{},rng:seed>>>0,drawCount:0,pendingDraw:false,lastDraw:null};for(const id of rosterIds){p.characters[id]={treeCostVersion:2,xp:0,tree:emptyTree(),pool:[],board:roster[id].board};const list=eligibleSkills(p,id);p.characters[id].pool=[...list.filter(x=>x===roster[id].starter),...list.filter(x=>x!==roster[id].starter)].slice(0,META.poolMin);}return p;}
/** Growth terms are separate from kit balance. Legacy arithmetic remains immutable. */
export const PROGRESSION_VERSION=2 as const;
export const LEGACY_MAX_LEVEL=30;
export function treeRankCap(id:TreeId,level:number,rosterId?:RosterId):number{return (id==='board'&&rosterId?boardUnlockStages(rosterId).filter(s=>s.skill).length:treeNodes[id].max)+(['three','four','five','rewardHeal'].includes(id)?Math.floor(level/5):0);}
export function treePointCapacity(level:number,version?:2):number{return paidTreePoints(Object.fromEntries((Object.keys(treeNodes) as TreeId[]).map(id=>[id,treeRankCap(id,level)])) as Tree,version);}
export const TREE_POINT_CAPACITY=treePointCapacity(1,2);
function levelAt(xp:number,cap:number):{level:number;current:number;next:number;points:number}{if(!Number.isSafeInteger(xp)||xp<0)throw new Error('経験値が不正です');let level=1,current=xp;while(level<cap){const next=40+(level-1)*20;if(current<next)break;current-=next;level++;}return {level,current,next:level===cap?0:40+(level-1)*20,points:2+(level-1)*2};}
export const levelInfo=(xp:number)=>levelAt(xp,META.maxLevel);
export const legacyLevelInfo=(xp:number)=>levelAt(xp,LEGACY_MAX_LEVEL);
export function characterGrowth(c:CharacterProgress,schema:1|2=2){const growth=schema===1?legacyLevelInfo(c.xp):c.treeCostVersion===2?levelInfo(c.xp):levelAt(c.xp,12),level=Math.max(growth.level,c.legacyLevelFloor??1),points=Math.max(growth.points,c.legacyPointFloor??2),allocationBudget=Math.min(points,treePointCapacity(level,c.treeCostVersion)),spent=paidTreePoints(c.tree,c.treeCostVersion);return {...growth,level,points,allocationBudget,spent,allocatable:allocationBudget-spent,reserve:points-allocationBudget,growthAtCap:growth.next===0,treeComplete:spent===treePointCapacity(level,c.treeCostVersion),storedXp:c.xp};}
/** 日本語: 育成権利と旧盤面選択を一度だけ移行。経験値・通貨・精算・出発台帳は削らない。
 * English: Migrate entitlements and board selections once, preserving XP, currency and both ledgers. */
export function migrateProfile(p:Profile):Profile{
 validateProfile(p);if(p.characterRevision===1&&p.schema===2&&p.boardCatalogVersion===BOARD_CATALOG_VERSION&&p.treeVersion===2&&!p.pendingDraw&&!missingTrophySkills(p).length&&p.growthVersion===3)return p;
 const n=structuredClone(p);
 // 日本語: 旧確認待ちの獲得物は反映済み。確認待ちの印だけを消す。
 // English: Legacy pending results were already granted. Clear only the obsolete acknowledgement flag.
 n.pendingDraw=false;
 n.ownedSkills.push(...missingTrophySkills(n));
 n.treeVersion=2;for(const id of rosterIds)n.characters[id].tree.rewardHeal??=0;
 if(p.schema===1){n.schema=2;n.progressionVersion=PROGRESSION_VERSION;for(const id of rosterIds){const old=legacyLevelInfo(n.characters[id].xp);n.characters[id].legacyLevelFloor=old.level;n.characters[id].legacyPointFloor=old.points;}}
 if(p.boardCatalogVersion!==BOARD_CATALOG_VERSION){n.boardCatalogVersion=BOARD_CATALOG_VERSION;for(const id of rosterIds){const c=n.characters[id];if(!characterBoardChoices(id,!!c.tree.board).includes(c.board))c.board=roster[id].board;}}
 // 日本語: ユーザー指定の一回限りの全返還。EXP由来の総ポイントは不変、使用額を0へ。進行中ランと出発台帳には触れない。
 // English: One-time user-requested full respec. Keep earned points, zero spent points, preserve active run snapshots and launch records.
 if(p.growthVersion!==3){n.growthVersion=3;for(const id of rosterIds){const c=n.characters[id];c.treeCostVersion=2;c.tree=emptyTree();c.board=roster[id].board;}}

 if(n.characterRevision!==1){const c=n.characters.violet;if(c.tree.board===1&&c.board==='violet-venom')c.board='violet-sting';n.characterRevision=1;}
 validateProfile(n);return n;
}
export function gainCharacterXp(c:CharacterProgress,amount:number,legacyTerms=false):CharacterProgress{const xp=c.xp+amount;if(!Number.isSafeInteger(amount)||amount<0||!Number.isSafeInteger(xp))throw new Error('経験値の上限を超えるため保存していません');const n={...c,xp};if(legacyTerms){const old=legacyLevelInfo(xp);n.legacyLevelFloor=Math.max(c.legacyLevelFloor??1,old.level);n.legacyPointFloor=Math.max(c.legacyPointFloor??2,old.points);}return n;}
export function useXpEnergy(p:Profile,id:RosterId):Profile{const current=migrateProfile(p);if(!current.ownedCharacters.includes(id)||current.energy<1)throw new Error('使用できるエナジーがありません');if(characterGrowth(current.characters[id]).growthAtCap)throw new Error('このキャラは成長上限です。別のキャラに使用できます');const n=structuredClone(current);n.characters[id]=gainCharacterXp(n.characters[id],META.energyXp);n.energy--;return n;}

export function spentPoints(tree:Tree):number{return paidTreePoints(tree,2);}
export function availableBoards(tree:Tree,id:RosterId):BoardSkillId[]{return sequentialBoardChoices(id,tree.board);}
export function validatePool(p:Profile,id:RosterId,pool:readonly NormalSkillId[]):void {const eligible=eligibleSkills(p,id);if(pool.length<META.poolMin||pool.length>META.poolMax||new Set(pool).size!==pool.length||pool.some(s=>!eligible.includes(s)))throw new Error('候補プールは所持・使用可能な6〜20種類を選んでください');}
export function freezeRunMeta(p:Profile,id:RosterId,eligible:boolean):RunMeta {if(!p.ownedCharacters.includes(id))throw new Error('このキャラは未所持です');const current=migrateProfile(p),c=current.characters[id];validatePool(current,id,c.pool);return structuredClone({...(['mint','violet'].includes(id)?{characterRevision:1 as const}:{}),version:1,balanceVersion:2,treeVersion:2,boardCatalogVersion:BOARD_CATALOG_VERSION,boardBalance:CURRENT_BOARD_BALANCE,progressionVersion:PROGRESSION_VERSION,kitVersion:KIT_VERSION,kitBalance:CURRENT_KIT_BALANCE,rosterId:id,level:characterGrowth(c).level,treeCostVersion:c.treeCostVersion,tree:c.tree,pool:c.pool,board:c.board,slots:2+c.tree.slots,eligible});}
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const nat=(n:unknown)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;
export function validateProfile(p:Profile):void {if(!record(p)||(p.characterRevision!==undefined&&p.characterRevision!==1)||(p.growthVersion!==undefined&&p.growthVersion!==3)||(p.importedGrowthSources!==undefined&&(!Array.isArray(p.importedGrowthSources)||p.importedGrowthSources.length>1000||p.importedGrowthSources.some(v=>typeof v!=='string'||!/^[a-f0-9]{64}$/.test(v))))||!validTreeTutorial(p.treeTutorial)||!record(p.characters)||(p.schema!==1&&p.schema!==2)||(p.boardCatalogVersion!==undefined&&p.boardCatalogVersion!==BOARD_CATALOG_VERSION)||(p.schema===1?p.progressionVersion!==undefined:p.progressionVersion!==PROGRESSION_VERSION)||(p.treeVersion!==undefined&&p.treeVersion!==2)||!nat(p.revision)||!isRosterId(p.selected)||!nat(p.coins)||!nat(p.energy)||!nat(p.rng)||p.rng>0xffffffff||!nat(p.drawCount)||typeof p.pendingDraw!=='boolean')throw new Error('成長データの形式を確認できません。元の保存は保持しています');if(!Array.isArray(p.ownedCharacters)||new Set(p.ownedCharacters).size!==p.ownedCharacters.length||p.ownedCharacters.some(id=>!isRosterId(id))||!p.ownedCharacters.includes(p.selected))throw new Error('キャラ所持データが不正です');if(!Array.isArray(p.ownedSkills)||new Set(p.ownedSkills).size!==p.ownedSkills.length||p.ownedSkills.some(id=>!normalSkillIds.includes(id)||['starter-upgrade-only','never'].includes(skillCatalog[id].rewardAccess??'shared')))throw new Error('スキル所持データが不正です');for(const id of rosterIds){const c=p.characters?.[id];if(!record(c)||!nat(c.xp)||!record(c.tree)||(Object.keys(treeNodes) as TreeId[]).some(n=>!(n==='rewardHeal'&&c.tree[n]===undefined)&&(!nat(c.tree[n])||(c.tree[n]??0)>(n==='board'?(p.growthVersion===3?treeRankCap(n,characterGrowth(c,p.schema).level,id):1):p.treeVersion===2?treeRankCap(n,characterGrowth(c,p.schema).level):treeNodes[n].max)))||(p.growthVersion===3?c.treeCostVersion!==2:c.treeCostVersion!==undefined)||paidTreePoints(c.tree,c.treeCostVersion)>characterGrowth(c,p.schema).points||!(p.boardCatalogVersion===BOARD_CATALOG_VERSION?(p.growthVersion===3?sequentialBoardChoices(id,c.tree.board,p.characterRevision===1):characterBoardChoices(id,!!c.tree.board,p.characterRevision===1)):legacyBoardChoices(id,!!c.tree.board)).includes(c.board))throw new Error('キャラ成長データが不正です');const floor=c.legacyLevelFloor,points=c.legacyPointFloor;if(p.schema===1&&(floor!==undefined||points!==undefined)||p.schema===2&&((floor===undefined)!==(points===undefined)||floor!==undefined&&(!nat(floor)||floor<1||floor>LEGACY_MAX_LEVEL||!nat(points)||points!==2+(floor-1)*2||floor>legacyLevelInfo(c.xp).level)))throw new Error('保持した育成記録が不正です');validatePool(p,id,c.pool);}if(!record(p.receipts)||!record(p.launches)||!record(p.trophies)||Object.values(p.trophies).some(n=>!nat(n)))throw new Error('精算履歴が不正です');
 for(const [id,r] of Object.entries(p.receipts)){if(!record(r)||r.runId!==id||!isRosterId(r.character)||![r.xp,r.coins,r.defeated,r.at].every(nat)||r.defeated>50||typeof r.clear!=='boolean'||!Array.isArray(r.trophies)||r.trophies.some(t=>typeof t!=='string'))throw new Error('精算記録が不正です');}
 for(const [id,l] of Object.entries(p.launches)){if(id.length<8||!record(l)||!isRosterId(l.character)||typeof l.snapshot!=='string')throw new Error('出発記録が不正です');}
 if(p.lastDraw){const r=p.lastDraw;if(!nat(r.id)||r.id!==p.drawCount||!['character','skill','energy'].includes(r.kind)||typeof r.item!=='string'||typeof r.duplicate!=='boolean'||!nat(r.coins)||!nat(r.energy)||(r.kind==='character'&&!isRosterId(r.item))||(r.kind==='skill'&&(!normalSkillIds.includes(r.item as NormalSkillId)||['starter-upgrade-only','never','trophy'].includes(skillCatalog[r.item as NormalSkillId]?.rewardAccess??'shared'))))throw new Error('抽選記録が不正です');}else if(p.pendingDraw||p.drawCount!==0)throw new Error('抽選結果が欠落しています');
}
/** 日本語: 正式な深層出発（別ステージ1→50階・deep-v2）かどうか。English: A genuine deep departure (own stage 1→50, deep-v2). */
export function isDeepRun(cp:RunCheckpoint):boolean{const o=cp.options.run;return o?.startStage===1&&o.finishAtStage===50&&o.route==='boss-loop'&&o.encounterVersion==='deep-v2';}
// 日本語: 通常ランは深層を含めない（深層クリアで50階トロフィーを渡さない）。English: Standard runs exclude deep, so a deep clear never grants floor-50 trophies.
const isStandardRun=(cp:RunCheckpoint)=>cp.options.run?.startStage===1&&cp.options.run?.finishAtStage===50&&cp.options.run?.route==='boss-loop'&&cp.options.run?.encounterVersion!=='deep-v2';
/** 日本語: 深層はそのキャラで50階をクリアすると開く。English: Deep unlocks after this character clears floor 50. */
export function canEnterDeep(p:Profile,id:RosterId):boolean{return p.ownedCharacters.includes(id)&&Object.hasOwn(p.trophies,`clear50:${id}`);}
export function resultReceipt(p:Profile,cp:RunCheckpoint,now=Date.now()):Receipt|null {const m=cp.initialConfig.meta,run=cp.run,launch=p.launches[cp.runId],deep=isDeepRun(cp);if(!m?.eligible||!run||!['lost','cleared','retired'].includes(run.status)||cp.pendingReward||!(deep||isStandardRun(cp))||!launch||launch.character!==m.rosterId||launch.snapshot!==JSON.stringify(m))return null;if(p.receipts[cp.runId])return p.receipts[cp.runId]!;
 if(deep){const clear=run.status==='cleared'&&run.stage===50&&run.defeatedCount===50&&cp.state.hp.player.current>0;return {runId:cp.runId,character:m.rosterId,xp:run.defeatedCount*META.deepXpPerEnemy+(clear?META.deepClearXp:0),coins:run.defeatedCount*META.deepCoinsPerEnemy+(clear?META.deepClearCoins:0),defeated:run.defeatedCount,clear,trophies:[],at:now};}const clear=run.status==='cleared'&&run.stage===50&&run.defeatedCount===50&&cp.state.hp.player.current>0;const trophies=clear?['clear50:first',`clear50:${m.rosterId}`].filter(id=>!Object.hasOwn(p.trophies,id)):[];return {runId:cp.runId,character:m.rosterId,xp:run.defeatedCount*META.xpPerEnemy+(clear?META.clearXp:0),coins:run.defeatedCount*META.coinsPerEnemy+(clear?META.clearCoins:0),defeated:run.defeatedCount,clear,trophies,at:now};}
/** Only a registered, genuine 1–50 departure can claim newly observed run achievements. */
export function settleAchievements(p:Profile,cp:RunCheckpoint,now=Date.now()):Profile {
 const m=cp.initialConfig.meta,launch=p.launches[cp.runId];
 if(!m?.eligible||!cp.run||cp.pendingReward||!launch||launch.character!==m.rosterId||launch.snapshot!==JSON.stringify(m)||!(isStandardRun(cp)||isDeepRun(cp)))return p;
 const earned:string[]=[];
 const terminal=['lost','cleared','retired'].includes(cp.run.status);
 if(Math.max(cp.achievements?.bestTurnDamage??0,terminal?(cp.achievements?.turnDamage??0):0)>=100)earned.push('damage100:turn');
 if((cp.achievements?.highestMaxHp??0)>=100)earned.push('maxhp100:run');
 const fresh=earned.filter(id=>!Object.hasOwn(p.trophies,id));if(!fresh.length)return p;
 const n=structuredClone(p);for(const id of fresh)n.trophies[id]=now;n.ownedSkills.push(...missingTrophySkills(n));return n;
}
export function settleProfile(p:Profile,cp:RunCheckpoint,now=Date.now()):Profile {
 const observed=settleAchievements(p,cp,now),r=resultReceipt(observed,cp,now);
 if(!r||observed.receipts[cp.runId])return observed;
 const n=structuredClone(migrateProfile(observed));n.coins+=r.coins;n.characters[r.character]=gainCharacterXp(n.characters[r.character],r.xp,cp.initialConfig.meta?.progressionVersion!==PROGRESSION_VERSION);n.receipts[r.runId]=r;
 for(const id of r.trophies)n.trophies[id]=now;n.ownedSkills.push(...missingTrophySkills(n));delete n.launches[r.runId];return n;
}
/** 日本語: キャラ枠は未所持優先。保存済みの結果は変えず、次の抽選だけに適用する。
 * English: New character draws select unowned entries first; committed prior results never reroll. */
export function characterDrawPool(p:Pick<Profile,'ownedCharacters'>):RosterId[]{const all=rosterIds.filter(id=>id!=='blue'&&id!=='red'),unowned=all.filter(id=>!p.ownedCharacters.includes(id));return unowned.length?unowned:all;}
/** 日本語: 将来の交換ルール変更に備え重複スキルの補償を集約する。
 * English: Keep duplicate skill compensation in one place for a future exchange-rule change. */
function grantDuplicateSkill(p:Profile,result:DrawResult):void{result.coins=META.duplicateSkillCoins;p.coins+=result.coins;}
/** 日本語: 1回分の抽選は取引内の作業用プロフィールだけを更新する。
 * English: One sequential draw mutates only the transaction's private working profile. */
function drawGachaResult(n:Profile):DrawResult {
 let r=sampleUniformIndex(n.rng,100);n.rng=r.rngState;
 const result:DrawResult={id:++n.drawCount,kind:'energy',item:'経験値エナジー ×2',duplicate:false,coins:0,energy:0};
 if(r.index<META.characterRate){
  const candidates=characterDrawPool(n);r=sampleUniformIndex(n.rng,candidates.length);n.rng=r.rngState;
  const id=candidates[r.index]!;result.kind='character';result.item=id;result.duplicate=n.ownedCharacters.includes(id);
  if(result.duplicate){result.energy=META.duplicateCharacterEnergy;n.energy+=result.energy;}
  else {n.ownedCharacters.push(id);if(n.characters[id].board===LEGACY_BOARDS[id])n.characters[id].board=roster[id].board;}
 }else if(r.index<META.characterRate+META.skillRate){
  const candidates=normalSkillIds.filter(id=>!['starter-upgrade-only','never','trophy'].includes(skillCatalog[id].rewardAccess??'shared'));
  r=sampleUniformIndex(n.rng,candidates.length);n.rng=r.rngState;
  const id=candidates[r.index]!;result.kind='skill';result.item=id;result.duplicate=n.ownedSkills.includes(id);
  if(result.duplicate)grantDuplicateSkill(n,result);else n.ownedSkills.push(id);
 }else{result.energy=2;n.energy+=result.energy;}
 return result;
}
/** 日本語: 一括で消費して保存済み乱数と最新の所持状況で順番に抽選する。
 * 結果配列は表示専用。演出を始める前にプロフィールを一度だけ保存する。
 * English: Charge once, then resolve in order using the persisted RNG and updated ownership.
 * Results are presentation-only; commit profile once before showing any animation. */
export function drawGachaBatch(p:Profile,count:1|10):GachaBatch {
 if(count!==1&&count!==10)throw new Error('ガチャは1回または10連で引いてください');
 const cost=count===10?META.gachaBatchCost:META.gachaCost;
 if(p.coins<cost)throw new Error(`コインが${cost}枚必要です`);
 const n=structuredClone(p);n.coins-=cost;n.pendingDraw=false;
 const results:DrawResult[]=[];
 for(let i=0;i<count;i++)results.push(drawGachaResult(n));
 // 日本語: 表示用の配列は保存せず互換用の最終結果だけを維持する。
 // English: Keep the legacy final-result field valid without persisting the presentation queue.
 n.lastDraw={...results[results.length-1]!};
 return {profile:n,results};
}
/** 日本語: 単発の更新済みプロフィールだけを使う呼び出し元との互換を保つ。
 * English: Preserve compatibility for callers that need only the updated single-draw profile. */
export function drawGacha(p:Profile):Profile{return drawGachaBatch(p,1).profile;}
/** 日本語: 残高・抽選結果・精算台帳は一つの書込みで確定。ラン保存とは独立。
 * English: One durable value commits balance + draw/settlement atomically; the run save is separate. */
export class ProfileStore {private raw:string|null|undefined;private value:Profile|null=null;private attempted:string|null=null;readonly key:string;private storage:SaveStorage;private owned:()=>boolean;constructor(storage:SaveStorage,owned:()=>boolean,pathname='/next/'){this.storage=storage;this.owned=owned;this.key=saveNamespace(pathname).key.replace('autosave.v1','profile.v1');}
 read():Profile{if(!this.owned())throw new Error('保存の操作権がありません');this.raw=this.storage.getItem(this.key);if(this.raw===null){this.value=createProfile();return this.write(this.value);}let p:Profile;try{p=JSON.parse(this.raw);}catch{throw new Error('成長データを読めません。保存は消去していません');}validateProfile(p);this.value=p;
  if(p.schema===1||p.boardCatalogVersion!==BOARD_CATALOG_VERSION||p.treeVersion!==2||p.pendingDraw||missingTrophySkills(p).length||p.growthVersion!==3){this.guard();
   // 日本語: 両移行とも元の生データを検証付きで退避し、既存ランの出発文字列は変えない。
   // English: Back up the exact source bytes before either migration; launch snapshot strings stay intact.
   for(const suffix of [...(p.schema===1?['.before-growth-v2']:[]),...(p.boardCatalogVersion!==BOARD_CATALOG_VERSION?['.before-board-catalog-v2']:[]),...(p.treeVersion!==2?['.before-tree-v2']:[]),...(p.growthVersion!==3?['.before-growth-v3']:[])]){const backup=this.key+suffix;this.storage.setItem(backup,this.raw!);if(this.storage.getItem(backup)!==this.raw)throw new Error('成長データの退避を確認できません。元の保存を保持しています');}
   return this.write(migrateProfile(p));
  }return structuredClone(p);}
 get current():Profile{if(!this.value)throw new Error('成長データ未読込');return structuredClone(this.value);}
 guard():void{if(!this.owned()||this.raw===undefined)throw new Error('成長データの操作権がありません');const raw=this.storage.getItem(this.key);if(raw!==this.raw){if(this.attempted&&raw===this.attempted){const p=JSON.parse(raw) as Profile;validateProfile(p);this.value=p;this.raw=raw;this.attempted=null;}else throw new Error('別の操作で成長データが変わりました。ページを開き直してください');}}
 write(profile:Profile):Profile{this.guard();const next=structuredClone(migrateProfile(profile));next.revision=(this.value?.revision??0)+1;validateProfile(next);const raw=JSON.stringify(next);if(raw.length>2_000_000)throw new Error('成長データの保存容量に達しました');this.attempted=raw;this.storage.setItem(this.key,raw);if(this.storage.getItem(this.key)!==raw)throw new Error('成長データを保存できません。操作を止めました');this.raw=raw;this.attempted=null;this.value=next;return structuredClone(next);}
 /** 日本語: 全抽選の保存を確認してから表示用の結果を返す。
  * 書き込み後の例外は保存内容の完全一致で成功を確認する。他タブの新しい保存を巻き戻さない。
  * English: Gacha exposes results only after the entire draw is durably committed.
  * A storage adapter may throw after a successful write; exact bytes prove success.
  * Never restore older bytes here: another tab may have written a newer profile. */
 drawGacha(count:1|10):GachaBatch {
  this.guard();const batch=drawGachaBatch(this.current,count);
  const expected=JSON.stringify({...migrateProfile(batch.profile),revision:this.current.revision+1});
  let profile:Profile;
  try{profile=this.write(batch.profile);}
  catch(error){
   try{
    if(this.attempted!==expected||this.storage.getItem(this.key)!==expected)throw error;
    this.guard();if(this.raw!==expected)throw error;profile=this.current;
   }catch{throw error;}
  }
  return {profile,results:batch.results};
 }

 /** 日本語: 同じ旧バックアップの再取込で、新たな割り振りや既読状態を再リセットしない。識別子と移行を一書込みで保存。
  * English: Reimporting the same legacy backup must not reset new allocations or tutorial progress. Commit the source digest with the migrated profile. */
 async importBackup(profile:Profile):Promise<boolean>{
  this.guard();validateProfile(profile);const before=this.raw,current=this.current,source=JSON.stringify(profile);
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source))),n=>n.toString(16).padStart(2,'0')).join('');this.guard();if(this.raw!==before)throw new Error('復元中に成長データが変わりました。もう一度確認してください');
  if(profile.growthVersion!==3){
   const original=this.storage.getItem(this.key+'.before-growth-v3');
   if(current.importedGrowthSources?.includes(digest)||original&&JSON.stringify(JSON.parse(original))===source)return false;
  }
  const n=structuredClone(migrateProfile(profile));
  n.importedGrowthSources=[...new Set([...(current.importedGrowthSources??[]),...(n.importedGrowthSources??[]),...(profile.growthVersion!==3?[digest]:[])])];
  if(current.treeTutorial?.completed||!n.treeTutorial)n.treeTutorial=current.treeTutorial;
  // 日本語: バックアップ復元で受領台帳を巻き戻さず、チュートリアル報酬の再受領を防ぐ。
  // English: Preserve earned tutorial receipts across imports to prevent a second claim.
  for(const t of tutorialCatalog)if(current.receipts[t.receipt])n.receipts[t.receipt]=current.receipts[t.receipt]!;
  for(const [suffix,raw] of [['.before-import',before!],...(profile.growthVersion!==3?[['.before-growth-import-v3',source]]:[])]){this.storage.setItem(this.key+suffix!,raw!);if(this.storage.getItem(this.key+suffix!)!==raw)throw new Error('復元前の退避を確認できません。元の保存を保持しています');}
  this.write(n);return true;
 }
 update(fn:(p:Profile)=>Profile):Profile{this.guard();const current=this.current,before=JSON.stringify(current),next=fn(current);return JSON.stringify(next)===before?current:this.write(next);}
 settle(cp:RunCheckpoint):Receipt|null{this.guard();const p=this.current;const next=settleProfile(p,cp);if(next!==p)this.write(next);return this.current.receipts[cp.runId]??null;}
 register(cp:RunCheckpoint):void{if(!cp.initialConfig.meta?.eligible)return;this.update(p=>{p.launches[cp.runId]={character:cp.initialConfig.meta!.rosterId,snapshot:JSON.stringify(cp.initialConfig.meta)};return p;});}
}

/** Refund the last purchased rank at its actual current price. */
export function treeRefund(c:CharacterProgress,id:TreeId):number{const rank=c.tree[id]??0;return rank?nextTreeCost(id,rank-1):0;}
export function changeTreeRank(c:CharacterProgress,id:TreeId,delta:1|-1,rosterId?:RosterId):void{
 if(delta!==1&&delta!==-1)throw new Error('強化は1段階ずつ変更してください');
 const rank=c.tree[id]??0,g=characterGrowth(c);
 if(delta===1&&(rank>=treeRankCap(id,g.level,rosterId)||g.allocatable<nextTreeCost(id,rank))||delta===-1&&rank===0)throw new Error('強化の上限またはポイントを確認してください');
 c.tree[id]=rank+delta;
}
