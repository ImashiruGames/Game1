import {revisedCharacters,poisonRandomEnemy,completeComboTurn} from './characterRevision.ts';
import {hasNewKit} from '../meta/kits.ts';
import {recordSkillActivation} from './skillActivationRecord.ts';
import {kitBalanceOf} from '../meta/kitBalance.ts';
import {assignBoxType} from './boxTypes.ts';
import {newKitTransformationAvailable} from './kitBoards.ts';
import { tuningOf } from './tuning.ts';
import { gainGauge, gaugeDefinition } from './gauge.ts';
import { activeSkillValue } from './playerBuild.ts';
import { freeze } from './immutable.ts';
import type { BattleState, BattleTransition, Link, Transformation } from './types.ts';

/** 日本語: 変化判定は能動投入の全技能・全攻撃の後で1回だけ行う。
 * English: One transformation gate follows all skills and attacks of this active insertion. */
export function tryTransformation(state: BattleState, links: readonly Link[]): BattleTransition {
  const character = state.config.characterId;
  const rules = gaugeDefinition(character, tuningOf(state.config));
  if (state.actor !== 'player' || !character || !rules || state.transformation
    || state.hp.player.current <= 0 || state.hp.enemy.current <= 0 || state.gauge < rules.cost || !newKitTransformationAvailable(state) || !links.some(link => link.count >= tuningOf(state.config).transformation.minimumLink)) return { state, events: [] };
  const transformation = formFor(state);
  const after = state.gauge - rules.cost;
  const shining=transformation.character==='imashiru';let boxes=shining?state.boxes.map(b=>b.owner==='player'?assignBoxType(b,'shiny'):b):state.boxes;
  const effect=kitFormEffect(state,transformation,boxes);boxes=effect.boxes;
  return { state: { ...state, transformation, gauge: after,boxes,...effect.patch }, events: [{ type: 'transformation', character:transformation.character, cost: rules.cost, before: state.gauge, after },...effect.events,...(shining?[{type:'boxes-shining' as const,boxIds:boxes.filter(b=>b.owner==='player').map(b=>b.id)}]:[])] };
}
export function completePlayerTurn(state: BattleState): BattleTransition {
  const combo=completeComboTurn(state);state=combo.state;
  const mint=state.transformation?.character==='mint'&&revisedCharacters(state.config)?state.transformation:null;
  if(mint){const remaining=mint.remainingOwnTurns!-1;state={...state,transformation:remaining?{...mint,remainingOwnTurns:remaining}:null};}
  const continuingAmber=state.transformation?.character==='amber'&&(state.transformation.remainingOwnTurns??1)>1;
  const expiredCharacter=state.transformation?.character;
  const expires = !continuingAmber&&!(revisedCharacters(state.config)&&state.transformation?.character==='violet')&&state.transformation?.scope==='turn'||state.transformation?.character === 'red' && state.transformation.remainingStarts === 0;
  const turnState:BattleState=continuingAmber&&state.transformation?.character==='amber'?{...state,transformation:{...state.transformation,remainingOwnTurns:state.transformation.remainingOwnTurns!-1}}:expires?{...state,transformation:null}:state;
  const charge = gainGauge(turnState, tuningOf(state.config).gauge.turnGain + activeSkillValue(state, 'charge'), 'turn');
  if(activeSkillValue(state,'charge')>0)for(const event of charge.events)recordSkillActivation(event,['charge']);
  return { state: charge.state, events: [...combo.events,...(mint&&!state.transformation?[{type:'transformation-ended' as const,character:'mint' as const}]:[]),...(expires ? [{ type: 'transformation-ended', character: expiredCharacter! } as const] : []), ...charge.events] };
}
/** Run carry is independent of stage-local effects. It never rescans inherited boxes. */
export function carryTransformationState(next: BattleState, previous: BattleState): BattleState {
  return freeze({ ...next, build: previous.build, gauge: previous.gauge, transformation: previous.transformation?.character === 'red' && previous.transformation.remainingStarts > 0 ? previous.transformation : null,
    playerTurnStarted: false,...(revisedCharacters(next.config)&&next.config.meta?.rosterId==='mint'?{comboStreak:previous.comboStreak??0,comboActivated:false}:{}),...(previous.shinyNextDrop?{shinyNextDrop:true}:{}) });
}

