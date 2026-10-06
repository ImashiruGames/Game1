import test from 'node:test';
import assert from 'node:assert/strict';
import {attackParticleFrames} from '../src/next/ui/energyLinks.ts';
import {feedbackPosition} from '../src/next/ui/battleFeedback.ts';
import {readFileSync} from 'node:fs';

test('1.13.0 launch and impact endpoints remain exact; only the extra arc lift is one third',()=>{
 for(const start of [{x:40,y:500},{x:210,y:280}])for(const target of [{x:55,y:45},{x:340,y:55}]){
  const frames=attackParticleFrames(start,target),midY=start.y+(target.y-start.y)*.5-12/3;
  assert.equal(frames[0]!.transform,`translate(${start.x}px,${start.y}px)`);
  assert.equal(frames[1]!.transform,`translate(${start.x+(target.x-start.x)*.35}px,${midY}px)`);
  assert.equal(frames[2]!.transform,`translate(${target.x}px,${target.y}px)`);
  assert.equal(frames[1]!.offset,.4);
  // Frozen 1.13.0 path: only its extra -12px arc offset changes to -4px.
  const oldMidY=start.y+(target.y-start.y)*.5-12;assert.equal(midY-oldMidY,8);
 }
});
test('downward paths retain their destination and labels stay within board bounds with at most one-third rise',()=>{
 assert.equal(attackParticleFrames({x:20,y:40},{x:30,y:200})[2]!.transform,'translate(30px,200px)');
 for(const top of [0,50,100,360]){const p=feedbackPosition({width:390,height:410},[{left:140,right:180,top,bottom:top+40}],{width:140,height:60},'player');assert(p.rise>=0&&p.rise<=10/3);assert(p.y-60-p.rise>=6);}
 assert.equal(feedbackPosition({width:390,height:410},[{left:140,right:180,top:200,bottom:240}],{width:140,height:60},'player').rise,10/3);
 assert.match(readFileSync(new URL('../src/next/ui/boxVanish.css',import.meta.url),'utf8'),/translateY\(calc\(-5px \/ 3\)\)/);
});

import {createEnergyLinks} from '../src/next/ui/energyLinks.ts';
import {createBattle,applyAction} from '../src/next/core/index.ts';
import {energyReviewFixture} from '../src/next/ui/energyReviewFixture.ts';
import {captureAnimationMotion} from '../src/next/ui/animationTimeline.ts';
import {boardSkillDom} from './helpers/boardSkillDom.ts';
import type {KineticNode} from './helpers/kineticDom.ts';
test('real player and enemy particles finish at the target image center at the original impact time',()=>{
 for(const kind of ['axes','enemy'] as const)for(const speed of ['slow','medium'] as const){
  const dom=boardSkillDom();try{
   dom.root.rect={left:0,top:0,width:390,height:600};
   const before=createBattle(energyReviewFixture(kind).config),r=applyAction(before,kind==='enemy'?{type:'enemy'}:{type:'drop',candidateId:'ceiling:2:0'}),shown={...before,boxes:r.state.boxes};
   for(const b of shown.boxes){const cell=dom.cell(b.row,b.col);cell.classList.add(b.owner);cell.dataset.boxId=b.id;}
   const event=r.resolution!.events.find(e=>e.type==='attack')!;assert(event.type==='attack');
   const target=event.target==='enemy'?dom.enemy:dom.player,point={x:target.rect.left+target.rect.width/2,y:target.rect.top+target.rect.height/2};
   const ui=createEnergyLinks(dom.root.asElement()),motion=captureAnimationMotion({speed,short:false,lowMotion:false});
   assert(ui.play(event,r.resolution!.links,shown,new AbortController().signal,motion));
   const particles=dom.root.querySelector<KineticNode>('.energy-link-layer')!.children.filter(n=>n.className==='energy-attack-particle');assert(particles.length>0);
   for(const particle of particles){const a=particle.animations[0]!;assert.equal(a.frames.at(-1)!.transform,`translate(${point.x}px,${point.y}px)`);assert.equal(Number(a.options.delay)+Number(a.options.duration),speed==='slow'?450:300);}
   ui.impact(event);assert(particles.every(p=>!p.isConnected));ui.dispose();
  }finally{dom.restore();}
 }
});
