import type { BattleController } from '../app/BattleController.ts';
import type { BattleRunState } from '../app/BattleRun.ts';
import type { BattleState } from '../core/types.ts';
import { emptyRewardSelection, planRewardInteraction, isRewardKeyRepeat } from './rewardInteraction.ts';
import type { RewardInput } from './rewardInteraction.ts';
import { rewardPanelHtml } from './rewardPresentation.ts';
export interface RewardDialogHooks {
    controller(): Pick<BattleController, 'snapshot' | 'runSnapshot' | 'chooseCategory' | 'chooseReward'>;
    locked(): boolean;
    markCommit(event: MouseEvent): void;
    afterPreview(state: BattleState, run: BattleRunState): void;
}
/** 日本語: 報酬画面の一時選択とフォーカスだけを所有し、取得はControllerへ渡す。
 * English: Own transient selection/focus, not rewards or saves. Restore starts unselected.
 * The pure planner still validates rendered offer/category/slot identities before any command. */
export function createRewardDialog(dialog: HTMLDialogElement, hooks: RewardDialogHooks) {
    let selection = emptyRewardSelection();
    let offerKey = '';
    let focusKey = '';
    const reset = () => {
        if (dialog.open) dialog.close();
        offerKey = '';
        focusKey = '';
        selection = emptyRewardSelection();
    };
    const render = (state: BattleState, run: BattleRunState | null, locked: boolean) => {
        if (run?.status !== 'reward' || !run.offer || !state.build) {
            reset();
            return;
        }
        const offer = run.offer, key = `${offer.id}/${offer.category ?? 'mixed'}`;
        if (key !== offerKey) {
            offerKey = key;
            selection = emptyRewardSelection();
        }
        dialog.innerHTML = rewardPanelHtml(state, offer, { ...selection, busy: locked, stage: run.stage });
        // 保存確認の上へ積まない。Only the controller's playable owner may open the modal.
        if (!locked) {
            if (!dialog.open)
                dialog.showModal();
            if (focusKey !== key) {
                focusKey = key;
                dialog.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true });
            }
        }
    };
    const handleInput = (b: HTMLButtonElement, event: MouseEvent): boolean => {
        const pairs: [RewardInput['type'], string | undefined][] = [
            ['category', b.dataset.category],
            ['preview', b.dataset.rewardPreview],
            ['slot', b.dataset.replacePreview],
            ['cancel', b.dataset.replaceCancel],
            ['skip', b.dataset.rewardSkip],
        ];
        const intent = pairs.find(([, value]) => value !== undefined);
        if (!intent)
            return false;
        const controller = hooks.controller(), run = controller.runSnapshot;
        if (run?.status !== 'reward' || !run.offer)
            return true;
        const outcome = planRewardInteraction(controller.snapshot, run.offer, selection, {
            type: intent[0],
            value: intent[1],
            offerId: b.dataset.offerId ?? '',
            category: b.dataset.offerCategory ?? '',
            slotToken: b.dataset.replaceToken,
            repeat: b.dataset.rewardRepeat === 'true',
            selectionToken: b.dataset.rewardSelection,
        }, hooks.locked());
        if (!outcome)
            return true;
        const previousSelected = selection.selected;
        selection = outcome.ui;
        if (outcome.command) {
            const command = outcome.command;
            if (command.kind === 'reward')
                hooks.markCommit(event);
            if (command.kind === 'category')
                void controller.chooseCategory(run.offer.id, command.category);
            else
                void controller.chooseReward(run.offer.id, command.id, command.slot);
            return true;
        }
        render(controller.snapshot, run, hooks.locked());
        hooks.afterPreview(controller.snapshot, run);
        const focus = intent[0] === 'slot' ? `[data-replace-preview="${selection.replacementSlot}"]` : `[data-reward-preview="${selection.selected ?? previousSelected}"]`;
        dialog.querySelector<HTMLButtonElement>(focus)?.focus({ preventScroll: true });
        return true;
    };
    // 長押しは確定しない。A released second Enter/Space is still an explicit activation.
    const keydown = (event: KeyboardEvent) => {
        if (isRewardKeyRepeat(event)) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    };
    const cancel = (event: Event) => event.preventDefault();
    dialog.addEventListener('keydown', keydown, true);
    dialog.addEventListener('cancel', cancel);
    return {
        render, handleInput, reset,
        dispose() {
            reset();
            dialog.removeEventListener('keydown', keydown, true);
            dialog.removeEventListener('cancel', cancel);
        },
    };
}
