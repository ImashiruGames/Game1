// 日本語: 自動プレイによるバランス測定（表示なし）。勝率の目安を出すための簡易ボットで、人間の上手な手より弱い。
// English: Headless autoplay for balance measurement. A simple bot that gives a floor estimate, weaker than a skilled human.
// usage: node --experimental-strip-types scripts/balance/autoplay.mts [runsPerCell=12]
import {BattleController} from '../../src/next/app/BattleController.ts';
import type {BattleView} from '../../src/next/app/BattleController.ts';
import {prepareTrialSetup} from '../../src/next/config.ts';
import {applyAction,needsTurnStart} from '../../src/next/core/index.ts';
import {getDropOptions} from '../../src/next/core/board.ts';
import {resolveActiveDrop} from '../../src/next/core/activeDrop.ts';
import type {BattleState,EnemyId,CharacterId} from '../../src/next/core/types.ts';

const view:BattleView={render(){},async animate(){}};
type Bot='random'|'greedy';
type Mode='standard'|'deep';
interface BattleLog{stage:number;enemy:EnemyId;turns:number;damageTaken:number;won:boolean}
interface RunLog{bot:Bot;mode:Mode;character:CharacterId;seed:number;reached:number;cleared:boolean;battles:BattleLog[]}

// 日本語: 再現できる小さな乱数（ボット専用。戦闘の乱数とは別）。English: tiny reproducible RNG for the bot only.
function rng(seed:number){let x=(seed^0x9e3779b9)>>>0;return ()=>{x^=x<<13;x>>>=0;x^=x>>17;x^=x<<5;x>>>=0;return x/0x1_0000_0000;};}

const playerLoss=(before:BattleState,after:BattleState)=>Math.max(0,before.hp.player.current-after.hp.player.current);
const enemyLoss=(before:BattleState,after:BattleState)=>Math.max(0,before.hp.enemy.current-after.hp.enemy.current);
/** 日本語: 自分の手のあと、敵が各列に置いた場合の被ダメージ（最大と平均）。English: enemy's best and average immediate reply. */
function threat(state:BattleState):{max:number;mean:number}{
 const s={...state,actor:'enemy' as const},opts=getDropOptions(s).filter(o=>o.available);if(!opts.length)return {max:0,mean:0};
 let max=0,sum=0;for(const o of opts){try{const r=resolveActiveDrop(s,o);const d=playerLoss(s,r.state);max=Math.max(max,d);sum+=d;}catch{/* illegal in this snapshot */}}
 return {max,mean:sum/opts.length};
}
function pickGreedy(state:BattleState):string|null{
 const opts=getDropOptions(state).filter(o=>o.available);let best:string|null=null,bestScore=-Infinity;
 for(const o of opts){
  const r=applyAction(state,{type:'drop',candidateId:o.id});if(!r.accepted)continue;
  if(r.state.hp.enemy.current<=0)return o.id; // 日本語: 倒せるなら即決。English: take the kill.
  const gain=enemyLoss(state,r.state),heal=Math.max(0,r.state.hp.player.current-state.hp.player.current),self=playerLoss(state,r.state);
  const t=r.state.hp.player.current>0?threat(r.state):{max:99,mean:99};
  const score=gain+heal*0.6-self*1.2-(t.max*0.6+t.mean*0.4);
  if(score>bestScore){bestScore=score;best=o.id;}
 }
 return best;
}
function pickRandom(state:BattleState,r:()=>number):string|null{const opts=getDropOptions(state).filter(o=>o.available);return opts.length?opts[Math.floor(r()*opts.length)]!.id:null;}