export function canManualTransform(state: BattleState): boolean {
  const rules = gaugeDefinition(state.config.characterId, tuningOf(state.config));
  return state.config.strategy?.transformation === 'manual-charge' && !!rules && !state.result
    && state.actor === 'player' && !state.transformation && state.hp.player.current > 0
    && state.hp.enemy.current > 0 && state.gauge >= rules.cost&&newKitTransformationAvailable(state);
}
/** 日本語: 現在の開始機会は済んだものとし、赤は次の自手番から2回。
 * English: Consume no ordinary action; Red starts on the next own turn, never retroactively. */
export function activateManualTransformation(state: BattleState): BattleTransition {
  if (!canManualTransform(state)) return { state, events: [] };
  const character = state.config.characterId!;
  const cost = gaugeDefinition(character, tuningOf(state.config))!.cost;
  const transformation = formFor(state);
  const shining=transformation.character==='imashiru';let boxes=shining?state.boxes.map(b=>b.owner==='player'?assignBoxType(b,'shiny'):b):state.boxes;
  const effect=kitFormEffect(state,transformation,boxes);boxes=effect.boxes;
  return { state: { ...state, transformation, gauge: state.gauge - cost, playerTurnStarted: true,boxes,...effect.patch },
    events: [{ type: 'transformation', character:transformation.character, before: state.gauge, after: state.gauge - cost, cost },...effect.events,...(shining?[{type:'boxes-shining' as const,boxIds:boxes.filter(b=>b.owner==='player').map(b=>b.id)}]:[])] };
}

function formFor(state:BattleState):Transformation {const id=state.config.meta?.rosterId;if(hasNewKit(state.config)){if(id==='mint')return {character:id,scope:'stage',...(revisedCharacters(state.config)?{remainingOwnTurns:7}:{})};if(id==='amber'){const turns=kitBalanceOf(state.config).amber.ownTurns;return {character:id,scope:'turn',...(turns>1?{remainingOwnTurns:turns}:{})};}if(id==='violet'||id==='silver'||id==='rose')return {character:id,scope:'turn'};}if(id==='imashiru')return {character:'imashiru',scope:'turn'};return state.config.characterId==='blue'?{character:'blue',scope:'stage'}:{character:'red',scope:'run',remainingStarts:tuningOf(state.config).transformation.redBonusStarts};}
function kitFormEffect(state:BattleState,form:Transformation,initial:BattleState['boxes']):{boxes:BattleState['boxes'];patch:Partial<BattleState>;events:BattleTransition['events']} {if(form.character==='violet'&&revisedCharacters(state.config)){const step=poisonRandomEnemy({...state,boxes:initial},'poison');return {boxes:step.state.boxes,patch:{rngState:step.state.rngState},events:step.events};}if(form.character==='violet'){const ids=initial.filter(b=>b.owner==='enemy'&&b.type!=='deadly-poison').sort((a,b)=>a.row-b.row||a.col-b.col).slice(0,kitBalanceOf(state.config).violetPoisonTargets).map(b=>b.id);return {boxes:initial.map(b=>ids.includes(b.id)?assignBoxType(b,'deadly-poison','player'):b),patch:{},events:[{type:'kit-board-changed',boxIds:ids}]};}if(form.character==='silver')return {boxes:initial,patch:{barrier:kitBalanceOf(state.config).silverBarrier},events:[{type:'barrier',before:state.barrier??0,after:kitBalanceOf(state.config).silverBarrier}]};return {boxes:initial,patch:{},events:[]};}
