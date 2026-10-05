import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { BattleSettings } from '../src/ui/BattleSettings.ts';
import { BattleShell } from '../src/ui/BattleShell.ts';
import { battleFixtures, createBattle, createCharacterBattleConfig } from '../src/core/index.ts';

// 日本語: 小さなDOM代役で非同期ハンドラーを検証。画面描画・ネイティブdialog検査の代わりではない。
// English: This minimal DOM double exercises handlers, not browser rendering/native-dialog behavior.
class FakeElement {
  tagName = '';
  dataset: Record<string, string> = {};
  focus(): void {}
  type = '';
  name = '';
  disabled = false;
  childNodes: FakeElement[] = [];
  value = '';
  checked = true;
  hidden = true;
  open = false;
  textContent = '';
  listeners = new Map<string, Array<(event: { target: FakeElement }) => unknown>>();
  children = new Map<string, FakeElement>();
  addEventListener(type: string, handler: (event: { target: FakeElement }) => unknown): void {
    this.listeners.set(type, [...this.listeners.get(type) ?? [], handler]);
  }
  async emit(type: string): Promise<void> {
    for (const handler of this.listeners.get(type) ?? []) await handler({ target: this });
  }
  querySelector(selector: string): FakeElement | null { return this.children.get(selector) ?? null; }
  querySelectorAll(): FakeElement[] {
    return this.childNodes.flatMap(child => [child, ...child.querySelectorAll()]).filter(child => child.tagName === 'input');
  }
  append(...nodes: FakeElement[]): void { this.childNodes.push(...nodes); }
  replaceChildren(): void { this.childNodes = []; }
  setAttribute(): void {}
  showModal(): void { this.open = true; }
  close(): void { this.open = false; void this.emit('close'); }
}
function harness(selected: () => Promise<void>) {
  const root = new FakeElement();
  for (const id of ['#reward-restart', '#result-restart', '#restart-current', '#apply-config', '#config-error', '#seed-input', '#fixture-select', '#portrait-select', '#enemy-select', '#continuous-run', '#settings-dialog', '#open-settings']) root.children.set(id, new FakeElement());
  const node = (id: string) => root.children.get(id)!;
  node('#seed-input').value = '1';
  node('#fixture-select').value = 'enemy-attack';
  node('#portrait-select').value = 'blue';
  node('#enemy-select').value = 'marujiro';
  node('#settings-dialog').children.set('.dialog-close', new FakeElement());
  // Skip markup construction so this test needs no browser or third-party DOM dependency.
  const settings = Object.assign(Object.create(BattleSettings.prototype), { root, fixtures: battleFixtures, generation: 0 }) as BattleSettings;
  const shell = Object.assign(Object.create(BattleShell.prototype), { root, settings }) as BattleShell;
  const internal = shell as unknown as { bindDialog(trigger: string, dialog: string, beforeOpen?: () => boolean): void };
  internal.bindDialog('#open-settings', '#settings-dialog', () => settings.beforeOpen());
  shell.bindRestart(() => {}, selected);
  return { node };
}

test('a stale settings apply cannot close a reopened settings dialog', async () => {
  let finish!: () => void;
  const waiting = new Promise<void>(resolve => { finish = resolve; });
  const { node } = harness(() => waiting);
  await node('#open-settings').emit('click');
  const applying = node('#apply-config').emit('click');
  node('#settings-dialog').close();
  await node('#open-settings').emit('click');
  finish();
  await applying;
  assert.equal(node('#settings-dialog').open, true);
});

test('a stale settings failure cannot overwrite a newer dialog error state', async () => {
  let fail!: (error: Error) => void;
  const waiting = new Promise<void>((_resolve, reject) => { fail = reject; });
  const { node } = harness(() => waiting);
  await node('#open-settings').emit('click');
  const applying = node('#apply-config').emit('click');
  node('#settings-dialog').close();
  await node('#open-settings').emit('click');
  node('#config-error').textContent = 'new session';
  fail(new Error('old failure'));
  await applying;
  assert.equal(node('#config-error').textContent, 'new session');
  assert.equal(node('#settings-dialog').open, true);
});

test('a current successful apply still closes its settings dialog', async () => {
  const { node } = harness(async () => {});
  await node('#open-settings').emit('click');
  await node('#apply-config').emit('click');
  assert.equal(node('#settings-dialog').open, false);
});


function skillHarness(preview: (row: number | null) => void = () => {}, character: 'blue' | 'red' = 'blue') {
  const root = new FakeElement();
  for (const id of ['#skill-instruction', '#skill-row-select', '#skill-row-label', '#confirm-skill', '#skill-preview', '#skill-target', '.player-panel', '#open-skill', '#open-drops', '#drop-options', '#action-hint', '#landing-hint']) root.children.set(id, new FakeElement());
  const state = createBattle(createCharacterBattleConfig(character, 'marujiro', battleFixtures.find(fixture => fixture.id === 'health-plus')!));
  const actions: Array<{ skill: string; row?: number }> = [];
  const modes: unknown[] = [];
  const shell = Object.assign(Object.create(BattleShell.prototype), { root, state, busy: false, selectedRow: null, activeSkill: null, lastDropSignature: '', onTargetMode: (mode: unknown) => modes.push(mode), onRowPreview: preview, onSkill: (skill: string, row?: number) => actions.push({ skill, row }) }) as BattleShell;
  const internal = shell as unknown as { prepareSkill(): boolean; confirmSkill(): void; state: typeof state; busy: boolean };
  return { root, shell, internal, actions, modes, node: (id: string) => root.children.get(id)! };
}
function withFakeDocument<T>(callback: () => Promise<T>): Promise<T> {
  const prior = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement(tagName: string) { const element = new FakeElement(); element.tagName = tagName; return element; },
    createTextNode(text: string) { const element = new FakeElement(); element.textContent = text; return element; },
  } });
  return callback().finally(() => {
    if (prior) Object.defineProperty(globalThis, 'document', prior);
    else delete (globalThis as unknown as Record<string, unknown>).document;
  });
}

