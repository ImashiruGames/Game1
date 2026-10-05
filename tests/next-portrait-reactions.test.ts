import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPortraitReactions,portraitReactionForEvent} from '../src/next/ui/portraitReactions.ts';
import type {BattleEvent} from '../src/next/core/types.ts';
import {kineticDom,KineticNode} from './helpers/kineticDom.ts';

const full={short:false,lowMotion:false};
const attack=(actor:'player'|'enemy'='player'):BattleEvent=>({type:'attack',actor,target:actor==='player'?'enemy':'player',axis:'vertical',linkCount:3,tier:3,damage:3,hpBefore:30,hpAfter:27,overkill:0});
const damage=(target:'player'|'enemy'='enemy',source:'ember'|'pain-shared'|'blue-transformation'|'boss-fixed'='blue-transformation',before=30,after=15):BattleEvent=>({type:'damage',actor:source==='boss-fixed'?'enemy':'player',target,source,damage:before-after,hpBefore:before,hpAfter:after});
const heal=(amount=15):BattleEvent=>({type:'heal',actor:'player',target:'player',source:'health',requestedAmount:15,amount,hpBefore:30,hpAfter:30+amount});

test('actual targets react, axes remain individual, self costs never become an external attack',()=>{
 assert.deepEqual(portraitReactionForEvent(attack()),{target:'enemy',attacker:'player',kind:'hit'});assert.deepEqual(portraitReactionForEvent(attack('enemy')),{target:'player',attacker:'enemy',kind:'hit'});
 assert.equal(portraitReactionForEvent(damage('player','ember')),null);assert.equal(portraitReactionForEvent(damage('player','pain-shared')),null);assert.deepEqual(portraitReactionForEvent(damage('enemy','pain-shared')),{target:'enemy',attacker:'player',kind:'hit'});
 assert.deepEqual(portraitReactionForEvent(damage('player','boss-fixed')),{target:'player',attacker:'enemy',kind:'hit'});
 assert.deepEqual(portraitReactionForEvent({type:'instant-kill',actor:'enemy',target:'player',damage:30,hpBefore:30,hpAfter:0}),{target:'player',attacker:'enemy',kind:'hit'});
});
test('healing at cap stays still while its separately emitted Blue nominal reflection hits the enemy',()=>{
 assert.equal(portraitReactionForEvent(heal(0)),null);assert.deepEqual(portraitReactionForEvent(damage()),{target:'enemy',attacker:'player',kind:'hit'});assert.deepEqual(portraitReactionForEvent(heal()),{target:'player',kind:'heal'});
 assert.equal(portraitReactionForEvent(damage('enemy','blue-transformation',30,30)),null);assert.equal(portraitReactionForEvent(damage('enemy','blue-transformation',-1,-4)),null);assert.equal(portraitReactionForEvent({type:'gauge',before:0,after:3,amount:3,source:'link'}),null);
 const hit=damage('enemy','blue-transformation',2,-13);assert.equal(portraitReactionForEvent(hit)?.kind,'hit');const before=JSON.stringify(hit);for(let i=0;i<20;i++)portraitReactionForEvent(hit);assert.equal(JSON.stringify(hit),before);
});
test('only portraits receive small movement; impact SVG is local, decorative and removed by 240ms',t=>{
 const dom=kineticDom();t.after(()=>dom.restore());const reaction=createPortraitReactions(dom.root.asElement());assert.equal(dom.timers.size,0);assert.equal(reaction.play(attack(),{motion:full}),true);
 const layer=dom.hud.querySelector<KineticNode>('.portrait-reaction-layer')!;assert.equal(layer.getAttribute('aria-hidden'),'true');assert.equal(layer.style.width,'40px');assert.equal(layer.style.height,'42px');assert.equal(layer.style.left,'324px');assert.equal(layer.dataset.target,'enemy');assert.match(layer.innerHTML,/<svg/);
 assert.equal(dom.player.animations.length,1);assert.equal(dom.enemy.animations.length,1);assert.equal(dom.hud.animations.length,0);assert.equal(dom.root.animations.length,0);assert.ok(dom.player.animations[0]!.frames.some(frame=>frame.transform==='translateX(3px)'));assert.ok(dom.enemy.animations[0]!.frames.some(frame=>frame.transform==='translateX(3px) rotate(3deg)'));
 dom.tick(240);assert.equal(layer.isConnected,false);assert.equal(dom.timers.size,0);assert.equal(dom.player.animations[0]!.cancelled,true);reaction.dispose();
});
test('short and low-motion cues are static, short-lived, and positive healing uses only a green ring',t=>{
 const dom=kineticDom();t.after(()=>dom.restore());const reaction=createPortraitReactions(dom.root.asElement());
 for(const motion of [{...full,short:true},{...full,lowMotion:true}]){assert.equal(reaction.play(attack(),{motion}),true);assert.equal(dom.player.animations.length,0);assert.equal(dom.enemy.animations.length,0);const layer=dom.hud.querySelector<KineticNode>('.portrait-reaction-layer')!;assert.equal(layer.animations.length,0);dom.tick(120);assert.equal(layer.isConnected,false);}
 reaction.play(heal(),{motion:full});const layer=dom.hud.querySelector<KineticNode>('.portrait-reaction-layer')!;assert.equal(layer.classList.contains('heal'),true);assert.match(layer.innerHTML,/portrait-heal-ring/);assert.equal(dom.player.animations.length,0);assert.equal(dom.enemy.animations.length,0);reaction.dispose();
});
test('fast axes, self-cost and stale timer cannot stack reactions or erase a newer reaction',t=>{
 const dom=kineticDom();t.after(()=>dom.restore());const reaction=createPortraitReactions(dom.root.asElement());reaction.play(attack(),{motion:full});const stale=[...dom.timers.values()][0]!.fn;
 reaction.play({...attack(),axis:'horizontal'} as BattleEvent,{motion:full});const layer=dom.hud.querySelector<KineticNode>('.portrait-reaction-layer')!;assert.equal(dom.hud.children.filter(node=>node.classList.contains('portrait-reaction-layer')).length,1);assert.equal(dom.player.animations[0]!.cancelled,true);assert.equal(dom.player.animations[1]!.cancelled,false);stale();assert.equal(layer.isConnected,true);
 reaction.play(damage('player','ember'),{motion:full});assert.equal(layer.isConnected,false);assert.equal(dom.timers.size,0);reaction.dispose();
});
test('abort, reset, resize, pagehide, duplicate, disposed and pre-aborted reactions leave no overlays or transforms',t=>{
 const dom=kineticDom();t.after(()=>dom.restore());const reaction=createPortraitReactions(dom.root.asElement());
 const clean=()=>{assert.equal(dom.hud.querySelector('.portrait-reaction-layer'),null);assert.equal(dom.timers.size,0);assert.ok([...dom.player.animations,...dom.enemy.animations].every(a=>a.cancelled));};
 const abort=new AbortController();reaction.play(attack(),{motion:full,signal:abort.signal});abort.abort();clean();reaction.play(attack(),{motion:full});reaction.clear();clean();reaction.play(attack(),{motion:full});dom.fire('resize');clean();reaction.play(attack(),{motion:full});dom.fire('pagehide');clean();
 const event=attack();reaction.play(event,{motion:full});reaction.clear();assert.equal(reaction.play(event,{motion:full}),false);assert.equal(reaction.play(attack(),{motion:full,signal:AbortSignal.abort()}),false);clean();reaction.dispose();assert.equal(reaction.play(attack(),{motion:full}),false);assert.equal(dom.listenerCount('resize'),0);assert.equal(dom.listenerCount('pagehide'),0);
});
test('WAAPI exception cleans partially started effects without altering portrait source or text',t=>{
 const dom=kineticDom();t.after(()=>dom.restore());dom.enemy.animateFault=true;dom.player.setAttribute('src','unchanged.png');const reaction=createPortraitReactions(dom.root.asElement());assert.equal(reaction.play(attack(),{motion:full}),false);assert.equal(dom.player.animations[0]!.cancelled,true);assert.equal(dom.hud.querySelector('.portrait-reaction-layer'),null);assert.equal(dom.timers.size,0);assert.equal(dom.player.getAttribute('src'),'unchanged.png');reaction.dispose();
});
test('live UI and OS motion changes cancel old transforms and use static marks despite stale event options',t=>{
 const dom=kineticDom();t.after(()=>dom.restore());const reaction=createPortraitReactions(dom.root.asElement());
 reaction.play(attack(),{motion:full});dom.settings({short:true,lowMotion:false});assert.equal(dom.hud.querySelector('.portrait-reaction-layer'),null);assert.ok(dom.player.animations.every(a=>a.cancelled));assert.ok(dom.enemy.animations.every(a=>a.cancelled));const count=dom.player.animations.length;
 reaction.play(attack(),{motion:full});assert.equal(dom.player.animations.length,count);dom.settings({short:false,lowMotion:false});reaction.play(attack(),{motion:{short:true,lowMotion:true}});assert.equal(dom.player.animations.length,count);reaction.play(attack(),{motion:full});assert.equal(dom.player.animations.length,count+1);
 dom.systemMotion(true);assert.equal(dom.hud.querySelector('.portrait-reaction-layer'),null);assert.ok(dom.player.animations.every(a=>a.cancelled));reaction.play(attack(),{motion:full});assert.equal(dom.player.animations.length,count+1);dom.systemMotion(false);reaction.clear();reaction.dispose();
});
test('portrait effects have no audio, timers that block gameplay, random draw, data save, full-page shake or image rewrite',()=>{
 const source=readFileSync(new URL('../src/next/ui/portraitReactions.ts',import.meta.url),'utf8'),css=readFileSync(new URL('../src/next/ui/portraitReactions.css',import.meta.url),'utf8');
 assert.doesNotMatch(source,/Math\.random|applyAction|controller\.|localStorage|Audio|setInterval|await\s|async\s|\.src\s*=|setAttribute\(['"]src/);assert.doesNotMatch(css,/grid-template|position:fixed|infinite|brightness|filter:/);assert.match(css,/pointer-events:none/);assert.match(css,/prefers-reduced-motion/);
});
