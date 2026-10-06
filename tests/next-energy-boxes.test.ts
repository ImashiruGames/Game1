import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {energyBoxMarkup,energyTheme} from '../src/next/ui/energyBox.ts';
import {createEnergyLinks,energyLinkCue} from '../src/next/ui/energyLinks.ts';
import {energyReviewFixture} from '../src/next/ui/energyReviewFixture.ts';
import {rowProjectionReviewFixture} from '../src/next/ui/rowProjectionReviewFixture.ts';
import {createBattle,applyAction} from '../src/next/core/index.ts';
import {createBattleAnimator} from '../src/next/ui/battleAnimator.ts';
import type {BattleAnimationHooks} from '../src/next/ui/battleAnimator.ts';
import type {BattleState} from '../src/next/core/types.ts';
import {boardSkillDom} from './helpers/boardSkillDom.ts';
import {KineticNode} from './helpers/kineticDom.ts';
import {saveNamespace} from '../src/next/app/localSave.ts';
import {presentationSettingsKey} from '../src/next/audio/presentationSettings.ts';
const full={short:false,lowMotion:false};
const axes=()=>{const before=createBattle(energyReviewFixture('axes').config),result=applyAction(before,{type:'drop',candidateId:'ceiling:2:0'});assert(result.accepted);return {before,result,shown:{...before,boxes:result.state.boxes},event:result.resolution!.events.find(e=>e.type==='attack')!};};
function paint(dom:ReturnType<typeof boardSkillDom>,state:BattleState){dom.root.rect={left:0,top:0,width:390,height:600};for(const cell of dom.cells){cell.className='cell';delete cell.dataset.boxId;}for(const box of state.boxes){const cell=dom.cell(box.row,box.col);cell.classList.add(box.owner);cell.dataset.boxId=box.id;}}
const layer=(dom:ReturnType<typeof boardSkillDom>)=>dom.root.querySelector<KineticNode>('.energy-link-layer');
const children=(dom:ReturnType<typeof boardSkillDom>,cls:string)=>layer(dom)?.children.filter(n=>n.classList.contains(cls))??[];

