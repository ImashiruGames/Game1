import { readFileSync, writeFileSync } from 'node:fs';
import { skillCatalog, normalSkillIds, skillDescription } from '../src/next/core/skillCatalog.ts';
import { trialTuning } from '../src/next/config.ts';
import { createPlayerBuild, canReceiveSkillReward } from '../src/next/core/playerBuild.ts';
const catalog = {
  revision: '1.8', updated: '2026-10-04', scope: '/next/', title: 'Game1 試作1.8・現在のルールと通常スキル',
  currentRun: ['標準ランは50階の撃破で終了。最終報酬を出さず、結果を保存する', '同じ端末・ブラウザに自動保存。行動の全解決後とカテゴリ・報酬確定を保持し、再開で再抽選しない', '1.1.1の既に開いているランには遡って保存できない。以前の検証用保存は別ルールとして拒否し、確認なしに削除しない', '結果は保存済みの階数・撃破数・HP・ビルド・開始seedを表示。検証途中開始は明記する', '盤面に赤いダメージと緑の実回復量を表示。青の名目回復反射と自己HPコストは別に表示', '攻撃計算・形スキルの数値・ヘルスの回数制限なしは従来どおり'],
  correction: 'ヘルスを固有通常スキルへ訂正。初期固定枠の所持者のみ通常報酬で＋強化できる。非初期所持者には提示・新規取得させない。',
  historicalScope: 'ver1.0のHTML/PDF/Word、ルートのゲーム、25スキル実験は当時の比較資料。この訂正はnextだけに適用する。',
  preserved: ['ヘルス15／20回復、能動投入の起点を含む＋形、1投入につき1回', '戦闘内の回数上限なし。青の名目回復量による連動攻撃を維持', '赤の成長する火は共有報酬のまま。青も取得可能', '回復報酬10、最大HP＋5に現在HP＋5が付随する仕様を維持'],
  futureOnly: '中ボス撃破時やショップでの固有スキル特別強化は将来案。今回実装しない。',
  recoveryPolicy: {
    principle: '今後の回復スキルは厳しく評価し、連戦の消耗を容易に帳消しにする量・頻度・組み合わせを避ける。',
    reviewAxes: ['単体回復量と発動頻度', '通常行動のコストと装備枠の機会費用', '自傷コストの相殺', '追加投入による発動増加', '名目回復量に反応する青の連動攻撃', '入手性・強化・再入手'],
    evidence: '実回復、過剰回復、発動回数、敵からの実HP損失を分け、通常戦・長期戦・ボス・周回で確認する。勝率だけでは判断しない。',
    boundary: '回復の一律禁止や未承認の回数制限を意味しない。',
  },
  fixedPassives:[{id:'poison-craft',name:'毒盛り術',rewardAccess:'never',initialRewardEligible:{blue:false,red:false},effects:[skillDescription('poison-craft',1,trialTuning)],initialFixedHolders:['violet']}],
  skills: normalSkillIds.filter(id=>id!=='poison-craft').map(id => ({ id, name: skillCatalog[id].name, kind: skillCatalog[id].kind,
    rewardAccess: skillCatalog[id].rewardAccess ?? 'shared',
    initialFixedHolders: (['blue','red'] as const).filter(c => createPlayerBuild(c).fixed.id === id),
    baseValues: [...trialTuning.skills[id as Exclude<typeof id,'poison-craft'>]],
    effects: ([1,2] as const).map(rank => skillDescription(id, rank, trialTuning)),
    initialRewardEligible: Object.fromEntries((['blue','red'] as const).map(c=>[c,canReceiveSkillReward(createPlayerBuild(c),id)])),
  })),
};
const esc=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const list=(xs:readonly string[])=>`<ul>${xs.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;
const html=`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${catalog.title}</title><style>:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#101923;color:#e7edf1}*{box-sizing:border-box}body{max-width:900px;margin:auto;padding:24px;line-height:1.8}a{color:#f2d48c}h1{font-size:clamp(23px,5vw,32px)}h2{font-size:23px}h3{margin:0}section,article{border:1px solid #435867;border-radius:10px;background:#182733;padding:20px;margin:18px 0}article p{margin:8px 0}.tag{font-size:14px;color:#f2d48c}.notice{border-color:#b9935d}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.grid article{margin:0}nav{display:flex;gap:18px;flex-wrap:wrap}li{margin:6px 0}@media(max-width:620px){body{padding:18px}.grid{grid-template-columns:1fr}}</style></head><body><nav><a href="/next/">試作を開く</a><a href="/docs/">資料一覧</a><a href="overnight_updates_20261003.html">10月3日の画面・音の更新</a><a href="game1_content_catalog_next.json" download>JSON</a></nav><h1>${catalog.title}</h1><p>ルール改訂 ${catalog.revision} · ${catalog.updated}</p><p>画面・操作の確認版は1.2.27です。能力の数値はこのカタログと同じです。</p><section><h2>画面と音の追加操作（1.2.27）</h2><ul><li>青の行消去は行選択モードで1回タップすると白い横枠で予告。同じ行を素早く2回タップすると確定。「この行を消す」ボタンでも確定できます</li><li>報酬確定後、次の戦闘へ進む時に大きなステージ番号を表示。数字が上から入り、省略や短い静止表示に対応します。50階クリアから51階へは進みません</li><li>効果音のキャラ別設定は青が知的、赤が炎、敵がNeon。手動テーマは両者の攻撃音を上書きできます。青・赤の変化には専用の上昇と開放の音を使います</li><li>音は初めOFF。画面下の効果音ボタンで開始できます。保存済みの手動テーマと音量設定は保持します</li></ul></section><section><h2>1.2のラン・セーブ・表示</h2>${list(catalog.currentRun)}</section><section class="notice"><h2>継続して適用するヘルスの訂正</h2><p>${catalog.correction}</p><p>${catalog.historicalScope}</p>${list(catalog.preserved)}<p>${catalog.futureOnly}</p></section><section><h2>今後の回復スキル</h2><p>${catalog.recoveryPolicy.principle}</p>${list(catalog.recoveryPolicy.reviewAxes)}<p>${catalog.recoveryPolicy.evidence}</p><p>${catalog.recoveryPolicy.boundary}</p></section><h2>通常スキル25種と専用パッシブ</h2><p>通常報酬は取得できる候補から最大3種類。カテゴリ確定後の再抽選はありません。＋を所持中のスキルは候補から外れます。</p><div class="grid">${catalog.skills.map(s=>`<article id="${s.id}"><h3>${s.name}</h3><p class="tag">${s.rewardAccess==='starter-upgrade-only'?'固有通常スキル・初期所持者の＋強化のみ':'共有の通常報酬'}</p><p>通常：${esc(s.effects[0])}<br>＋：${esc(s.effects[1])}</p><p>初期固定所持：${s.initialFixedHolders.map(c=>c==='blue'?'青の子':'赤の子').join('・')||'なし'}</p></article>`).join('')}</div><section><h2>アサシン専用パッシブ：毒盛り術</h2><p>${catalog.fixedPassives[0].effects[0]}。＋強化・共有ガチャ・通常報酬の対象外です。</p></section></body></html>`;
writeFileSync(new URL('../public/docs/game1_content_catalog_next.json',import.meta.url),JSON.stringify({...JSON.parse(readFileSync(new URL('../public/docs/game1_content_catalog_next.json',import.meta.url),'utf8')),...catalog},null,2)+'\n');
writeFileSync(new URL('../public/docs/game1_content_catalog_next.html',import.meta.url),html+'\n');
