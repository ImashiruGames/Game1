import {IMASHIRU} from './shiny.ts';
import { tuningOf } from './tuning.ts';
import { applyDamageEffect } from './effectDispatcher.ts';
import { sampleUniformIndex } from './random.ts';
import { getRowSkillPreview } from './skills.ts';
import type { BattleEvent, BattleState, BattleTransition, BoardSkillId } from './types.ts';

/** Validated board skills share HP effects, but never manufacture an active insertion. */
export function resolveBoardSkill(initial: BattleState, skillId: BoardSkillId, row?: number): BattleTransition {
  let state = initial;
  const events: BattleEvent[] = [{ type: 'board-skill', actor: 'player', skillId, ...(row === undefined ? {} : { row }) }];
  const accept = (step: BattleTransition) => { state = step.state; events.push(...step.events); };
  if (skillId === 'pain-shared') {
    const preview = getRowSkillPreview(state, row!);
    state = { ...state, boxes: state.boxes.filter(box => box.row !== row) };
    events.push({ type: 'row-cleared', row: row!, boxIds: preview.boxIds, playerCount: preview.playerCount, enemyCount: preview.enemyCount, neutralCount: preview.neutralCount });
    // 日本語: 双方への被害を事前確定し、片方の死亡では取り消さない。
    // English: Simultaneous damage is snapshotted before either side can die.
    accept(applyDamageEffect(state, 'enemy', preview.enemyDamage, 'pain-shared'));
    accept(applyDamageEffect(state, 'player', preview.playerDamage, 'pain-shared'));
  } else if(skillId==='imashiru-insight'){
    state={...state,gauge:state.gauge-IMASHIRU.insightCost,shinyNextDrop:true};events.push({type:'gauge-spent',before:initial.gauge,after:state.gauge,amount:IMASHIRU.insightCost},{type:'shiny-prepared'});
  } else {
    accept(applyDamageEffect(state, 'player', tuningOf(state.config).board.emberCost, 'ember'));
    if (state.hp.player.current > 0) {
      const targets = state.boxes.filter(box => box.owner === 'enemy');
      const ids: string[] = [];
      let rngState = state.rngState;
      const count = Math.min(tuningOf(state.config).board.emberConversions, targets.length);
      for (let index = 0; index < count; index += 1) {
        const random = sampleUniformIndex(rngState, targets.length);
        rngState = random.rngState;
        ids.push(targets.splice(random.index, 1)[0]!.id);
      }
      state = { ...state, rngState, boxes: state.boxes.map(box => ids.includes(box.id) ? { ...box, owner: 'player' } : box) };
      events.push({ type: 'boxes-converted', actor: 'player', boxIds: ids, from: 'enemy', to: 'player' });
    }
  }
  return { state, events };
}
