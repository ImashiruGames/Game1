import { tuningOf } from '../core/tuning.ts';
import { requiresReplacement, rewardLabel } from '../app/rewards.ts';
import type { RewardId } from '../app/rewards.ts';
import type { BattleRunState } from '../app/BattleRun.ts';
import { skillCatalog } from '../core/skillCatalog.ts';
import type { BattleState } from '../core/types.ts';
import { createShapeDiagram } from './shapeDiagram.ts';
import { skillCard } from './LoadoutView.ts';

/** 日本語: 報酬画面は保存された候補を表示するだけ。再描画・取消で再抽選しない。
 * English: This view consumes a saved offer; renders and replacement cancellation never reroll it. */
export class RewardPanel {
  private dialog: HTMLDialogElement;
  private choices: HTMLElement;
  private replace: HTMLElement;
  private error: HTMLElement;
  private offerId: string | null = null;
  private generation = 0;
  private pending = false;
  private onChoose: (offerId: string, reward: RewardId | null, replacement?: number) => Promise<boolean>;
  constructor(dialog: HTMLDialogElement, onChoose: (offerId: string, reward: RewardId | null, replacement?: number) => Promise<boolean>) {
    this.dialog = dialog; this.onChoose = onChoose;
    this.choices = dialog.querySelector('#reward-choices')!; this.replace = dialog.querySelector('#reward-replace')!; this.error = dialog.querySelector('#reward-error')!;
    dialog.addEventListener('cancel', event => event.preventDefault());
    dialog.querySelector('#skip-reward')!.addEventListener('click', () => { if (this.offerId) void this.submit(this.offerId, null); });
  }
  close(): void { this.generation += 1; this.offerId = null; this.pending = false; if (this.dialog.open) this.dialog.close(); }
  render(state: BattleState, run: BattleRunState | null, resolving: boolean): void {
    if (run?.status !== 'reward' || !run.offer || !state.build) { this.close(); return; }
    if (resolving) return;
    if (this.offerId !== run.offer.id) {
      this.offerId = run.offer.id; this.generation += 1; this.pending = false;
      this.dialog.querySelectorAll<HTMLButtonElement>('button').forEach(button => { button.disabled = false; });
      this.choices.replaceChildren(); this.replace.replaceChildren(); this.replace.hidden = true; this.error.hidden = true;
      const id = run.offer.id; const build = state.build; const tuning = tuningOf(state.config);
      for (const reward of run.offer.choices) {
        const label = rewardLabel(build, reward, tuning); const button = document.createElement('button'); button.className = 'reward-choice';
        const title = document.createElement('strong'); title.textContent = label.title;
        const description = document.createElement('span'); description.textContent = label.description;
        button.append(title, description);
        if (reward !== 'three-polish' && reward !== 'large-polish') {
          const definition = skillCatalog[reward];
          if (definition.pattern) { button.append(createShapeDiagram(definition.pattern)); const orientation = document.createElement('small'); orientation.textContent = definition.pattern.fixedOrientation ? '上下固定' : '回転可'; button.append(orientation); }
          const slot = document.createElement('small'); slot.textContent = label.upgrade ? '所持スキルを＋へ強化' : '自由枠に追加'; button.append(slot);
        } else { const note = document.createElement('small'); note.textContent = '枠を使わない・ラン中ずっと有効'; button.append(note); }
        button.addEventListener('click', () => {
          if (this.pending || this.offerId !== id) return;
          if (!requiresReplacement(build, reward)) { void this.submit(id, reward); return; }
          this.replace.replaceChildren(); this.replace.hidden = false;
          const heading = document.createElement('h3'); heading.textContent = '入れ替える自由枠を選択'; this.replace.append(heading);
          build.slots.forEach((skill, index) => {
            const replace = document.createElement('button'); replace.className = 'replace-choice';
            replace.append(skillCard(skill!, `自由枠${index + 1}`, tuning));
            replace.addEventListener('click', () => { void this.submit(id, reward, index); }); this.replace.append(replace);
          });
          const back = document.createElement('button'); back.className = 'button secondary'; back.textContent = '入れ替えをやめる';
          back.addEventListener('click', () => { this.replace.hidden = true; }); this.replace.append(back);
        });
        this.choices.append(button);
      }
    }
    if (!this.dialog.open) this.dialog.showModal();
  }
  private async submit(id: string, reward: RewardId | null, replacement?: number): Promise<void> {
    if (this.pending || this.offerId !== id) return;
    this.pending = true; const generation = this.generation;
    this.dialog.querySelectorAll<HTMLButtonElement>('button').forEach(button => { button.disabled = true; });
    try { await this.onChoose(id, reward, replacement); }
    catch { if (this.offerId === id && this.generation === generation) { this.error.textContent = '選択できませんでした。もう一度選んでください'; this.error.hidden = false; } }
    finally { if (this.offerId === id && this.generation === generation) { this.pending = false; this.dialog.querySelectorAll<HTMLButtonElement>('button').forEach(button => { button.disabled = false; }); } }
  }
}
