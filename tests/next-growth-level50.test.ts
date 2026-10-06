import test from 'node:test';
import assert from 'node:assert/strict';
import {createProfile,levelInfo,treeRankCap,characterGrowth,changeTreeRank,freezeRunMeta,useXpEnergy} from '../src/next/meta/profile.ts';
import {nextTreeCost,paidTreePoints} from '../src/next/meta/treePricing.ts';
import {prepareDeparture} from '../src/next/meta/departure.ts';
import {BattleController} from '../src/next/app/BattleController.ts';
import {encodeSave,decodeSave} from '../src/next/app/saveCheckpoint.ts';

test('level 50 extends every current XP threshold and retains excess XP',()=>{
 for(let level=1;level<=50;level++){
  const xp=10*(level-1)*(level+2),g=levelInfo(xp);
  assert.equal(g.level,level);assert.equal(g.points,2*level);
  if(level>1)assert.equal(levelInfo(xp-1).level,level-1);
  assert.equal(g.next,level===50?0:40+(level-1)*20);
 }
 assert.equal(levelInfo(25480+123).current,123);
 assert.equal(treeRankCap('three',50),15);
 assert.equal(treeRankCap('rewardHeal',50),15);
 assert.equal(treeRankCap('slots',50),2);assert.equal(treeRankCap('board',50),3);
});
test('new power and recovery ranks cost 1,1,2,2 while other categories retain their prices',()=>{
 for(const id of ['three','four','five','rewardHeal'] as const)assert.deepEqual(Array.from({length:8},(_,r)=>nextTreeCost(id,r)),[1,1,2,2,3,3,4,4]);

 assert.equal(nextTreeCost('slots',0),3);assert.equal(nextTreeCost('board',0),3);
 const p=createProfile(1),c=p.characters.blue;c.xp=25480;
 for(let r=0;r<15;r++)changeTreeRank(c,'three',1);
 assert.equal(characterGrowth(c).spent,64);assert.equal(characterGrowth(c).allocatable,36);
 assert.throws(()=>changeTreeRank(c,'three',1));
 for(let r=0;r<15;r++)changeTreeRank(c,'three',-1);
 assert.equal(paidTreePoints(c.tree,2),0);assert.equal(characterGrowth(c).allocatable,100);
});
test('level 50 departure survives checkpoint encode and restore; energy stops at the new cap',()=>{
 const p=createProfile(1);p.characters.blue.xp=25460;p.energy=2;
 const n=useXpEnergy(p,'blue');assert.equal(n.characters.blue.xp,25510);assert.equal(n.energy,1);assert.throws(()=>useXpEnergy(n,'blue'));
 const setup=prepareDeparture(freezeRunMeta(n,'blue',true),7),view={render(){},async animate(){}};
 const original=new BattleController(setup.config,view,setup.options);
 const restored=BattleController.restore(decodeSave(encodeSave(original.exportCheckpoint(),1)).checkpoint,view);
 assert.deepEqual(restored.snapshot.config.meta,original.snapshot.config.meta);
 assert.equal(restored.snapshot.config.meta!.level,50);
});

test('recovery purchases enforce escalating affordability, refund paid new ranks and retain five-level caps',()=>{
 const p=createProfile(1),c=p.characters.blue;c.xp=100;
 for(let r=0;r<4;r++)changeTreeRank(c,'rewardHeal',1);
 assert.equal(characterGrowth(c).spent,6);assert.equal(characterGrowth(c).allocatable,0);
 assert.throws(()=>changeTreeRank(c,'rewardHeal',1));
 changeTreeRank(c,'rewardHeal',-1);assert.equal(characterGrowth(c).allocatable,2);
 changeTreeRank(c,'rewardHeal',1);assert.equal(characterGrowth(c).allocatable,0);
 c.xp=25480;
 for(let r=4;r<15;r++)changeTreeRank(c,'rewardHeal',1);
 assert.equal(characterGrowth(c).spent,64);assert.equal(characterGrowth(c).allocatable,36);
 assert.throws(()=>changeTreeRank(c,'rewardHeal',1));
 for(let r=15;r>0;r--)changeTreeRank(c,'rewardHeal',-1);
 assert.equal(characterGrowth(c).allocatable,100);
});

import {validateProfile,availableBoards,treeRefund} from '../src/next/meta/profile.ts';
import {rosterIds} from '../src/next/meta/roster.ts';
import {boardUnlockStages} from '../src/next/meta/boardUnlockStages.ts';
test('every board unlock advances exactly one existing stage at 3,10,25 and refunds the last price',()=>{
 for(const id of rosterIds){const p=createProfile(1);p.ownedCharacters=[...rosterIds];const c=p.characters[id];c.xp=25480;const stages=boardUnlockStages(id).filter(s=>s.skill);let spent=0;
  for(const stage of stages){assert(!availableBoards(c.tree,id).includes(stage.skill!));changeTreeRank(c,'board',1,id);spent+=stage.cost;assert.equal(characterGrowth(c).spent,spent);assert.equal(availableBoards(c.tree,id).length,stage.rank+1);c.board=stage.skill!;validateProfile(p);assert.equal(treeRefund(c,'board'),stage.cost);}
  assert.throws(()=>changeTreeRank(c,'board',1,id));
  for(const stage of [...stages].reverse()){changeTreeRank(c,'board',-1,id);spent-=stage.cost;assert.equal(characterGrowth(c).spent,spent);assert(!availableBoards(c.tree,id).includes(stage.skill!));c.board=availableBoards(c.tree,id)[0]!;validateProfile(p);}
  assert.equal(characterGrowth(c).allocatable,100);
 }
 const p=createProfile(1);p.characters.blue.xp=100;changeTreeRank(p.characters.blue,'board',1,'blue');assert.throws(()=>changeTreeRank(p.characters.blue,'board',1,'blue'));assert.equal(p.characters.blue.tree.board,1);
});
