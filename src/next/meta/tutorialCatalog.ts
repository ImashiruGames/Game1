import type {Profile} from './profile.ts';
export const tutorialCatalog=[
 {id:'basic',title:'ゲームの遊び方1(基本)',coins:100,receipt:'tutorial-v1'},
 {id:'tree',title:'スキルツリーを育てよう！',coins:100,receipt:'tutorial-tree-v1'},
] as const;
export type TutorialId=typeof tutorialCatalog[number]['id'];
export function tutorialCompleted(p:Profile,id:TutorialId):boolean{return id==='basic'?!!p.receipts['tutorial-v1']?.clear:!!p.treeTutorial?.completed;}
// 日本語: 完了と報酬台帳・残高を同じプロフィール書込みで確定。旧ツリー完了者にも一度だけ付与。
// English: Commit completion, receipt and balance in one profile write; previously completed tree guides receive the new reward once.
export function awardCompletedTutorials(p:Profile):void{
 for(const t of tutorialCatalog){if(!tutorialCompleted(p,t.id)||p.receipts[t.receipt])continue;p.coins+=t.coins;p.receipts[t.receipt]={runId:t.receipt,character:'blue',xp:0,coins:t.coins,defeated:0,at:Date.now(),clear:true,trophies:[]};}
}
export function completeBasicTutorial(p:Profile):void{
 const t=tutorialCatalog[0];if(p.receipts[t.receipt])return;
 p.coins+=t.coins;p.receipts[t.receipt]={runId:t.receipt,character:'blue',xp:0,coins:t.coins,defeated:0,at:Date.now(),clear:true,trophies:[]};
}
export function tutorialListHtml(p:Profile):string{return `<div class="tutorial-list">${tutorialCatalog.map(t=>`<button class="tutorial-entry" data-tutorial-id="${t.id}"><span><strong>${t.title}</strong><small>${t.coins}コイン</small></span>${tutorialCompleted(p,t.id)?'<b class="tutorial-stamp">達成！</b>':''}</button>`).join('')}</div>`;}
