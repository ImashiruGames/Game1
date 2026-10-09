import {recordSkillActivation} from './skillActivationRecord.ts';
import {revisedCharacters,protectedDamage,poisonRandomEnemy} from './characterRevision.ts';
import {sampleUniformIndex} from './random.ts';
import {enemyLinkPower} from './enemyPower.ts';
import {devilmonFourLink, deepTraits } from './monsterBehavior.ts';
import {normalLinkBonus,normalLinkGuard} from './normalSkillEffects.ts';
import {kitBalanceOf} from '../meta/kitBalance.ts';
import {absorbBarrier} from './kitBoards.ts';
import {frozenLinkAmount,thawFrozenLink,resolveThornInsertion} from './boxTypes.ts';
import {shinyAmount} from './shiny.ts';
import { tuningOf } from './tuning.ts';
import { damageHp } from './combatEffects.ts';
import { applyDamageEffect, applyHealingEffect } from './effectDispatcher.ts';
import { gainGauge, linkGaugeGain } from './gauge.ts';
import { calculateLinks } from './links.ts';
import { findPlusShapes } from './skills.ts';
import { activeSkillValue, buildSkills, playerPower, skillRank } from './playerBuild.ts';
import { skillCatalog, skillValue } from './skillCatalog.ts';
import { matchShape } from './shapePatterns.ts';
import { tryTransformation } from './transformations.ts';
import type { BattleEvent, BattleState, BattleTransition, Box, DropOption, Link } from './types.ts';

export interface ActiveDropTransition extends BattleTransition { readonly originBoxId: string; readonly links: readonly Link[]; readonly firstGuardUsed: boolean }
/** 日本語: 通常投入と追加投入で共有する能動処理。手番はここで進めない。
 * English: A reusable active insertion has its own origin/snapshot and never spends a turn. */
