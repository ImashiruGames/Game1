import test from 'node:test';import assert from 'node:assert/strict';
import {createProfile} from '../src/next/meta/profile.ts';
import {createProfileImportReader} from '../src/next/meta/profileImport.ts';
import type {ProfileImportUpdate} from '../src/next/meta/profileImport.ts';
const backup=(coins:number)=>JSON.stringify({format:'game1-profile-backup',version:2,profile:{...createProfile(1),coins}});
const deferred=()=>{let resolve!:(text:string)=>void,reject!:(error:Error)=>void;const promise=new Promise<string>((yes,no)=>{resolve=yes;reject=no;});return {file:{size:100,text:()=>promise},resolve,reject};};
test('a newer invalid file clears an old candidate and a slow older success cannot revive it',async()=>{
 const updates:ProfileImportUpdate[]=[],reader=createProfileImportReader(x=>updates.push(x));await reader.select({size:100,text:async()=>backup(99)});assert.equal(updates.at(-1)!.profile!.coins,99);
 const old=deferred(),pending=reader.select(old.file);assert.equal(updates.at(-1)!.profile,null);
 await reader.select({size:10,text:async()=>'invalid JSON'});const count=updates.length;assert.equal(updates.at(-1)!.profile,null);
 old.resolve(backup(77));await pending;assert.equal(updates.length,count);assert.equal(updates.at(-1)!.profile,null);
});
test('newest valid selection survives older success or failure regardless of completion order',async()=>{
 for(const fail of [false,true]){const updates:ProfileImportUpdate[]=[],reader=createProfileImportReader(x=>updates.push(x)),old=deferred(),pending=reader.select(old.file);await reader.select({size:100,text:async()=>backup(222)});const count=updates.length;if(fail)old.reject(new Error('stale failure'));else old.resolve(backup(77));await pending;assert.equal(updates.length,count);assert.equal(updates.at(-1)!.profile!.coins,222);}
});
test('close/cancel invalidates pending reads, and reopening uses only a new selection',async()=>{
 const updates:ProfileImportUpdate[]=[],reader=createProfileImportReader(x=>updates.push(x)),old=deferred(),pending=reader.select(old.file);reader.cancel();const count=updates.length;old.resolve(backup(77));await pending;assert.equal(updates.length,count);await reader.select({size:100,text:async()=>backup(333)});assert.equal(updates.at(-1)!.profile!.coins,333);
});
test('empty selection cancels an older read; oversize and malformed-map backups never become candidates',async()=>{
 const updates:ProfileImportUpdate[]=[],reader=createProfileImportReader(x=>updates.push(x)),old=deferred(),pending=reader.select(old.file);await reader.select(undefined);const count=updates.length;old.resolve(backup(77));await pending;assert.equal(updates.length,count);assert.equal(updates.at(-1)!.profile,null);
 let read=false;await reader.select({size:2_000_001,text:async()=>{read=true;return backup(2);}});assert(!read);assert.equal(updates.at(-1)!.profile,null);
 const invalid=JSON.parse(backup(99));invalid.profile.launches=[];await reader.select({size:100,text:async()=>JSON.stringify(invalid)});assert.equal(updates.at(-1)!.profile,null);
});
