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
export const META={schema:2,initialPoints:2,pointsPerLevel:2,maxLevel:12,xpBase:40,xpStep:20,xpPerEnemy:10,coinsPerEnemy:5,clearXp:250,clearCoins:200,poolMin:6,poolMax:20,gachaCost:100,deepXpPerEnemy:15,deepCoinsPerEnemy:8,deepClearXp:500,deepClearCoins:400,energyXp:50,characterRate:20,skillRate:40,energyRate:40,duplicateCharacterEnergy:3,duplicateSkillCoins:20} as const;
export const starterInventory:readonly NormalSkillId[]=['grow-fire','corner-strike','square-strike','horizontal-slash','charge','first-guard'];
export const REWARD_HEAL_PER_RANK=2;
export const treeNodes={rewardHeal:{name:'報酬の即時回復',description:'BUILD REWARDの即時回復＋2 / 段階（他の回復は対象外）',max:5,cost:1},three:{name:'3リンク基礎火力',description:'初期火力＋1 / 段階',max:5,cost:1},four:{name:'4リンク基礎火力',description:'初期火力＋1 / 段階',max:5,cost:1},five:{name:'5以上リンク基礎火力',description:'初期火力＋2 / 段階',max:5,cost:1},slots:{name:'通常スキル自由枠',description:'自由枠＋1 / 段階（最大4枠）',max:2,cost:3},board:{name:'専用盤面スキルの解放',description:'このキャラ専用の新しい盤面スキル2種類と追加技を選択可能',max:1,cost:3}} as const;
export type TreeId=keyof typeof treeNodes;export type Tree=Record<Exclude<TreeId,'rewardHeal'>,number>&{rewardHeal?:number};
export interface CharacterProgress {legacyLevelFloor?:number;legacyPointFloor?:number;xp:number;tree:Tree;pool:NormalSkillId[];board:BoardSkillId}
export interface Receipt {runId:string;character:RosterId;xp:number;coins:number;defeated:number;clear:boolean;trophies:string[];at:number}
export interface DrawResult {id:number;kind:'character'|'skill'|'energy';item:string;duplicate:boolean;coins:number;energy:number}
export interface Profile {treeVersion?:2;schema:1|2;boardCatalogVersion?:2;progressionVersion?:2;revision:number;selected:RosterId;coins:number;energy:number;ownedCharacters:RosterId[];ownedSkills:NormalSkillId[];characters:Record<RosterId,CharacterProgress>;trophies:Record<string,number>;receipts:Record<string,Receipt>;launches:Record<string,{character:RosterId;snapshot:string}>;rng:number;drawCount:number;pendingDraw:boolean;lastDraw:DrawResult|null}
export interface RunMeta {balanceVersion?:2;treeVersion?:2;version:1;boardCatalogVersion?:2;boardBalance?:BoardBalanceSnapshot;progressionVersion?:2;kitVersion?:2;kitBalance?:KitBalanceSnapshot;rosterId:RosterId;level:number;tree:Tree;pool:NormalSkillId[];board:BoardSkillId;slots:number;eligible:boolean}
const emptyTree=():Tree=>({three:0,four:0,five:0,slots:0,board:0,rewardHeal:0});
export function eligibleSkills(p:Profile,id:RosterId):NormalSkillId[]{return normalSkillIds.filter(skill=>(p.ownedSkills.includes(skill)||roster[id].starter===skill||LEGACY_STARTERS[id]===skill)&&skillCatalog[skill].rewardAccess!=='never'&&(skillCatalog[skill].rewardAccess!=='starter-upgrade-only'||roster[id].starter===skill));}
export function createProfile(seed=crypto.getRandomValues(new Uint32Array(1))[0]!):Profile {const p:Profile={treeVersion:2,schema:2,boardCatalogVersion:BOARD_CATALOG_VERSION,progressionVersion:2,revision:0,selected:'blue',coins:0,energy:0,ownedCharacters:['blue','red'],ownedSkills:[...starterInventory],characters:{} as Profile['characters'],trophies:{},receipts:{},launches:{},rng:seed>>>0,drawCount:0,pendingDraw:false,lastDraw:null};for(const id of rosterIds){p.characters[id]={xp:0,tree:emptyTree(),pool:[],board:roster[id].board};const list=eligibleSkills(p,id);p.characters[id].pool=[...list.filter(x=>x===roster[id].starter),...list.filter(x=>x!==roster[id].starter)].slice(0,META.poolMin);}return p;}
/** Growth terms are separate from kit balance. Legacy arithmetic remains immutable. */
export const PROGRESSION_VERSION=2 as const;
export const LEGACY_MAX_LEVEL=30;
export function treeRankCap(id:TreeId,level:number):number{return treeNodes[id].max+(['three','four','five','rewardHeal'].includes(id)?Math.floor(level/5):0);}
export function treePointCapacity(level:number):number{return (Object.keys(treeNodes) as TreeId[]).reduce((sum,id)=>sum+treeRankCap(id,level)*treeNodes[id].cost,0);}
export const TREE_POINT_CAPACITY=(Object.keys(treeNodes) as TreeId[]).reduce((sum,id)=>sum+treeNodes[id].max*treeNodes[id].cost,0);
function levelAt(xp:number,cap:number):{level:number;current:number;next:number;points:number}{if(!Number.isSafeInteger(xp)||xp<0)throw new Error('経験値が不正です');let level=1,current=xp;while(level<cap){const next=40+(level-1)*20;if(current<next)break;current-=next;level++;}return {level,current,next:level===cap?0:40+(level-1)*20,points:2+(level-1)*2};}
export const levelInfo=(xp:number)=>levelAt(xp,META.maxLevel);
export const legacyLevelInfo=(xp:number)=>levelAt(xp,LEGACY_MAX_LEVEL);
export function characterGrowth(c:CharacterProgress,schema:1|2=2){const growth=schema===1?legacyLevelInfo(c.xp):levelInfo(c.xp),level=Math.max(growth.level,c.legacyLevelFloor??1),points=Math.max(growth.points,c.legacyPointFloor??2),allocationBudget=Math.min(points,treePointCapacity(level)),spent=spentPoints(c.tree);return {...growth,level,points,allocationBudget,spent,allocatable:allocationBudget-spent,reserve:points-allocationBudget,growthAtCap:growth.next===0,treeComplete:spent===treePointCapacity(level),storedXp:c.xp};}
/** 日本語: 育成権利と旧盤面選択を一度だけ移行。経験値・通貨・精算・出発台帳は削らない。
 * English: Migrate entitlements and board selections once, preserving XP, currency and both ledgers. */