export function resolveActiveDrop(initial: BattleState, option: DropOption, firstGuardUsed = false, enemyBoxType?: 'thorn' | 'shiny'): ActiveDropTransition {
  if (!option.available || !option.landing) throw new Error('Active insertion requires a legal ceiling');
  let nextBoxId = initial.nextBoxId;
  while (initial.boxes.some(box => box.id === `drop:${nextBoxId}`)) nextBoxId += 1;
  const box: Box = { id: `drop:${nextBoxId}`, ...option.landing, owner: initial.actor, type:initial.actor==='player'&&(initial.shinyNextDrop||initial.transformation?.character==='imashiru'||revisedCharacters(initial.config)&&initial.transformation?.character==='mint')?'shiny':initial.actor==='enemy'?(enemyBoxType??'normal'):'normal',status:'normal' };
  let state: BattleState = { ...initial, nextBoxId: nextBoxId + 1, boxes: [...initial.boxes, box],...(initial.actor==='player'&&initial.shinyNextDrop?{shinyNextDrop:false}:{}) };
  const links = calculateLinks(state.config.board, state.boxes, box.id);
  const skills = buildSkills(state);
  const events: BattleEvent[] = [{ type: 'drop', actor: state.actor, box, candidateId: option.id, spawn: option.spawn, landing: option.landing, path: option.path }];
  const accept = (step: BattleTransition) => { state = step.state; events.push(...step.events); };
  accept(resolveThornInsertion(state,box));
  if (state.actor === 'player' && state.hp.player.current > 0) {
    // Snapshot matching skills in slot order; each identity activates only once for this origin.
    const shapes = skills.filter(skill => skillCatalog[skill.id].kind === 'shape').map(skill => ({ skill,
      ids: skill.id === 'health' ? findPlusShapes(state.config.board, state.boxes, box.id)[0]?.boxIds
        : matchShape(state.config.board, state.boxes, box.id, skillCatalog[skill.id].pattern!)[0] }));
    for (const { skill, ids } of shapes) if (ids && state.hp.player.current > 0) {
      if (skill.id === 'health' || skill.id === 'rescue-kit') accept(applyHealingEffect(state, 'player', shinyAmount(state,ids,skillValue(skill.id, skill.rank, tuningOf(state.config))), skill.id, ids));
      else if(skill.id==='combo-unit'){accept(applyDamageEffect(state,'enemy',shinyAmount(state,ids,playerPower(state,4)),'combo-unit',ids));state={...state,comboActivated:true};}
      else if(skill.id==='cross-strike'&&tuningOf(state.config).skillRevision===2&&state.build){
        // 日本語: X形は能動投入ごと1回、3/4/5+を等確率で強化。保存済みラン強化と乱数を同時に更新。
        // English: One seeded uniform tier boost per active X; commit permanent run power and RNG together.
        const draw=sampleUniformIndex(state.rngState,3),tier=([3,4,5] as const)[draw.index]!,amount=skillValue(skill.id,skill.rank,tuningOf(state.config));
        events.push(recordSkillActivation({type:'power-boost',tier,amount,boxIds:ids},[skill.id]));
        state={...state,rngState:draw.rngState,build:{...state.build,power:{...state.build.power,[tier]:state.build.power[tier]+amount}}};
      }
      else if (skillCatalog[skill.id].kind === 'shape') accept(applyDamageEffect(state, 'enemy', shinyAmount(state,ids,skillValue(skill.id, skill.rank, tuningOf(state.config))+(tuningOf(state.config).skillRevision===2&&skill.rank===2&&['corner-strike','square-strike','cup-strike'].includes(skill.id)?Math.floor(state.hp.enemy.max/100):0)+(skill.id==='corner-strike'&&state.transformation?.character==='mint'?kitBalanceOf(state.config).mintShapeBonus:0)), skill.id as import('./types.ts').ShapeSkillId, ids));
    }
  }
  if (state.actor === 'enemy' && state.config.enemyId === 'hanabell' && state.hp.enemy.current > 0 && state.hp.player.current > 0) {
    // 日本語: ハナベルは敵箱の十字形でヘルスと同じ回復（輝きを含めば2倍）。English: Hanabell heals like Health on an enemy-owned cross (doubled by shiny).
    const ids = findPlusShapes(state.config.board, state.boxes, box.id, 'enemy')[0]?.boxIds;
    if (ids) accept(applyHealingEffect(state, 'enemy', shinyAmount(state, ids, deepTraits.hanabellCrossHeal), 'enemy-pattern', ids));
  }
  let guarded = firstGuardUsed;
  const target = state.actor === 'player' ? 'enemy' : 'player';
  for (const link of links) {
    if (state.hp[state.actor].current <= 0) break;
    if (link.tier === null) continue;
    const triggered:import('./types.ts').NormalSkillId[]=[];
    const growFire = state.actor === 'player' && link.axis === 'vertical' && skillRank(state, 'grow-fire') > 0;
    if(growFire)triggered.push('grow-fire');
    let amount = state.actor === 'player' ? growFire ? playerPower(state, 3) + activeSkillValue(state, 'grow-fire') : playerPower(state, link.tier) : enemyLinkPower(state,link.tier);
    let skillId = growFire ? 'grow-fire' as const : undefined as import('./types.ts').LinkSkillId | undefined;
    if (state.actor === 'player' && link.axis === 'horizontal' && skillRank(state, 'horizontal-slash')) { amount += activeSkillValue(state, 'horizontal-slash'); skillId = 'horizontal-slash'; triggered.push('horizontal-slash'); }
    if (state.actor === 'player' && link.axis.startsWith('diagonal') && skillRank(state, 'diagonal-shot')) { amount += activeSkillValue(state, 'diagonal-shot'); skillId = 'diagonal-shot'; triggered.push('diagonal-shot'); }
    if(state.actor==='player'&&skillRank(state,'death-arrow')&&link.count>=4){amount=Math.max(amount,playerPower(state,4),playerPower(state,link.tier));skillId='death-arrow';triggered.push('death-arrow');}
    if(state.actor==='player')amount+=normalLinkBonus(state,box,link,links,id=>triggered.push(id));
    if(state.actor==='player'&&link.axis==='horizontal'&&state.transformation?.character==='rose')amount+=kitBalanceOf(state.config).roseHorizontalBonus;
    if(state.actor==='player'&&state.transformation?.character==='amber'&&kitBalanceOf(state.config).amber.mode==='link-power')amount*=kitBalanceOf(state.config).amber.multiplier;
    if(state.actor==='player'&&tuningOf(state.config).skillRevision===2&&state.hp.player.current*2<=state.hp.player.max&&skillRank(state,'last-stand')){amount=Math.floor(amount*activeSkillValue(state,'last-stand')/100);triggered.push('last-stand');}
    amount=frozenLinkAmount(state,link.boxIds,shinyAmount(state,link.boxIds,amount));
    if (state.actor === 'enemy' && amount > 0 && !guarded) {
      guarded = true;
      const guardValue=activeSkillValue(state,'first-guard');if(guardValue>0)triggered.push('first-guard');
      amount = Math.max(0, amount - guardValue);
    }
    if(state.actor==='enemy')amount=Math.max(0,amount-normalLinkGuard(state));
    amount=protectedDamage(state,target,amount);
    if(state.actor==='enemy'){const old=state.barrier??0,guard=absorbBarrier(state,amount);state=guard.state;amount=guard.amount;if(guard.absorbed)events.push({type:'barrier',before:old,after:state.barrier??0});}
    const change = damageHp(state.hp[target], amount);
    state = { ...state, hp: { ...state.hp, [target]: change.hp } };
    events.push(recordSkillActivation({ type: 'attack', actor: state.actor, target, axis: link.axis, linkCount: link.count, tier: link.tier,
      damage: amount, hpBefore: change.before, hpAfter: change.after, overkill: change.overkill, ...(skillId ? { skillId } : {}) },triggered));
    if(skillId==='death-arrow')accept(poisonRandomEnemy(state,'deadly-poison'));
    accept(thawFrozenLink(state,link.boxIds));
    if (state.actor === 'player') accept(gainGauge(state, shinyAmount(state,link.boxIds,linkGaugeGain(state, link.count))*(state.transformation?.character==='amber'&&kitBalanceOf(state.config).amber.mode==='link-gauge'?kitBalanceOf(state.config).amber.multiplier:1), 'link'));
    else accept(gainGauge(state, change.actual * tuningOf(state.config).gauge.damagePerHp, 'damage'));
    if (state.actor === 'enemy' && link.count === 4) accept(devilmonFourLink(state));
    if (growFire) {
      const growth = tuningOf(state.config).links.growFireGrowth;
      events.push({ type: 'link-growth', actor: 'player', skillId: 'grow-fire', amount: growth, before: state.link3Growth, after: state.link3Growth + growth });
      state = { ...state, link3Growth: state.link3Growth + growth };
    }
  }
  if (state.config.strategy?.transformation !== 'manual-charge') accept(tryTransformation(state, links));
  return { state, events, originBoxId: box.id, links, firstGuardUsed: guarded };
}
