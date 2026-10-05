// 日本語: チュートリアル台本（Docsの台本と同じ順）。1つの台詞が1ビート。
// English: The tutorial script, one beat per line, in the same order as the Docs script.
import type { SceneName } from './scenes.ts';

export type Expect =
  | { readonly kind: 'tap' }
  | { readonly kind: 'drop'; readonly col: string }
  | { readonly kind: 'board'; readonly row: number }
  | { readonly kind: 'transform' }
  | { readonly kind: 'category'; readonly category: 'stats' }
  | { readonly kind: 'reward' };

export interface Beat {
  readonly who: 'ao' | 'star';
  readonly text: string;
  readonly expect: Expect;
  /** 場面を固定の配置へ切り替える */
  readonly scene?: SceneName;
  /** 敵が最初に動く場面で、置く列（'wait'は様子見） */
  readonly autoEnemy?: readonly string[];
  /** プレイヤーが操作したあとの敵の手（省略は様子見） */
  readonly enemy?: readonly string[];
  /** 報酬画面で光らせるボタン */
  readonly highlight?: 'heal' | 'stats' | 'skills' | 'board' | 'shape';
}
const tap: Expect = { kind: 'tap' };
const say = (who: Beat['who'], text: string, extra: Partial<Beat> = {}): Beat => ({ who, text, expect: tap, ...extra });

export const beats: readonly Beat[] = [
  // 1-1 あいさつ
  say('ao', 'はじめまして！わたしは青の子。ここは箱を積んで戦う『箱積みの戦場』だよ', { scene: 'hello' }),
  say('ao', '上の▼から箱を落とすと下まで落ちて積み重なっていくの。自分と相手で交互に落としていくよ'),
  say('ao', 'あそこにいるのがチュートリアル星人。今日の練習相手だよ'),
  say('star', 'よろしく〜！'),
  // 1-2 はじめてのリンク
  say('ao', '同じ色の箱が縦・横・ななめに3つ以上並ぶと『リンク』になるの。リンクを作るとモンスターにダメージを与えられるよ', { scene: 'firstLink' }),
  say('ao', 'さっそくやってみよう！光っている列に箱を落としてね', { expect: { kind: 'drop', col: 'C' } }),
  say('ao', 'やったね！3リンクで4ダメージ！'),
  say('star', 'じーっ…'),
  // 1-3 長いリンク
  say('ao', 'リンクは長くするほどもっと大きなダメージになるよ。4つつなげてみよう', { expect: { kind: 'drop', col: 'D' } }),
  say('ao', 'いい感じ！じゃあ次は5つ！', { expect: { kind: 'drop', col: 'E' } }),
  say('star', 'イタタ！'),
  // 1-4 相手の攻撃と塞ぎ方
  say('ao', 'きゃっ！もちろん相手もリンクでダメージを与えてくるから気をつけてね', { scene: 'block', autoEnemy: ['A'] }),
  say('ao', '次にAの上に紫の箱が乗ると4リンクになっちゃう。先に自分の箱を置いて塞いでしまおう！', { expect: { kind: 'drop', col: 'A' }, enemy: ['F'] }),
  say('star', 'むむっ'),
  say('ao', 'こんなふうに攻めるだけじゃなくて『塞ぐ』のも大事だよ'),
  // 1-5 形スキル（ヘルス）
  say('ao', '光っている十字のマークは『形スキル』。決められた形を自分の箱で作ると効果が発動するよ', { scene: 'shape', highlight: 'shape' }),
  say('ao', 'あとひとつで十字になるよ。試しに作ってみよう！', { expect: { kind: 'drop', col: 'C' } }),
  say('ao', 'ヘルスで回復できたね！十字の中の3つ並びもリンクになるから攻撃もしちゃうよ'),
  // 1-6 とどめ
  say('ao', 'あとちょっと！最後は自分でリンクを作ってみて', { scene: 'finish', expect: { kind: 'drop', col: 'D' } }),
  // 2-1 ボーナスの選び方（撃破後に報酬画面が開く）
  say('star', 'やられた〜！'),
  say('ao', '敵を倒すと、ボーナスがもらえるよ'),
  say('ao', 'ここの『今すぐ回復』はHPが減っていてすぐ回復したいときに押そう', { highlight: 'heal' }),
  say('ao', 'ここの『ステータス』は自分のパワーや体力を増やせるんだ！', { highlight: 'stats' }),
  say('ao', 'そしてここの『スキル』では新しいスキルを選べるの', { highlight: 'skills' }),
  say('ao', '一度選ぶとその回は変えられないからよく考えてね。今回は光っている『ステータス』を選んでみよう！', { highlight: 'stats', expect: { kind: 'category', category: 'stats' } }),
  // 2-2 能力アップ
  say('ao', '好きなものを1つ選んでね。迷ったら体力がおすすめだよ', { expect: { kind: 'reward' } }),
  say('ao', '能力が上がったよ！'),
  say('ao', 'こうして能力やスキルを育ててどんどん上の階層まで進んでいこう！'),
  // 3-1 もう一戦
  say('star', 'まだまだ！'),
  say('ao', 'そうだ！『盤面スキル』と『変化』についても話しておかないとだね'),
  // 3-2 盤面スキル
  say('ao', '盤面スキルは光っているこれ！ゲージや体力を使って盤面をちょっと有利にするスキルだよ', { scene: 'boardSkill', highlight: 'board' }),
  say('ao', 'わたしのは『痛みはお互いに』。選んだ横一列を消して1個につき2ダメージ。自分の箱の分は相手へ相手の箱の分は自分へ入るの', { highlight: 'board' }),
  say('ao', 'この列は青が5個で紫が1個。相手に10ダメージで自分に2ダメージだね。さっそく使ってみよう！', { expect: { kind: 'board', row: 7 }, highlight: 'board' }),
  say('ao', '盤面が埋まって相手が箱を置けなくなると『負け』になっちゃう。こうやって空きを作りながらうまく有利に変えていってね'),
  // 3-3 変化
  say('ao', '次は『変化』についてお話しするね。ゲージがたまると使える特別な力。キャラが変身して強い効果をしばらく得られるよ', { scene: 'transform' }),
  say('ao', 'ゲージはターンの経過・リンク攻撃・ダメージを受けたときに少しずつしかたまらないからここぞという戦いで使うのがおすすめかな。変化しても箱を落とす番は減らないよ'),
  say('ao', '今回は特別にもうたまってるよ。押してみよう！', { expect: { kind: 'transform' } }),
  say('ao', 'わたしは『回復した分がそのまま相手への攻撃にもなる』力を持つんだって！十字で回復しながらどんどん倒しちゃおう！', { expect: { kind: 'drop', col: 'C' } }),
  say('star', '参りました〜！'),
  // 3-4 しめくくり
  say('ao', 'これで基本はばっちり！リンクで攻めて相手のリンクは塞いで形スキルと盤面スキルと変化で大逆転！'),
  say('ao', 'わからなくなったらいつでもホームの『？』からこの練習を見直せるよ。じゃあいっしょに上を目指そう！'),
];
