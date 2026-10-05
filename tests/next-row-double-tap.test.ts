import test from 'node:test';
import assert from 'node:assert/strict';
import {createRowDoubleTap,ROW_DOUBLE_TAP_MS} from '../src/next/ui/rowDoubleTap.ts';
test('same-row quick pointer activation confirms once, then requires a fresh pair',()=>{
 let time=0;const gesture=createRowDoubleTap(()=>time),state={};
 assert.equal(gesture.tap(3,state,true),false);time=120;
 assert.equal(gesture.tap(3,state,true),true);time=150;
 assert.equal(gesture.tap(3,state,true),false);
});
test('different rows and an expired interval only replace the preview',()=>{
 let time=0;const gesture=createRowDoubleTap(()=>time),state={};
 gesture.tap(2,state,true);time=100;assert.equal(gesture.tap(3,state,true),false);
 time=100+ROW_DOUBLE_TAP_MS+1;assert.equal(gesture.tap(3,state,true),false);
 time+=ROW_DOUBLE_TAP_MS;assert.equal(gesture.tap(3,state,true),true);
});
test('keyboard, cancellation, projection and lifecycle reset cannot confirm an old pair',()=>{
 const gesture=createRowDoubleTap(()=>10),state={};
 gesture.tap(2,state,true);assert.equal(gesture.tap(2,state,false),false);
 assert.equal(gesture.tap(2,state,true),false);gesture.reset();
 assert.equal(gesture.tap(2,state,true),false);assert.equal(gesture.tap(2,{},true),false);
});
test('invalid rows and a backwards clock never trigger a destructive action',()=>{
 let time=100;const gesture=createRowDoubleTap(()=>time),state={};
 gesture.tap(2,state,true);time=90;assert.equal(gesture.tap(2,state,true),false);
 for(const row of [-1,NaN,1.5])assert.equal(gesture.tap(row,state,true),false);
});