export function migrateProfile(p:Profile):Profile{
 validateProfile(p);if(p.schema===2&&p.boardCatalogVersion===BOARD_CATALOG_VERSION&&p.treeVersion===2&&!missingTrophySkills(p).length)return p;
 const n=structuredClone(p);
 n.ownedSkills.push(...missingTrophySkills(n));
 n.treeVersion=2;for(const id of rosterIds)n.characters[id].tree.rewardHeal??=0;
 if(p.schema===1){n.schema=2;n.progressionVersion=PROGRESSION_VERSION;for(const id of rosterIds){const old=legacyLevelInfo(n.characters[id].xp);n.characters[id].legacyLevelFloor=old.level;n.characters[id].legacyPointFloor=old.points;}}
 if(p.boardCatalogVersion!==BOARD_CATALOG_VERSION){n.boardCatalogVersion=BOARD_CATALOG_VERSION;for(const id of rosterIds){const c=n.characters[id];if(!characterBoardChoices(id,!!c.tree.board).includes(c.board))c.board=roster[id].board;}}
 validateProfile(n);return n;
}
export function gainCharacterXp(c:CharacterProgress,amount:number,legacyTerms=false):CharacterProgress{const xp=c.xp+amount;if(!Number.isSafeInteger(amount)||amount<0||!Number.isSafeInteger(xp))throw new Error('経験値の上限を超えるため保存していません');const n={...c,xp};if(legacyTerms){const old=legacyLevelInfo(xp);n.legacyLevelFloor=Math.max(c.legacyLevelFloor??1,old.level);n.legacyPointFloor=Math.max(c.legacyPointFloor??2,old.points);}return n;}
export function useXpEnergy(p:Profile,id:RosterId):Profile{const current=migrateProfile(p);if(!current.ownedCharacters.includes(id)||current.energy<1)throw new Error('使用できるエナジーがありません');if(characterGrowth(current.characters[id]).growthAtCap)throw new Error('このキャラは成長上限です。別のキャラに使用できます');const n=structuredClone(current);n.characters[id]=gainCharacterXp(n.characters[id],META.energyXp);n.energy--;return n;}

