import { defaultTuning, tuningOf } from '../core/tuning.ts';
import type { GameTuning } from '../core/tuning.ts';
import { buildSkills, instantSlots } from '../core/playerBuild.ts';
import { skillCatalog, skillDescription, skillName } from '../core/skillCatalog.ts';
import type { BattleState, NormalSkillId, SkillInstance } from '../core/types.ts';
import { createShapeDiagram } from './shapeDiagram.ts';

export function skillCard(skill: SkillInstance, label: string, tuning: GameTuning = defaultTuning): HTMLElement {
  const card = document.createElement('div'); card.className = 'normal-skill-card'; card.title = skillDescription(skill.id, skill.rank, tuning); card.setAttribute('aria-label', `${skillName(skill.id, skill.rank)}。${skillDescription(skill.id, skill.rank, tuning)}`); card.tabIndex = 0;
  const definition = skillCatalog[skill.id];
  if (definition.pattern) card.append(createShapeDiagram(definition.pattern));
  const text = document.createElement('div'); text.className = 'normal-skill-text';
  const heading = document.createElement('strong'); heading.textContent = skillName(skill.id, skill.rank);
  const caption = document.createElement('span'); caption.textContent = label + (definition.pattern ? ` · ${definition.pattern.fixedOrientation ? '上下固定' : '回転可'}` : '');
  const detail = document.createElement('p'); detail.textContent = skillDescription(skill.id, skill.rank, tuning);
  text.append(heading, caption, detail); card.append(text); return card;
}
export class LoadoutView {
  private root: HTMLElement;
  private onUse: (slot: number, id: NormalSkillId) => void;
  private signature = '';
  constructor(root: HTMLElement, onUse: (slot: number, id: NormalSkillId) => void) { this.root = root; this.onUse = onUse; }
  render(state: BattleState, locked: boolean): void {
    const signature = JSON.stringify([state.build, state.config.playerSkills, state.config.characterId, state.config.tuning, locked, state.actor, state.result]);
    if (signature === this.signature) return;
    this.signature = signature; this.root.replaceChildren();
    const skills = state.build ? [state.build.fixed, ...state.build.slots] : [...buildSkills(state)];
    for (let index = 0; index < Math.max(3, skills.length); index += 1) {
      const skill = skills[index];
      if (!skill) { const empty = document.createElement('div'); empty.className = 'normal-skill-empty'; empty.textContent = index === 0 ? '固定枠 · なし' : `自由枠${index} · 空き`; this.root.append(empty); continue; }
      const card = skillCard(skill, index === 0 ? '固定' : `自由枠${index}`, tuningOf(state.config));
      if (skillCatalog[skill.id].kind === 'instant') {
        const button = document.createElement('button'); button.className = 'instant-use'; button.textContent = '使う'; button.setAttribute('aria-label', `${skillName(skill.id, skill.rank)}を使う。1手消費・残り1回`);
        button.disabled = locked || !instantSlots(state).includes(index - 1);
        button.addEventListener('click', () => this.onUse(index - 1, skill.id)); card.append(button);
      }
      this.root.append(card);
    }
  }
}
