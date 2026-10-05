import './style.css';
import { battleFixtures, createCharacterBattleConfig, defaultConfig, needsTurnStart } from './core/index.ts';
import type { BattleState } from './core/index.ts';
import { BattleController } from './app/BattleController.ts';
import { BoardScene, createBoardGame } from './ui/BoardScene.ts';
import { BattleShell } from './ui/BattleShell.ts';
import { activeDropPose, effectForEvent, effectTiming } from './ui/battlePresentation.ts';

/** 日本語: 中断可能な演出待ち。Core の判定には一切使わない。
 * English: Cancellable presentation delay, never a simulation clock. */
function pause(milliseconds: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise(resolve => {
    const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve(); };
    const timer = setTimeout(finish, milliseconds);
    signal.addEventListener('abort', finish, { once: true });
  });
}

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('App root is missing');
let controller: BattleController;
const drop = (id: string) => { if (!shell.targetingSkill) void controller.drop(id); };
const shell = new BattleShell(app, battleFixtures, drop);
const scene = new BoardScene(
  drop,
  () => { void controller.start(); },
  option => shell.hover(option),
  row => shell.hoverSkillRow(row),
  row => shell.commitSkillRow(row),
);

controller = new BattleController(createCharacterBattleConfig('blue', 'marujiro', defaultConfig), {
  render(state, resolving, run) {
    shell.render(state, resolving, run);
    scene.draw(state, !resolving && !state.result && state.actor === 'player' && !needsTurnStart(state));
  },
  async animate(resolution, before, after, signal) {
    if (signal.aborted) return;
    // 日本語: 判定済みの結果を順に表示。演出から技能・乱数・ダメージを再計算しない。
    // English: Present committed events without recalculating skills, randomness, or damage.
    let presented: BattleState = { ...before, result: null };
    shell.render(presented, true, controller.runSnapshot);
    const drop = resolution.events.find(event => event.type === 'drop');
    if (drop) {
      // 日本語: 発火時の配置は後処理前のスナップショットを使う。
      // English: Effects use the active-drop pose, before passive settling.
      const attackPose = activeDropPose(before, resolution);
      await scene.animateDrop(resolution, before, attackPose, signal, shell.reducedMotion);
      if (signal.aborted) return;
      presented = attackPose;
    }
    for (const event of resolution.events) {
      if (signal.aborted) return;
      const effect = effectForEvent(event, resolution);
      const timing = effectTiming(shell.reducedMotion);
      if (effect) {
        scene.showEffect(presented, effect);
        await pause(timing.lead, signal);
        if (signal.aborted) return;
      }
      if (event.type === 'row-cleared') {
        // 日本語: 列消去の双方ダメージは画面上でも同時に反映する。
        // English: Reveal both sides of simultaneous row damage together.
        presented = { ...presented, boxes: after.boxes, hp: after.hp };
        scene.draw(presented, false);
      }
      if (event.type === 'boxes-converted') {
        presented = { ...presented, boxes: after.boxes };
        scene.draw(presented, false);
      }
      if (event.type === 'attack' || event.type === 'instant-kill' || event.type === 'damage' || event.type === 'heal') {
        presented = { ...presented, hp: { ...presented.hp, [event.target]: { ...presented.hp[event.target], current: event.hpAfter } } };
      }
      if (event.type === 'instant-skill') presented = { ...presented, build: after.build };
      if (event.type === 'gauge') presented = { ...presented, gauge: event.after };
      if (event.type === 'transformation') presented = { ...presented, gauge: event.after, transformation: after.transformation };
      if (event.type === 'transformation-ended') presented = { ...presented, transformation: null };
      if (event.type === 'turn-start' && presented.transformation?.character === 'red') presented = { ...presented, transformation: { ...presented.transformation, remainingStarts: event.remainingStarts }, playerTurnStarted: true };
      if (event.type === 'link-growth') presented = { ...presented, link3Growth: event.after };
      if (event.type === 'battle-end') presented = after;
      shell.event(event, before.turn);
      shell.render(presented, true, controller.runSnapshot);
      if (effect) {
        scene.showFeedback(presented, effect, shell.reducedMotion);
        await pause(timing.hold, signal);
        if (signal.aborted) return;
        scene.clearEffect();
      } else if (event.type === 'transformation') await scene.animateTransformation(signal, shell.reducedMotion, event.character, after.transformation?.character === 'red' ? after.transformation.remainingStarts : undefined);
      else await pause(shell.reducedMotion || event.type === 'gauge' ? 25 : event.type === 'skip' || event.type === 'blocked' ? 500 : 160, signal);
    }
    if (!signal.aborted) {
      scene.draw(after, false);
      shell.render(after, true, controller.runSnapshot);
      await pause(shell.reducedMotion ? 25 : 220, signal);
    }
  },
  async animateStageTransition(_before, after, run, signal) {
    if (signal.aborted) return;
    scene.cancel();
    shell.stageAdvanced(after, run);
    shell.render(after, true, run);
    scene.draw(after, false);
    await pause(shell.reducedMotion ? 25 : 500, signal);
  },
  reset() { scene.cancel(); shell.reset(); shell.hover(null); },
  reportError(error) { console.error('Presentation failed; the committed core result was retained.', error); },
}, { run: { mode: 'endless', rewards: true } });

shell.bindBuild(slot => { void controller.instantSkill(slot); }, (id, reward, replacement) => controller.chooseReward(id, reward, replacement));
shell.bindSkills((skill, row) => { void controller.boardSkill(skill, row); }, row => scene.previewRow(row), mode => scene.setSkillMode(mode));
shell.bindRestart(() => { void controller.restart(); }, (config, continuous) => controller.restart(config, continuous ? { run: { mode: 'endless', rewards: true } } : {}));
const game = createBoardGame(shell.boardHost, scene);
window.addEventListener('pagehide', () => { controller.destroy(); scene.cancel(); game.destroy(true); }, { once: true });