async function play(bot:Bot,mode:Mode,character:CharacterId,seed:number):Promise<RunLog>{
 const setup=prepareTrialSetup({character,firstEnemy:'marujiro',seed,mode:'manual',stage:1,fixture:'normal',route:'boss-loop',...(mode==='deep'?{ending:'deep50' as const}:{})});
 const c=new BattleController(setup.config,view,setup.options);await c.start();
 const r=rng(seed*7919+(bot==='greedy'?1:2));const battles:BattleLog[]=[];
 let current:BattleLog={stage:1,enemy:c.snapshot.config.enemyId!,turns:0,damageTaken:0,won:false},guard=0;
 while(guard++<20000){
  const run=c.runSnapshot!,s=c.snapshot;
  if(run.status==='lost'||run.status==='cleared'||run.status==='retired'){current.won=run.status==='cleared';battles.push(current);return {bot,mode,character,seed,reached:run.stage,cleared:run.status==='cleared',battles};}
  if(run.status==='reward'){
   const offer=run.offer!;
   if(offer.category==='pending'){const lowHp=s.hp.player.current<s.hp.player.max*0.6;await c.chooseCategory(offer.id,lowHp?'heal':'stats');continue;}
   const pref=['max-health','four-polish','three-polish','five-polish','immediate-heal'] as const;
   const choice=pref.find(id=>offer.choices.includes(id))??offer.choices[0]??null;
   if(current.stage===run.stage){current.won=true;battles.push(current);}
   await c.chooseReward(offer.id,choice);
   const next=c.runSnapshot!;current={stage:next.stage,enemy:c.snapshot.config.enemyId!,turns:0,damageTaken:0,won:false};continue;
  }
  if(s.actor!=='player'||s.result||needsTurnStart(s)){await c.start();if(c.snapshot===s)break;continue;}
  // 日本語: 変化できるなら変化（ゲージ消費のみ）。English: transform whenever allowed.
  if(bot==='greedy'&&await c.transform())continue;
  const id=bot==='greedy'?pickGreedy(s):pickRandom(s,r);if(!id)break;
  const hpBefore=s.hp.player.current;
  if(!await c.drop(id))break;
  current.turns++;current.damageTaken+=Math.max(0,hpBefore-c.snapshot.hp.player.current);
  if(current.turns>600)break;
 }
 battles.push(current);return {bot,mode,character,seed,reached:c.runSnapshot!.stage,cleared:false,battles};
}

const per=Number(process.argv[2]??12);const logs:RunLog[]=[];const t0=Date.now();
for(const mode of ['standard','deep'] as const)for(const character of ['blue','red'] as const)for(const bot of ['random','greedy'] as const)for(let i=0;i<per;i++)logs.push(await play(bot,mode,character,1000+i));
const fmt=(n:number)=>Number.isFinite(n)?n.toFixed(1):'-';
console.log(`runs ${logs.length} in ${((Date.now()-t0)/1000).toFixed(0)}s`);
console.log('\n| モード | キャラ | ボット | クリア率 | 平均到達階 | 中央値 | 1戦の平均ターン |');console.log('|---|---|---|---|---|---|---|');
for(const mode of ['standard','deep'] as const)for(const character of ['blue','red'] as const)for(const bot of ['random','greedy'] as const){
 const g=logs.filter(l=>l.mode===mode&&l.character===character&&l.bot===bot),reach=g.map(l=>l.reached).sort((a,b)=>a-b),turns=g.flatMap(l=>l.battles.filter(b=>b.won).map(b=>b.turns));
 console.log(`| ${mode==='deep'?'深層':'通常'} | ${character==='blue'?'アオイ':'アカリ'} | ${bot==='greedy'?'考える':'ランダム'} | ${Math.round(g.filter(l=>l.cleared).length/g.length*100)}% | ${fmt(reach.reduce((a,b)=>a+b,0)/reach.length)} | ${reach[Math.floor(reach.length/2)]} | ${turns.length?fmt(turns.reduce((a,b)=>a+b,0)/turns.length):'勝ちなし'} |`);
}
// 日本語: 負けた戦闘の敵と、敵ごとの1戦あたり被ダメージ（考えるボットのみ）。English: killers and damage per battle, greedy bot only.
for(const mode of ['standard','deep'] as const){
 const g=logs.filter(l=>l.mode===mode&&l.bot==='greedy'),by=new Map<string,{n:number;dmg:number;lost:number;turns:number}>();
 for(const l of g)for(const b of l.battles){const e=by.get(b.enemy)??{n:0,dmg:0,lost:0,turns:0};e.n++;e.dmg+=b.damageTaken;e.turns+=b.turns;if(!b.won)e.lost++;by.set(b.enemy,e);}
 console.log(`\n${mode==='deep'?'深層':'通常'}・考えるボット：敵ごと`);console.log('| 敵 | 戦闘数 | 1戦の平均被ダメ | 1戦の平均ターン | 負けた回数 |');console.log('|---|---|---|---|---|');
 for(const [id,e] of [...by].sort((a,b)=>b[1].lost-a[1].lost||b[1].dmg/b[1].n-a[1].dmg/a[1].n))console.log(`| ${id} | ${e.n} | ${fmt(e.dmg/e.n)} | ${fmt(e.turns/e.n)} | ${e.lost} |`);
}
import('node:fs').then(fs=>fs.writeFileSync('balance-autoplay.json',JSON.stringify(logs)));
