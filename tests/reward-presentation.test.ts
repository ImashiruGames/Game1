import test from 'node:test';
import assert from 'node:assert/strict';
import { rewardCardView, rewardPanelHtml, rewardShapeHtml } from '../src/next/ui/rewardPresentation.ts';
import { createBattle } from '../src/next/core/battle.ts';
import { createTrialConfig } from '../src/next/config.ts';
import {rewardSlotToken} from '../src/next/ui/rewardInteraction.ts';
import { createSkill } from '../src/next/core/playerBuild.ts';
import { plusPattern, cornerPattern, squarePattern } from '../src/next/core/shapePatterns.ts';
import type { BattleState } from '../src/next/core/types.ts';
const initial=createBattle(createTrialConfig());
const state:BattleState={...initial,hp:{...initial.hp,player:{current:18,max:60}}};
const ui={selected:null,replacing:false,replacementSlot:null};
test('HP uses +5 tuning and presents current and max separately',()=>{
 const view=rewardCardView(state,'max-health');
 assert.equal(view.metric,'+5');
 assert.deepEqual(view.comparison,[{label:'現在HP',before:'18',after:'23'},{label:'最大HP',before:'60',after:'65'}]);
});
test('read-only presenter never changes RNG, offers, HP or build',()=>{
 const before=JSON.stringify(state),offer={id:'r1',category:'stats' as const,choices:['max-health','three-polish','five-polish'] as const},o=JSON.stringify(offer);
 rewardPanelHtml(state,offer,{...ui,selected:'max-health'});
 assert.equal(JSON.stringify(state),before);assert.equal(JSON.stringify(offer),o);
});
test('pending categories are irrevocable commit buttons, have no reward confirm or skip',()=>{
 const html=rewardPanelHtml(state,{id:'r1',category:'pending',choices:[]},ui);
 assert.equal((html.match(/data-category=/g)||[]).length,3);
 assert(!html.includes('data-reward-confirm'));assert(!html.includes('data-reward-skip'));
 assert(html.includes('押すと回復して次へ'));assert(html.includes('あとから変更できません'));
});
test('offers start unarmed, with confirmation integrated into the selected target',()=>{
 const html=rewardPanelHtml(state,{id:'r1',category:'stats',choices:['max-health','three-polish','five-polish']},ui);
 assert.equal((html.match(/data-reward-preview=/g)||[]).length,3);
 assert.doesNotMatch(html,/data-reward-confirm|data-reward-repeat="true"/);
 assert(html.includes('選択 → 同じ場所でもう一度'));
});
test('all controls carry both the rendered offer and category token',()=>{
 const html=rewardPanelHtml(state,{id:'r1',category:'stats',choices:['max-health']},{...ui,selected:'max-health'});
 const buttons=[...html.matchAll(/<button[^>]+>/g)].map(m=>m[0]);
 assert(buttons.length>0);assert(buttons.every(b=>b.includes('data-offer-id="r1"')&&b.includes('data-offer-category="stats"')));
});
test('next fight permanent preview excludes stage-local Grow Fire growth',()=>{
 const grown={...state,link3Growth:17};
 assert.deepEqual(rewardCardView(grown,'three-polish').comparison,rewardCardView(state,'three-polish').comparison);
 assert(rewardCardView(grown,'three-polish').detail.includes('戦闘中の成長分は含みません'));
});
test('exact catalog shape diagrams contain 5,3,4 filled cells and future orientation hook',()=>{
 for(const [pattern,cells] of [[plusPattern,5],[cornerPattern,3],[squarePattern,4]] as const){
  const html=rewardShapeHtml(pattern);assert.equal((html.match(/class="filled"/g)||[]).length,cells);assert(html.includes('回転可'));
 }
 assert(rewardShapeHtml({...cornerPattern,fixedOrientation:true}).includes('天地無用'));
});
test('duplicate fixed Health correctly previews rank 2 in same slot',()=>{
 const view=rewardCardView(state,'health');assert.equal(view.metric,'HP 20');assert(view.upgrade);assert.equal(view.placement,'固定枠で＋強化 · 枠はそのまま');assert.deepEqual(view.comparison,[{label:'回復量',before:'15',after:'20'}]);
});
test('replacement choices are only free slots and confirm waits for valid slot',()=>{
 const full:BattleState={...state,build:{...state.build!,slots:[createSkill('horizontal-slash'),createSkill('charge')]}};
 const html=rewardPanelHtml(full,{id:'r2',category:'skills',choices:['square-strike']},{...ui,selected:'square-strike',replacing:true});
 assert.equal((html.match(/data-replace-preview=/g)||[]).length,2);assert.doesNotMatch(html,/data-reward-confirm|data-reward-repeat="true"/);assert(html.includes('固定枠は入れ替えられません'));
 const chosen=rewardPanelHtml(full,{id:'r2',category:'skills',choices:['square-strike']},{...ui,selected:'square-strike',replacing:true,replacementSlot:1,replacementToken:rewardSlotToken(full.build!,1)});
 assert.match(chosen,/data-replace-preview="1" data-reward-repeat="true"/);assert(chosen.includes('蓄勢 → 四角打ち'));
});
test('stale selected ID cannot create an active confirmation',()=>{
 const html=rewardPanelHtml(state,{id:'r1',category:'stats',choices:['three-polish']},{...ui,selected:'max-health'});
 assert.doesNotMatch(html,/data-reward-confirm|data-reward-repeat="true"/);
});
test('instant reward cards state one use and one action',()=>{
 for(const id of ['healing-potion','magic-bullet'] as const)assert.equal(rewardCardView(state,id).effect,'1回限り · 1手消費');
});
test('stale replacing flag cannot show replacement for fixed-slot upgrade',()=>{
 const html=rewardPanelHtml(state,{id:'r1',category:'skills',choices:['health']},{...ui,selected:'health',replacing:true,replacementSlot:0});
 assert(!html.includes('class="reward-replacement '));assert(html.includes('固定枠で＋強化'));
});
test('invalid replacement indexes never throw and keep confirm disabled',()=>{
 const full:BattleState={...state,build:{...state.build!,slots:[createSkill('horizontal-slash'),createSkill('charge')]}};
 for(const replacementSlot of [-1,2,NaN]){
  const html=rewardPanelHtml(full,{id:'r2',category:'skills',choices:['square-strike']},{...ui,selected:'square-strike',replacing:true,replacementSlot});
  assert.doesNotMatch(html,/data-reward-confirm|data-reward-repeat="true"/);assert(html.includes('固定枠は入れ替えられません'));
 }
});
test('permanent link tier emblems visibly distinguish 3, 4, and 5+',()=>{
 for(const [id,tier] of [['three-polish',3],['four-polish',4],['five-polish',5]] as const){
  assert.equal(rewardCardView(state,id).powerTier,tier);
  const html=rewardPanelHtml(state,{id:'r1',category:'stats',choices:[id]},ui);
  assert(html.includes(`${tier}個の連結箱`));assert(html.includes(tier===5?'<b>5+</b>':`<b>${tier}</b>`));
 }
});
