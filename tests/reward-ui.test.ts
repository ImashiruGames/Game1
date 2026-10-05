import test from 'node:test';
import assert from 'node:assert/strict';
import { RewardPanel } from '../src/ui/RewardPanel.ts';
import { createBattle, createPlayerBuild, defaultConfig } from '../src/core/index.ts';
import type { BattleRunState } from '../src/app/BattleRun.ts';

// Minimal event/DOM double: checks async view lifecycle, not real browser layout.
class Node {
  tagName = ''; disabled = false; hidden = false; open = false; textContent = ''; className = ''; title = ''; tabIndex = -1;
  children: Node[] = []; nodes = new Map<string, Node>(); listeners = new Map<string, Array<() => unknown>>(); style = { setProperty() {} };
  append(...children: Node[]) { this.children.push(...children); }
  replaceChildren() { this.children = []; }
  setAttribute() {}
  addEventListener(type: string, listener: () => unknown) { this.listeners.set(type, [...this.listeners.get(type) ?? [], listener]); }
  emit(type: string) { for (const listener of this.listeners.get(type) ?? []) listener(); }
  querySelector(selector: string) { return this.nodes.get(selector); }
  querySelectorAll(): Node[] { return [...this.nodes.values(), ...this.children].flatMap(node => [node, ...node.querySelectorAll()]).filter(node => node.tagName === 'button'); }
  showModal() { this.open = true; }
  close() { this.open = false; }
}
const state = createBattle({ ...defaultConfig, characterId: 'blue', initialBuild: createPlayerBuild('blue') });
const run = (id: string): BattleRunState => ({ stage: 1, defeatedCount: 1, currentEnemyId: 'marujiro', status: 'reward', offer: { id, choices: ['three-polish', 'large-polish', 'charge'] } });
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
async function withDocument(body: () => Promise<void>) {
  const before = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement(tag: string) { const node = new Node(); node.tagName = tag; return node; } } });
  try { await body(); } finally { if (before) Object.defineProperty(globalThis, 'document', before); else delete (globalThis as unknown as Record<string, unknown>).document; }
}
function harness(choose: ConstructorParameters<typeof RewardPanel>[1]) {
  const dialog = new Node();
  for (const id of ['#reward-choices', '#reward-replace', '#reward-error', '#skip-reward', '#reward-restart']) { const node = new Node(); node.tagName = id.includes('skip') || id.includes('restart') ? 'button' : 'div'; dialog.nodes.set(id, node); }
  const panel = new RewardPanel(dialog as unknown as HTMLDialogElement, choose);
  return { panel, dialog, node: (id: string) => dialog.nodes.get(id)! };
}
test('new reward offers re-enable the persistent skip and restart controls', () => withDocument(async () => {
  let panel!: RewardPanel;
  const h = harness(async () => { panel.close(); return true; }); panel = h.panel;
  panel.render(state, run('first'), false); h.node('#reward-choices').children[0]!.emit('click'); await flush();
  assert.equal(h.dialog.open, false); assert.equal(h.node('#skip-reward').disabled, true);
  panel.render(state, run('second'), false);
  assert.equal(h.node('#skip-reward').disabled, false); assert.equal(h.node('#reward-restart').disabled, false); assert.equal(h.dialog.open, true);
}));
test('double clicking one offer sends only one selection', () => withDocument(async () => {
  let finish!: () => void; let calls = 0;
  const h = harness(async () => { calls += 1; await new Promise<void>(resolve => { finish = resolve; }); return true; });
  h.panel.render(state, run('first'), false);
  const button = h.node('#reward-choices').children[0]!; button.emit('click'); button.emit('click'); h.node('#skip-reward').emit('click');
  assert.equal(calls, 1); finish(); await flush();
}));
test('an old selection completion cannot unlock a newer pending offer', () => withDocument(async () => {
  const finishes: Array<() => void> = [];
  const h = harness(async () => { await new Promise<void>(resolve => finishes.push(resolve)); return true; });
  h.panel.render(state, run('old'), false); h.node('#reward-choices').children[0]!.emit('click');
  h.panel.render(state, run('new'), false); h.node('#reward-choices').children[0]!.emit('click');
  finishes[0]!(); await flush(); assert.equal(h.node('#skip-reward').disabled, true);
  finishes[1]!(); await flush(); assert.equal(h.node('#skip-reward').disabled, false);
}));
test('rerendering the same offer preserves its DOM choices without rebuilding or rerolling', () => withDocument(async () => {
  const h = harness(async () => true); const saved = run('stable'); h.panel.render(state, saved, false);
  const button = h.node('#reward-choices').children[0]; h.panel.render(state, saved, false);
  assert.strictEqual(h.node('#reward-choices').children[0], button);
}));
