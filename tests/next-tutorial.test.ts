// 日本語: チュートリアルを台本どおりに最後まで進め、数値と操作制限を確かめる。
// English: Run the whole tutorial headlessly; verify the scripted numbers and the input locks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TutorialController } from '../src/next/tutorial/controller.ts';
import { beats } from '../src/next/tutorial/script.ts';

const view: any = { render() {}, animate: async () => {}, animateStageTransition: async () => {} };
const tick = () => new Promise(resolve => setTimeout(resolve, 2));

test('チュートリアルは台本どおりの数値で最後まで終わる', async () => {
  const c = new TutorialController(view, true);
  const seen = new Map<number, string>();
  c.onPanel = p => { if (p) seen.set(p.index, `${c.snapshot.hp.player.current}/${c.snapshot.hp.enemy.current}`); };
  let done = false; c.onFinish = () => { done = true; };
  void c.play();
  for (let i = 0; i < 600 && !done; i++) {
    await tick();
    const e = c.expect; if (!e) continue;
    if (e.kind === 'tap') c.tap();
    else if (e.kind === 'drop') await c.drop(`ceiling:${'ABCDEF'.indexOf(e.col)}:0`);
    else if (e.kind === 'board') await c.boardSkill('pain-shared', e.row);
    else if (e.kind === 'transform') await c.transform();
    else if (e.kind === 'category') await c.chooseCategory(c.runSnapshot!.offer!.id, e.category);
    else { const o = c.runSnapshot!.offer!; await c.chooseReward(o.id, o.choices[0]!); }
  }
  assert.ok(done);
  assert.equal(c.runSnapshot?.status, 'cleared');
  const at = (text: string) => seen.get(beats.findIndex(b => b.text.startsWith(text)))!;
  assert.equal(at('やったね！3リンク'), '30/26');
  assert.equal(at('いい感じ！'), '30/19');
  assert.equal(at('きゃっ！'), '28/8');
  assert.equal(at('ヘルスで回復'), '30/4');
  assert.equal(at('盤面が埋まって'), '28/15');
  assert.equal(c.snapshot.hp.enemy.current <= 0, true);
  c.destroy();
});

test('台本が許さない操作は受け付けない', async () => {
  const c = new TutorialController(view, true);
  void c.play(); await tick(); await tick();
  assert.equal(await c.drop('ceiling:2:0'), false); // 最初は台詞を送る場面
  for (let i = 0; i < 5; i++) { c.tap(); await tick(); }
  assert.equal(c.expect?.kind, 'drop');
  assert.equal(await c.drop('ceiling:0:0'), false); // Cだけ
  assert.equal(await c.transform(), false);
  assert.equal(await c.instantSkill(0), false);
  assert.equal(await c.drop('ceiling:2:0'), true);
  c.destroy();
});

test('台詞は1つ戻れて、戻っても盤面ややり直しは起きない', async () => {
  const c = new TutorialController(view, true);
  const indexes: number[] = [];
  c.onPanel = p => { if (p) indexes.push(p.index); };
  void c.play(); await tick(); await tick();
  assert.equal(c.canBack, false); // 最初の台詞
  c.tap(); await tick(); c.tap(); await tick();
  assert.equal(c.canBack, true);
  c.back(); await tick();
  assert.deepEqual(indexes, [0, 1, 2, 1]);
  c.tap(); await tick();
  assert.equal(indexes.at(-1), 2);
  // 場面の切り替わる台詞（1-2の最初）からは戻れない
  for (let i = 0; i < 2; i++) { c.tap(); await tick(); }
  assert.equal(c.canBack, false);
  c.destroy();
});
