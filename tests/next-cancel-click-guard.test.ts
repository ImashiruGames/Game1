import test from 'node:test';
import assert from 'node:assert/strict';
import {createCancelClickGuard} from '../src/next/ui/cancelClickGuard.ts';
const point={clientX:230,clientY:570,detail:1};
test('a replaced button cannot receive a second rapid pointer activation at the cancelled location',()=>{
 let time=0;const guard=createCancelClickGuard(()=>time);guard.mark(point);
 time=10;assert.equal(guard.blocks({...point,detail:2}),true);
 time=499;assert.equal(guard.blocks({...point,clientX:233,clientY:572}),true);
 time=500;assert.equal(guard.blocks(point),false);
});
test('an intentional next click elsewhere is immediate and ends the same-location latch',()=>{
 const guard=createCancelClickGuard(()=>0);guard.mark(point);
 assert.equal(guard.blocks({...point,clientX:240}),false);assert.equal(guard.blocks(point),false);
});
test('keyboard cancellation and keyboard activation never wait on pointer guards',()=>{
 const guard=createCancelClickGuard(()=>0);guard.mark(point);assert.equal(guard.blocks({...point,detail:0}),false);
 guard.mark({...point,detail:0});assert.equal(guard.blocks(point),false);
});
test('reset clears the transient guard and never needs storage or a timer',()=>{
 const guard=createCancelClickGuard(()=>0);assert.equal(guard.blocks(point),false);guard.mark(point);guard.reset();assert.equal(guard.blocks(point),false);
});