test('unchanged Site79 sources and explicitly authorized 1.3/1.4/experimental balance extensions remain byte-frozen apart from the Ruby display-name rename',()=>{
 const manifest=JSON.parse(readFileSync(new URL('./fixtures/energy-site79-gameplay-manifest.json',import.meta.url),'utf8'));
 const extension=JSON.parse(readFileSync(new URL('./fixtures/next-1.3-authorized-source-manifest.json',import.meta.url),'utf8'));
 const kits=JSON.parse(readFileSync(new URL('./fixtures/next-1.4-authorized-source-manifest.json',import.meta.url),'utf8'));
 const balance=JSON.parse(readFileSync(new URL('./fixtures/next-balance-snapshot-source-manifest.json',import.meta.url),'utf8'));
 const growth=JSON.parse(readFileSync(new URL('./fixtures/next-progression-v2-source-manifest.json',import.meta.url),'utf8'));
 const returns=JSON.parse(readFileSync(new URL('./fixtures/next-explicit-return-source-manifest.json',import.meta.url),'utf8'));
 const rosterPresentation=JSON.parse(readFileSync(new URL('./fixtures/next-roster-presentation-source-manifest.json',import.meta.url),'utf8'));
 const activeFeedback=JSON.parse(readFileSync(new URL('./fixtures/next-active-feedback-source-manifest.json',import.meta.url),'utf8'));
 const interactionExpansion=JSON.parse(readFileSync(new URL('./fixtures/next-interaction-expansion-source-manifest.json',import.meta.url),'utf8'));
 const clarity=JSON.parse(readFileSync(new URL('./fixtures/next-ownership-clarity-source-manifest.json',import.meta.url),'utf8'));
 const monsters=JSON.parse(readFileSync(new URL('./fixtures/next-monster-expansion-source-manifest.json',import.meta.url),'utf8'));
 const lateGrowth=JSON.parse(readFileSync(new URL('./fixtures/next-late-growth-source-manifest.json',import.meta.url),'utf8'));
 const typeInspection=JSON.parse(readFileSync(new URL('./fixtures/next-type-inspection-source-manifest.json',import.meta.url),'utf8'));
 const trophySkills=JSON.parse(readFileSync(new URL('./fixtures/next-trophy-skills-source-manifest.json',import.meta.url),'utf8'));
 const homeMusicControls=JSON.parse(readFileSync(new URL('./fixtures/next-home-music-controls-source-manifest.json',import.meta.url),'utf8'));
 const visibleControls=JSON.parse(readFileSync(new URL('./fixtures/next-visible-controls-source-manifest.json',import.meta.url),'utf8'));
 const alignedTiming=JSON.parse(readFileSync(new URL('./fixtures/next-aligned-timing-source-manifest.json',import.meta.url),'utf8'));
 const preparationReview=JSON.parse(readFileSync(new URL('./fixtures/next-preparation-review-source-manifest.json',import.meta.url),'utf8'));
 const battleUiReview=JSON.parse(readFileSync(new URL('./fixtures/next-battle-ui-review-source-manifest.json',import.meta.url),'utf8'));
 const pacing=JSON.parse(readFileSync(new URL('./fixtures/next-independent-pacing-source-manifest.json',import.meta.url),'utf8'));
 // 日本語: 1.13のホーム画面統一・ステージ／スキル追加で許可した変更。English: Authorized 1.13 design/content changes.
 const design113=JSON.parse(readFileSync(new URL('./fixtures/next-1.13-design-source-manifest.json',import.meta.url),'utf8'));
 // 日本語: 今回はガチャ表示・抽選と生成ガイドだけを許可。English: Only gacha and its generated guide are authorized here.
 const gachaRedesign=JSON.parse(readFileSync(new URL('./fixtures/next-gacha-redesign-source-manifest.json',import.meta.url),'utf8'));
 const deepStart=JSON.parse(readFileSync(new URL('./fixtures/next-deep-start-source-manifest.json',import.meta.url),'utf8'));
 const growth50=JSON.parse(readFileSync(new URL('./fixtures/next-growth50-source-manifest.json',import.meta.url),'utf8'));
 const compactAttackPower=JSON.parse(readFileSync(new URL('./fixtures/next-compact-attack-power-source-manifest.json',import.meta.url),'utf8'));
 // Only display names changed; preserve every other historical source byte.
 for(const [path,hash] of Object.entries({...manifest.files,...extension.files,...kits.files,...balance.files,...growth.files,...returns.files,...rosterPresentation.files,...activeFeedback.files,...interactionExpansion.files,...clarity.files,...monsters.files,...lateGrowth.files,...typeInspection.files,...trophySkills.files,...homeMusicControls.files,...visibleControls.files,...alignedTiming.files,...preparationReview.files,...battleUiReview.files,...pacing.files,...design113.files,...gachaRedesign.files,...compactAttackPower.files,...growth50.files,...deepStart.files})){assert.equal(createHash('sha256').update(['src/next/core/definitions.ts','src/next/main.ts','src/next/meta/home.ts','src/next/meta/roster.ts','src/next/portraits.ts','scripts/docs/build-player-guide.mts','public/docs/game1_content_catalog_next.html','public/docs/game1_content_catalog_next.json'].includes(path)?readFileSync(new URL(`../${path}`,import.meta.url),'utf8').replaceAll('ルビィ','赤の子'):readFileSync(new URL(`../${path}`,import.meta.url))).digest('hex'),hash,path);}
});
test('round own, diamond enemy and square neutral cores retain explicit independent theme data',()=>{
 const box={row:7,col:1,owner:'player' as const};const blue=energyBoxMarkup(box,{characterId:'blue'}),red=energyBoxMarkup(box,{characterId:'red'}),enemy=energyBoxMarkup({...box,owner:'enemy'},{enemyId:'mother-core'}),neutral=energyBoxMarkup({...box,owner:'neutral'},{});
 assert.match(blue,/<circle class="eb-core-fill"/);assert.match(blue,/data-energy-theme="blue"/);assert.match(red,/data-energy-theme="red"/);assert.match(red,/eb-flame-outer/);assert.match(enemy,/M20 14L25.5 20L20 26L14.5 20Z/);assert.match(enemy,/data-energy-theme="mother-core"/);assert.match(neutral,/<rect class="eb-core-fill"/);
 for(const svg of [blue,red,enemy,neutral]){assert.match(svg,/aria-hidden="true" focusable="false"/);assert.doesNotMatch(svg,/>[PEN]</);}
 assert.match(energyBoxMarkup(box,{characterId:'red',transformation:{character:'red',scope:'run',remainingStarts:2}}),/is-transformed/);
 for(const id of ['marujiro','hikikizan','nigirin','merarun','speed-core','mother-core'] as const)assert.equal(energyTheme('enemy',{enemyId:id}),id);
});
test('all four committed axes resolve individually with exact original event IDs and no mutation',()=>{
 const s=axes(),before=JSON.stringify(s);const attacks=s.result.resolution!.events.filter(e=>e.type==='attack');assert.equal(attacks.length,4);
 for(const event of attacks){const cue=energyLinkCue(event,s.result.resolution!.links,s.shown)!;assert(cue);assert.equal(cue.boxes.length,event.linkCount);assert.deepEqual(new Set(cue.boxes.map(b=>b.id)),new Set(s.result.resolution!.links.find(l=>l.axis===event.axis)!.boxIds));}
 assert.equal(JSON.stringify(s),before);
});
test('passive row settling, conversion and non-attack shape/heal/KO events cannot emit link particles',()=>{
 for(const setup of [rowProjectionReviewFixture('reconnect'),energyReviewFixture('red')]){const before=createBattle(setup.config),action=setup.config.characterId==='red'?{type:'board-skill',skillId:'ember'} as const:{type:'board-skill',skillId:'pain-shared',row:6} as const,result=applyAction(before,action);assert(result.accepted);assert(!result.resolution!.events.some(e=>e.type==='attack'));for(const event of result.resolution!.events)assert.equal(energyLinkCue(event,result.resolution!.links,result.state),null);}
});
test('missing, wrong-owner, duplicated, noncontiguous or other-axis IDs fail closed',()=>{
 const s=axes(),links=s.result.resolution!.links;
 assert.equal(energyLinkCue(s.event,[],s.shown),null);assert.equal(energyLinkCue(s.event,links,{...s.shown,boxes:[]}),null);
 assert.equal(energyLinkCue(s.event,links,{...s.shown,boxes:s.shown.boxes.map(b=>({...b,owner:'enemy'}))}),null);
 const axis=s.event.type==='attack'?s.event.axis:'horizontal';for(const ids of [['missing','x','y'],['energy:7:0','energy:7:0','energy:7:0'],['energy:7:0','energy:7:2','energy:7:4']])assert.equal(energyLinkCue(s.event,[{axis,count:3,tier:3,boxIds:ids}],s.shown),null);
});
test('moving axis overlay has one line chain, staggered nodes and particles within unchanged 600ms',t=>{
 const dom=boardSkillDom();t.after(()=>dom.restore());const s=axes();paint(dom,s.shown);const ui=createEnergyLinks(dom.root.asElement());assert.equal(layer(dom),null);
 assert(ui.play(s.event,s.result.resolution!.links,s.shown,new AbortController().signal,full));assert.equal(children(dom,'energy-link-node').length,3);assert.equal(children(dom,'energy-link-line').length,2);assert.equal(children(dom,'energy-attack-particle').length,3);
 assert.deepEqual(children(dom,'energy-link-node').map(n=>n.animations[0]!.options.delay),[0,40,80]);assert.equal(layer(dom)!.getAttribute('aria-hidden'),'true');dom.tick(599);assert(layer(dom));dom.tick(1);assert.equal(layer(dom),null);assert.equal(dom.timers.size,0);ui.dispose();
});
test('a newer axis replaces its prior overlay; stale timeout and abort cannot remove the newer axis',t=>{
 const dom=boardSkillDom();t.after(()=>dom.restore());const s=axes();paint(dom,s.shown);const ui=createEnergyLinks(dom.root.asElement()),events=s.result.resolution!.events.filter(e=>e.type==='attack'),abort=new AbortController();
 ui.play(events[0]!,s.result.resolution!.links,s.shown,abort.signal,full);const stale=[...dom.timers.values()][0]!.fn;ui.play(events[1]!,s.result.resolution!.links,s.shown,new AbortController().signal,full);const latest=layer(dom);assert(latest);assert.equal(dom.root.children.filter(n=>n.classList.contains('energy-link-layer')).length,1);stale();abort.abort();assert.equal(layer(dom),latest);ui.dispose();
});
test('short, UI reduced and OS reduced modes retain stationary axis cues for 150ms, with no particles',t=>{
 const dom=boardSkillDom();t.after(()=>dom.restore());const s=axes();paint(dom,s.shown);const ui=createEnergyLinks(dom.root.asElement());
 for(const motion of [{short:true,lowMotion:false},{short:false,lowMotion:true},full]){if(motion===full)dom.systemMotion(true);assert(ui.play({...s.event},s.result.resolution!.links,s.shown,new AbortController().signal,motion));assert(layer(dom)!.classList.contains('is-still'));assert.equal(children(dom,'energy-attack-particle').length,0);assert(layer(dom)!.children.every(n=>!n.animations.length));dom.tick(150);assert.equal(layer(dom),null);}ui.dispose();
});
test('resize, preference change, abort, pagehide and dispose remove decoration without touching board',t=>{
 const dom=boardSkillDom();t.after(()=>dom.restore());const s=axes();paint(dom,s.shown);const ui=createEnergyLinks(dom.root.asElement()),board=JSON.stringify(dom.cells.map(c=>({classes:c.className,data:c.dataset})));const play=(signal=new AbortController().signal)=>{assert(ui.play({...s.event},s.result.resolution!.links,s.shown,signal,full));};const clean=()=>{assert.equal(layer(dom),null);assert.equal(dom.timers.size,0);assert.equal(JSON.stringify(dom.cells.map(c=>({classes:c.className,data:c.dataset}))),board);};
 play();dom.fire('resize');clean();play();dom.settings({short:false,lowMotion:false});clean();play();dom.board.rect.width--;dom.layout();clean();dom.board.rect.width++;const abort=new AbortController();play(abort.signal);abort.abort();clean();play();dom.fire('pagehide');clean();play();ui.dispose();clean();assert(!ui.play({...s.event},s.result.resolution!.links,s.shown,new AbortController().signal,full));
});
test('unsupported animation remains a static honest cue; missing geometry never changes cells',t=>{
 const dom=boardSkillDom();t.after(()=>dom.restore());const s=axes();paint(dom,s.shown);const ui=createEnergyLinks(dom.root.asElement());dom.failNewAnimations();assert(ui.play(s.event,s.result.resolution!.links,s.shown,new AbortController().signal,full));assert(layer(dom));ui.clear();dom.enemy.remove();assert(!ui.play({...s.event},s.result.resolution!.links,s.shown,new AbortController().signal,full));assert.equal(layer(dom),null);ui.dispose();
});
test('cosmetic hook consumes real active-origin axes sequentially and keeps identical pause/state trace',async()=>{
 const s=axes();const run=async(withEnergy:boolean)=>{const trace:unknown[]=[],cues:string[][]=[];const hooks:BattleAnimationHooks={motion:()=>full,playSound:()=>{},describe:()=>{},observe:()=>{},highlight:ids=>trace.push(['highlight',ids]),render:state=>trace.push(['state',state]),drop:()=>{},react:()=>{},feedback:()=>({remove(){}}),transform:async()=>{},complete:()=>{},pause:async ms=>{trace.push(['pause',ms]);}};if(withEnergy)hooks.energy=(event,links,state)=>{const cue=energyLinkCue(event,links,state);if(cue)cues.push(cue.boxes.map(b=>b.id));};await createBattleAnimator(hooks)(s.result.resolution!,s.before,s.result.state,new AbortController().signal);return {trace,cues};};const baseline=await run(false),visual=await run(true);assert.deepEqual(visual.trace,baseline.trace);assert.equal(visual.cues.length,4);
});
test('QA route has separate gameplay save/lock and presentation settings; normal keys are unchanged',()=>{
 assert.deepEqual(saveNamespace('/next/'),{key:'game1.next.autosave.v1',lock:'game1.next.autosave.owner.v1',preview:false});assert.deepEqual(saveNamespace('/energy-qa/'),{key:'game1.energy-qa.autosave.v1',lock:'game1.energy-qa.autosave.owner.v1',preview:true});assert.notEqual(presentationSettingsKey('/next/'),presentationSettingsKey('/energy-qa/'));
 const source=readFileSync(new URL('../src/next/ui/energyLinks.ts',import.meta.url),'utf8');assert.doesNotMatch(source,/Math\.random|applyAction|localStorage|Audio|setInterval|await\s/);
});