export function spentPoints(tree:Tree):number{return (Object.keys(treeNodes) as TreeId[]).reduce((n,id)=>n+(tree[id]??0)*treeNodes[id].cost,0);}
export function availableBoards(tree:Tree,id:RosterId):BoardSkillId[]{return characterBoardChoices(id,!!tree.board);}
export function validatePool(p:Profile,id:RosterId,pool:readonly NormalSkillId[]):void {const eligible=eligibleSkills(p,id);if(pool.length<META.poolMin||pool.length>META.poolMax||new Set(pool).size!==pool.length||pool.some(s=>!eligible.includes(s)))throw new Error('候補プールは所持・使用可能な6〜20種類を選んでください');}
export function freezeRunMeta(p:Profile,id:RosterId,eligible:boolean):RunMeta {if(!p.ownedCharacters.includes(id))throw new Error('このキャラは未所持です');const current=migrateProfile(p),c=current.characters[id];validatePool(current,id,c.pool);return structuredClone({version:1,balanceVersion:2,treeVersion:2,boardCatalogVersion:BOARD_CATALOG_VERSION,boardBalance:CURRENT_BOARD_BALANCE,progressionVersion:PROGRESSION_VERSION,kitVersion:KIT_VERSION,kitBalance:CURRENT_KIT_BALANCE,rosterId:id,level:characterGrowth(c).level,tree:c.tree,pool:c.pool,board:c.board,slots:2+c.tree.slots,eligible});}
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const nat=(n:unknown)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;
export function validateProfile(p:Profile):void {if(!record(p)||!record(p.characters)||(p.schema!==1&&p.schema!==2)||(p.boardCatalogVersion!==undefined&&p.boardCatalogVersion!==BOARD_CATALOG_VERSION)||(p.schema===1?p.progressionVersion!==undefined:p.progressionVersion!==PROGRESSION_VERSION)||(p.treeVersion!==undefined&&p.treeVersion!==2)||!nat(p.revision)||!isRosterId(p.selected)||!nat(p.coins)||!nat(p.energy)||!nat(p.rng)||p.rng>0xffffffff||!nat(p.drawCount)||typeof p.pendingDraw!=='boolean')throw new Error('成長データの形式を確認できません。元の保存は保持しています');if(!Array.isArray(p.ownedCharacters)||new Set(p.ownedCharacters).size!==p.ownedCharacters.length||p.ownedCharacters.some(id=>!isRosterId(id))||!p.ownedCharacters.includes(p.selected))throw new Error('キャラ所持データが不正です');if(!Array.isArray(p.ownedSkills)||new Set(p.ownedSkills).size!==p.ownedSkills.length||p.ownedSkills.some(id=>!normalSkillIds.includes(id)||['starter-upgrade-only','never'].includes(skillCatalog[id].rewardAccess??'shared')))throw new Error('スキル所持データが不正です');for(const id of rosterIds){const c=p.characters?.[id];if(!record(c)||!nat(c.xp)||!record(c.tree)||(Object.keys(treeNodes) as TreeId[]).some(n=>!(n==='rewardHeal'&&c.tree[n]===undefined)&&(!nat(c.tree[n])||(c.tree[n]??0)>(p.treeVersion===2?treeRankCap(n,characterGrowth(c,p.schema).level):treeNodes[n].max)))||spentPoints(c.tree)>characterGrowth(c,p.schema).points||!(p.boardCatalogVersion===BOARD_CATALOG_VERSION?availableBoards(c.tree,id):legacyBoardChoices(id,!!c.tree.board)).includes(c.board))throw new Error('キャラ成長データが不正です');const floor=c.legacyLevelFloor,points=c.legacyPointFloor;if(p.schema===1&&(floor!==undefined||points!==undefined)||p.schema===2&&((floor===undefined)!==(points===undefined)||floor!==undefined&&(!nat(floor)||floor<1||floor>LEGACY_MAX_LEVEL||!nat(points)||points!==2+(floor-1)*2||floor>legacyLevelInfo(c.xp).level)))throw new Error('保持した育成記録が不正です');validatePool(p,id,c.pool);}if(!record(p.receipts)||!record(p.launches)||!record(p.trophies)||Object.values(p.trophies).some(n=>!nat(n)))throw new Error('精算履歴が不正です');
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
export function drawGacha(p:Profile):Profile {if(p.pendingDraw)throw new Error('先に前回のガチャ結果を確認してください');if(p.coins<META.gachaCost)throw new Error(`コインが${META.gachaCost}枚必要です`);const n=structuredClone(p);let r=sampleUniformIndex(n.rng,100);n.rng=r.rngState;n.coins-=META.gachaCost;const result:DrawResult={id:++n.drawCount,kind:'energy',item:'経験値エナジー ×2',duplicate:false,coins:0,energy:0};if(r.index<META.characterRate){const candidates=characterDrawPool(n);r=sampleUniformIndex(n.rng,candidates.length);n.rng=r.rngState;const id=candidates[r.index]!;result.kind='character';result.item=id;result.duplicate=n.ownedCharacters.includes(id);if(result.duplicate){result.energy=META.duplicateCharacterEnergy;n.energy+=result.energy;}else {n.ownedCharacters.push(id);if(n.characters[id].board===LEGACY_BOARDS[id])n.characters[id].board=roster[id].board;}}else if(r.index<META.characterRate+META.skillRate){const candidates=normalSkillIds.filter(id=>!['starter-upgrade-only','never','trophy'].includes(skillCatalog[id].rewardAccess??'shared'));r=sampleUniformIndex(n.rng,candidates.length);n.rng=r.rngState;const id=candidates[r.index]!;result.kind='skill';result.item=id;result.duplicate=n.ownedSkills.includes(id);if(result.duplicate){result.coins=META.duplicateSkillCoins;n.coins+=result.coins;}else n.ownedSkills.push(id);}else{result.energy=2;n.energy+=2;}n.lastDraw=result;n.pendingDraw=true;return n;}
/** 日本語: 残高・抽選結果・精算台帳は一つの書込みで確定。ラン保存とは独立。
 * English: One durable value commits balance + draw/settlement atomically; the run save is separate. */
export class ProfileStore {private raw:string|null|undefined;private value:Profile|null=null;private attempted:string|null=null;readonly key:string;private storage:SaveStorage;private owned:()=>boolean;constructor(storage:SaveStorage,owned:()=>boolean,pathname='/next/'){this.storage=storage;this.owned=owned;this.key=saveNamespace(pathname).key.replace('autosave.v1','profile.v1');}
 read():Profile{if(!this.owned())throw new Error('保存の操作権がありません');this.raw=this.storage.getItem(this.key);if(this.raw===null){this.value=createProfile();return this.write(this.value);}let p:Profile;try{p=JSON.parse(this.raw);}catch{throw new Error('成長データを読めません。保存は消去していません');}validateProfile(p);this.value=p;
  if(p.schema===1||p.boardCatalogVersion!==BOARD_CATALOG_VERSION||p.treeVersion!==2||missingTrophySkills(p).length){this.guard();
   // 日本語: 両移行とも元の生データを検証付きで退避し、既存ランの出発文字列は変えない。
   // English: Back up the exact source bytes before either migration; launch snapshot strings stay intact.
   for(const suffix of [...(p.schema===1?['.before-growth-v2']:[]),...(p.boardCatalogVersion!==BOARD_CATALOG_VERSION?['.before-board-catalog-v2']:[]),...(p.treeVersion!==2?['.before-tree-v2']:[])]){const backup=this.key+suffix;this.storage.setItem(backup,this.raw!);if(this.storage.getItem(backup)!==this.raw)throw new Error('成長データの退避を確認できません。元の保存を保持しています');}
   return this.write(migrateProfile(p));
  }return structuredClone(p);}
 get current():Profile{if(!this.value)throw new Error('成長データ未読込');return structuredClone(this.value);}
 guard():void{if(!this.owned()||this.raw===undefined)throw new Error('成長データの操作権がありません');const raw=this.storage.getItem(this.key);if(raw!==this.raw){if(this.attempted&&raw===this.attempted){const p=JSON.parse(raw) as Profile;validateProfile(p);this.value=p;this.raw=raw;this.attempted=null;}else throw new Error('別の操作で成長データが変わりました。ページを開き直してください');}}
 write(profile:Profile):Profile{this.guard();const next=structuredClone(migrateProfile(profile));next.revision=(this.value?.revision??0)+1;validateProfile(next);const raw=JSON.stringify(next);if(raw.length>2_000_000)throw new Error('成長データの保存容量に達しました');this.attempted=raw;this.storage.setItem(this.key,raw);if(this.storage.getItem(this.key)!==raw)throw new Error('成長データを保存できません。操作を止めました');this.raw=raw;this.attempted=null;this.value=next;return structuredClone(next);}
 update(fn:(p:Profile)=>Profile):Profile{this.guard();const current=this.current,before=JSON.stringify(current),next=fn(current);return JSON.stringify(next)===before?current:this.write(next);}
 settle(cp:RunCheckpoint):Receipt|null{this.guard();const p=this.current;const next=settleProfile(p,cp);if(next!==p)this.write(next);return this.current.receipts[cp.runId]??null;}
 register(cp:RunCheckpoint):void{if(!cp.initialConfig.meta?.eligible)return;this.update(p=>{p.launches[cp.runId]={character:cp.initialConfig.meta!.rosterId,snapshot:JSON.stringify(cp.initialConfig.meta)};return p;});}
}
