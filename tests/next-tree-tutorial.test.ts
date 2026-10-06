import test from 'node:test';import assert from 'node:assert/strict';
import {createProfile,ProfileStore,validateProfile,changeTreeRank} from '../src/next/meta/profile.ts';
import {treeTutorialView,advanceTreeTutorial,validTreeTutorial} from '../src/next/meta/treeTutorial.ts';
import {treeGuidePlacement} from '../src/next/meta/treeTutorialPlacement.ts';
import {boardUnlockStages,boardUnlockCost,sequentialBoardChoices} from '../src/next/meta/boardUnlockStages.ts';
import {rosterIds} from '../src/next/meta/roster.ts';

test('tree guide uses actual recovery and slot values for fresh, upgraded, capped and unowned characters',()=>{
 const p=createProfile(1);assert(!p.ownedCharacters.includes('imashiru'));
 p.treeTutorial={step:5,completed:false};assert.match(treeTutorialView(p,'blue').text,/10回復/);
 p.treeTutorial.step=6;assert(treeTutorialView(p,'blue').canBuy);
 changeTreeRank(p.characters.blue,'rewardHeal',1);p.treeTutorial={step:7,completed:false,healBefore:10,healAfter:12};assert.match(treeTutorialView(p,'blue').text,/12回復/);
 changeTreeRank(p.characters.blue,'rewardHeal',-1);assert.match(treeTutorialView(p,'blue').text,/今は10回復/);
 p.characters.blue.xp=25480;p.characters.blue.tree.rewardHeal=15;p.treeTutorial={step:6,completed:false};assert(!treeTutorialView(p,'blue').canBuy);assert(!treeTutorialView(p,'imashiru').canBuy);
 p.treeTutorial.step=5;assert.match(treeTutorialView(p,'blue').text,/40回復/);
 for(const rank of [0,1,2]){p.characters.blue.tree.slots=rank;p.treeTutorial.step=12;assert.match(treeTutorialView(p,'blue').text,new RegExp(`合計${3+rank}`));p.treeTutorial.step=13;assert.match(treeTutorialView(p,'blue').text,new RegExp(`${Math.min(5,4+rank)}つ`));}
});
test('guide progress persists without a completed flag until the final acknowledged line; stale double taps do not advance',()=>{
 const data=new Map<string,string>(),storage={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);}};
 let store=new ProfileStore(storage,()=>true);store.read();
 for(let step=0;step<22;step++){
  store.update(p=>{assert(advanceTreeTutorial(p,step));assert(!advanceTreeTutorial(p,step));return p;});
  store=new ProfileStore(storage,()=>true);const restored=store.read();assert.equal(restored.treeTutorial!.completed,step===21);assert.equal(restored.treeTutorial!.step,Math.min(21,step+1));validateProfile(restored);
 }
 const p=store.current;p.treeTutorial={step:1,completed:true};assert.throws(()=>validateProfile(p));assert(!validTreeTutorial({step:NaN,completed:false}));
});
test('speech chooses the free side and a minimal scroll correction on small and scrolled viewports',()=>{
 for(const height of [320,568,667,844])for(const offset of [0,40])for(const targetTop of [offset+15,offset+height/2,offset+height-55]){
  const view={top:offset,bottom:offset+height,height},target={top:targetTop,bottom:targetTop+44,height:44};
  const result=treeGuidePlacement(view,target,150),moved={top:target.top-result.scrollBy,bottom:target.bottom-result.scrollBy};
  assert(result.y>=view.top);assert(result.y+150<=view.bottom);
  assert(moved.bottom<=result.y-12||moved.top>=result.y+150+12);
 }
});
test('board stages only reference existing per-character skills and charge 3,10,25 individually',()=>{
 assert.deepEqual([0,1,2].map(boardUnlockCost),[3,10,25]);assert.throws(()=>boardUnlockCost(3));
 for(const id of rosterIds){const stages=boardUnlockStages(id);assert.equal(stages.filter(s=>s.skill).length,['blue','red','imashiru'].includes(id)?3:2);assert.equal(sequentialBoardChoices(id,0).length,1);for(let r=1;r<=3;r++)assert.deepEqual(sequentialBoardChoices(id,r).slice(0,sequentialBoardChoices(id,r-1).length),sequentialBoardChoices(id,r-1));}
});
