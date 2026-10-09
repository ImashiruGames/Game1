import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RUBY_COMET_STYLE,applyRubyComet} from '../src/next/ui/rubyDropFlame.ts';
import {createDropMotion} from '../src/next/ui/dropMotion.ts';
import {createRubyDropCandidates} from '../experiments/ruby-auto-drop/candidates.ts';
import {boardSkillDom} from './helpers/boardSkillDom.ts';
import {type KineticNode} from './helpers/kineticDom.ts';
import type {DropEvent} from '../src/next/core/types.ts';
const approved=JSON.parse(readFileSync(new URL('./fixtures/next-ruby-comet-accepted-style.json',import.meta.url),'utf8')).style;
const event=():DropEvent=>({type:'drop',actor:'player',box:{id:'ruby:1',row:7,col:2,owner:'player',type:'normal',status:'normal'},candidateId:'ceiling:2:0',spawn:{row:0,col:2},landing:{row:7,col:2},path:Array.from({length:8},(_,row)=>({row,col:2}))});
test('approved B colors, sizes and placement are unchanged and shared between production and preview',()=>{
 assert.deepEqual(RUBY_COMET_STYLE,approved);const live={innerHTML:'',dataset:{},style:{}},preview={innerHTML:'',dataset:{},style:{}};
 applyRubyComet(live as unknown as HTMLElement);createRubyDropCandidates({} as Document).apply(preview as unknown as HTMLElement,'comet');assert.deepEqual(live,preview);assert.deepEqual(live.style,approved);assert.equal(live.innerHTML,'');assert.deepEqual(live.dataset,{candidate:'comet'});
});
test('production creates one B node per event with no sprite or D particles and clears it at action completion',t=>{
 const dom=boardSkillDom();t.after(()=>dom.restore());dom.cell(7,2).classList.add('player');const ui=createDropMotion(dom.root.asElement()),e=event(),motion={short:false,lowMotion:false};
 assert(ui.play(e,{motion,rubyAutoDrop:true}));const first=dom.area.querySelector<KineticNode>('.ruby-drop-flame')!;assert(first);assert.equal(first.dataset.candidate,'comet');assert.deepEqual(first.style,approved);assert.equal(first.children.length,0);assert.equal(first.animations.length,1);assert.equal(first.parent!.children.length,1);assert.equal(dom.timers.size,1);
 assert(!ui.play(e,{motion,rubyAutoDrop:true}));assert(first.animations[0]!.cancelled);assert.equal(dom.area.querySelector('.ruby-drop-flame'),null);
 assert(ui.play({...e,box:{...e.box,id:'ruby:2'}},{motion,rubyAutoDrop:true}));const second=dom.area.querySelector<KineticNode>('.ruby-drop-flame')!;assert.notEqual(first,second);assert.equal(second.dataset.candidate,'comet');assert.equal(second.children.length,0);dom.tick(180);assert.equal(dom.area.querySelector('.ruby-drop-flame'),null);assert(second.animations[0]!.cancelled);assert.equal(dom.timers.size,0);ui.dispose();
});
test('B is the explicit default; alternate comparisons stay isolated and the pointed legacy reference still works',()=>{
 const source=readFileSync(new URL('../src/next/ui/dropMotion.ts',import.meta.url),'utf8'),comet=readFileSync(new URL('../src/next/ui/rubyDropFlame.ts',import.meta.url),'utf8'),preview=readFileSync(new URL('../experiments/ruby-auto-drop/candidates.ts',import.meta.url),'utf8'),html=readFileSync(new URL('../experiments/ruby-auto-drop/index.html',import.meta.url),'utf8');assert(source.includes('applyRubyComet(flame)'));assert.doesNotMatch(source+comet,/RED_EMBER|red-shell|RUBY_DROP_FLAME_MARKUP|createRubyDropCandidates/);assert(preview.includes('applyRubyComet(node)'));assert(!preview.includes(approved.backgroundImage));assert(html.includes('value="comet" selected'));assert(html.includes('本編の既定は採用済みB案'));
 const old={innerHTML:'',dataset:{},style:{}};applyRubyComet(old as unknown as HTMLElement);createRubyDropCandidates({} as Document).apply(old as unknown as HTMLElement,'original');assert.match(old.innerHTML,/<svg/);assert.equal((old.style as Record<string,string>).backgroundImage,'none');assert.equal((old.style as Record<string,string>).width,'116%');
});