test('Blue target mode previews on the board without action and commits the chosen row once', () => withFakeDocument(async () => {
  const { internal, shell, node, actions, modes } = skillHarness();
  assert.equal(internal.prepareSkill(), true);
  assert.equal(node('#skill-target').hidden, false);
  assert.equal(shell.targetingSkill, true);
  assert.equal(node('#confirm-skill').disabled, true);
  assert.equal(node('#skill-row-select').childNodes.length, 5);
  shell.hoverSkillRow(1);
  assert.equal(node('#confirm-skill').disabled, false);
  assert.match(node('#skill-preview').textContent, /2行目.*敵に2 \/ 自分に0/);
  assert.deepEqual(actions, []);
  shell.commitSkillRow(1);
  shell.commitSkillRow(1);
  internal.confirmSkill();
  assert.deepEqual(actions, [{ skill: 'pain-shared', row: 1 }]);
  assert.deepEqual(modes, ['row', null]);
  assert.equal(node('#skill-target').hidden, true);
}));

test('mouseleave and cancel clear Blue preview without action, and stale commits are ignored', () => withFakeDocument(async () => {
  const previews: unknown[] = [];
  const { internal, shell, node, actions } = skillHarness(row => previews.push(row));
  internal.prepareSkill();
  shell.hoverSkillRow(1);
  shell.hoverSkillRow(null);
  assert.equal(node('#confirm-skill').disabled, true);
  assert.equal(node('#skill-row-select').value, '');
  internal.confirmSkill();
  shell.hoverSkillRow(0);
  assert.match(node('#skill-preview').textContent, /空行でも1手を消費/);
  shell.cancelSkill();
  shell.commitSkillRow(0);
  internal.confirmSkill();
  assert.deepEqual(actions, []);
  assert.equal(previews.at(-1), null);
}));

test('invalid row and busy targeting cannot dispatch a skill', () => withFakeDocument(async () => {
  const { internal, shell, node, actions } = skillHarness();
  internal.prepareSkill();
  for (const row of [-1, 4, NaN, 1.5]) shell.commitSkillRow(row);
  assert.deepEqual(actions, []);
  assert.equal(node('#confirm-skill').disabled, true);
  internal.busy = true;
  shell.commitSkillRow(1);
  assert.deepEqual(actions, []);
}));

test('inline fallback confirmation uses its selected row and targeting disables cached drop controls', () => withFakeDocument(async () => {
  const { internal, shell, node, actions } = skillHarness();
  internal.prepareSkill();
  assert.equal(node('#open-drops').disabled, true);
  assert.ok(node('#drop-options').childNodes.every(button => button.disabled));
  shell.hoverSkillRow(0);
  internal.confirmSkill();
  assert.deepEqual(actions, [{ skill: 'pain-shared', row: 0 }]);
  assert.equal(node('#open-drops').disabled, false);
}));

test('Red uses inline cost preview, cancellation is free, and confirmation dispatches once', () => withFakeDocument(async () => {
  const { internal, shell, node, actions, modes } = skillHarness(() => {}, 'red');
  internal.prepareSkill();
  assert.equal(node('#skill-row-label').hidden, true);
  assert.match(node('#skill-preview').textContent, /自分のHP 10 → 7/);
  assert.deepEqual(actions, []);
  shell.cancelSkill();
  internal.confirmSkill();
  assert.deepEqual(actions, []);
  internal.prepareSkill();
  internal.confirmSkill();
  internal.confirmSkill();
  assert.deepEqual(actions, [{ skill: 'ember', row: undefined }]);
  assert.deepEqual(modes, ['confirm', null, 'confirm', null]);
}));

test('Red zero-target and self-KO previews remain explicit', () => withFakeDocument(async () => {
  const { internal, node, shell } = skillHarness(() => {}, 'red');
  internal.state = { ...internal.state, boxes: [] };
  internal.prepareSkill();
  assert.match(node('#skill-preview').textContent, /対象0個でも1手を消費/);
  shell.cancelSkill();
  internal.state = { ...internal.state, hp: { ...internal.state.hp, player: { ...internal.state.hp.player, current: 3 } } };
  internal.prepareSkill();
  assert.match(node('#skill-preview').textContent, /敗北し、箱の変換は行いません/);
}));

test('optional board highlight failure cannot block targeting or confirmation', () => withFakeDocument(async () => {
  const warning = mock.method(console, 'warn', () => {});
  try {
    const { internal, shell, actions } = skillHarness(() => { throw new Error('preview unavailable'); });
    internal.prepareSkill();
    shell.commitSkillRow(0);
    assert.deepEqual(actions, [{ skill: 'pain-shared', row: 0 }]);
    assert.ok(warning.mock.callCount() >= 1);
  } finally { warning.mock.restore(); }
}));
