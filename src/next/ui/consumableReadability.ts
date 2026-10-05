/** 日本語: 残り回数と使用後の空きを表示する。使用の判定と確定は既存Coreに任せる。 */
import {skillCatalog} from '../core/skillCatalog.ts';
import type { SkillInstance } from '../core/types.ts';

export interface ConsumableUseView {
  readonly uses: number;
  readonly slot: number;
  readonly opensSlot: boolean;
  readonly countLabel: string;
  readonly previewLabel: string;
  readonly confirmLabel: string;
  readonly actionHint: string;
  readonly details: string;
}
/** Read the equipped free slot's real remaining count. Health and other unlimited skills are excluded. */
export function consumableUseView(skill: SkillInstance | null | undefined, slot: number, capacity=2): ConsumableUseView | null {
  if (!skill || skillCatalog[skill.id].kind !== 'instant' || (!Number.isSafeInteger(slot) || slot < 0 || slot >= capacity)
    || skill.uses === null || !Number.isSafeInteger(skill.uses) || skill.uses < 0) return null;
  const uses = skill.uses, label = `自由${slot + 1}`, opensSlot = uses === 1;
  return {
    uses, slot, opensSlot,
    countLabel: `残り${uses}回`,
    previewLabel: `使用を確認（残${uses}回）`,
    confirmLabel: `使う（残${uses}回）`,
    actionHint: uses === 0 ? '残り0回 · 使用できません' : `残${uses}回 · 1手消費 · ${opensSlot ? `${label}が空く` : `使用後は残${uses - 1}回`}`,
    details: uses === 0 ? '残り0回。使用できません。' : `残り${uses}回。使用は1手。${opensSlot ? `使用後は${label}が空き、新しいスキルを入れられます。` : `使用後は残り${uses - 1}回になり、この枠に残ります。`}`,
  };
}
export function consumableDetailsHtml(skill: SkillInstance | null | undefined, slot: number, capacity=2): string {
  const view = consumableUseView(skill, slot,capacity);
  return view ? `<p class="consumable-use-note"><strong>${view.countLabel}</strong> · ${view.details.replace(`残り${view.uses}回。`, '')}</p>` : '';
}
