import type {Profile,TreeId} from './profile.ts';
import {characterGrowth,treeRankCap,REWARD_HEAL_PER_RANK} from './profile.ts';
import type {RosterId} from './roster.ts';
import {trialTuning} from '../config.ts';
import {nextTreeCost} from './treePricing.ts';

export interface TreeTutorialProgress {step:number;completed:boolean;healBefore?:number;healAfter?:number}
export const TREE_TUTORIAL_STEPS=22;
export function validTreeTutorial(value:unknown):boolean{
 if(value===undefined)return true;
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const v=value as TreeTutorialProgress;
 return Number.isInteger(v.step)&&v.step>=0&&v.step<TREE_TUTORIAL_STEPS&&typeof v.completed==='boolean'&&(!v.completed||v.step===TREE_TUTORIAL_STEPS-1)
 &&((v.healBefore===undefined&&v.healAfter===undefined)||(Number.isSafeInteger(v.healBefore)&&v.healBefore!>=0&&v.healAfter===v.healBefore!+REWARD_HEAL_PER_RANK));
}
// 日本語: ユーザー指定の案内は実値を優先。既育成・不足・上限でも購入を強制せず、保存済みの進行から再開する。
// English: Adapt the requested dialogue to real values. Never force a purchase at a cap or without points; resume saved progress.
export function treeTutorialView(p:Profile,id:RosterId){
 const c=p.characters[id],progress=p.treeTutorial??{step:0,completed:false},rank=c.tree.rewardHeal??0;
 const current=trialTuning.rewards.immediateHeal+rank*REWARD_HEAL_PER_RANK;
 const canBuy=p.ownedCharacters.includes(id)&&rank<treeRankCap('rewardHeal',characterGrowth(c).level)&&characterGrowth(c).allocatable>=nextTreeCost('rewardHeal',rank);
 const slots=3+c.tree.slots;
 const text=[
 'ここはスキルツリーだよ。',
 'ここではツリーポイントを使って、ゲームを強い状態から始めることができるんだ',
 'まずはここ！報酬の即時回復！',
 '敵を倒した後回復したくなった時あるでしょ',
 'そんな時は即時回復を使うこともあると思うんだけど',
 rank===0?`最初の設定では${current}回復することになってるの`:`今の強化では${current}回復することになってるの`,
 canBuy?`でもここをぽちっと押せば（${nextTreeCost('rewardHeal',rank)}pt使うよ）`:'今はポイント不足・強化上限・未所持のどれかで強化できないから、説明だけでも進めるよ',
 progress.healAfter!==undefined&&progress.healAfter===current?`回復量が${REWARD_HEAL_PER_RANK}プラスされて、${progress.healAfter}回復になるんだ！`:`1段階で回復量が${REWARD_HEAL_PER_RANK}プラスされるんだ！今は${current}回復だよ。実際の回復は最大HPまでだよ`,
 '次はここ！',
 'リンクパワーの初期値を上げることができるよ',
 '最初から強い攻撃で敵をなぎ倒そう',
 'その下は、スキル枠+1だね',
 slots===3?'スキルは、キャラごとの固有スキルを合わせて合計3つまで装備できるんだけど':`今はキャラごとの固有スキルを合わせて合計${slots}つまで装備できるよ`,
 slots<5?`それを${slots+1}つまで装備できるようにしたりできるよ！`:'すでに最大の合計5つまで装備できる状態だよ！',
 '強力な分、必要なツリーポイントは1段階3ptだから気をつけてね',
 '最後にここ！',
 'キャラには盤面スキルがあるんだったね',
 '盤面を変化させて自分に有利にしたりする強力なスキルだけど',
 '新しい盤面スキルを解放するために必要なんだ！',
 'たくさんポイントを消費することになるけど、その分強い盤面スキルが使えるようになるよ',
 '軽く説明したけどこんな感じかな！自由にツリーポイントを割り振って強化して…ステージ攻略を目指そうね⭐︎',
 'イマシルちゃんでした〜',
 ][progress.step]!;
 const target:TreeId=progress.step<=7?'rewardHeal':progress.step<=10?'three':progress.step<=14?'slots':'board';
 return {step:progress.step,text,target,canBuy,expectPurchase:progress.step===6,last:progress.step===TREE_TUTORIAL_STEPS-1,current};
}
export function advanceTreeTutorial(p:Profile,expectedStep:number):boolean{
 const v=p.treeTutorial??{step:0,completed:false};if(v.completed||v.step!==expectedStep)return false;
 p.treeTutorial={...v,step:Math.min(TREE_TUTORIAL_STEPS-1,v.step+1),completed:v.step===TREE_TUTORIAL_STEPS-1};return true;
}
