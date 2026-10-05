import { decodeSave, encodeSave } from './saveCheckpoint.ts';
import type { RunCheckpoint, SaveEnvelope } from './saveCheckpoint.ts';
export function saveNamespace(pathname:string):{key:string;lock:string;preview:boolean}{const route=['save-preview','build-ui-preview','audio-asset-preview','night-qa','energy-qa'].find(name=>pathname===`/${name}`||pathname.startsWith(`/${name}/`));const preview=route!==undefined;const prefix=preview?`game1.${route}`:'game1.next';return {key:`${prefix}.autosave.v1`,lock:`${prefix}.autosave.owner.v1`,preview};}
const namespace=saveNamespace(typeof window==='undefined'?'/next/':window.location.pathname);
export const SAVE_KEY=namespace.key;
export const SAVE_LOCK=namespace.lock;
export const SAVE_PREVIEW=namespace.preview;
export interface SaveStorage { getItem(key:string):string|null;setItem(key:string,value:string):void }
/** 日本語: Web Lockを持つタブだけが読み書きする。例外や競合を黙って無視しない。
 * English: Ownership and exact previous bytes are checked before every action/write. */
export class LocalSave {
 private expected:string|null|undefined=undefined;
 private envelope:SaveEnvelope|null=null;
 private attempted:string|null=null;
 private storage:SaveStorage;
 private owned:()=>boolean;
 constructor(storage:SaveStorage,owned:()=>boolean){this.storage=storage;this.owned=owned;}
 read():SaveEnvelope|null {
  this.owner();let raw:string|null;
  try{raw=this.storage.getItem(SAVE_KEY);}catch{throw new Error('このブラウザの保存領域を読み込めません。設定や空き容量を確認してください。');}
  this.expected=raw;this.envelope=null;
  if(raw!==null)this.envelope=decodeSave(raw);
  return this.envelope;
 }
 get hasExisting():boolean{return this.expected!==undefined&&this.expected!==null;}
 get latest():SaveEnvelope|null{return this.envelope;}
 guard():void {
  this.owner();if(this.expected===undefined)throw new Error('保存内容をまだ確認できていません。');
  let raw:string|null;try{raw=this.storage.getItem(SAVE_KEY);}catch{throw new Error('保存領域を読めないため、進行を停止しました。');}
  if(raw!==this.expected){if(raw!==null&&raw===this.attempted){this.envelope=decodeSave(raw);this.expected=raw;this.attempted=null;}else throw new Error('別の操作でセーブが変更されました。上書きを止めました。ページを開き直して確認してください。');}
 }
 write(checkpoint:RunCheckpoint):SaveEnvelope {
  this.guard();if(this.envelope&&JSON.stringify(this.envelope.checkpoint)===JSON.stringify(checkpoint))return this.envelope;
  const raw=encodeSave(checkpoint,(this.envelope?.revision??0)+1);
  this.attempted=raw;
  try{this.storage.setItem(SAVE_KEY,raw);if(this.storage.getItem(SAVE_KEY)!==raw)throw new Error('verify');}
  catch{throw new Error('自動保存できませんでした。空き容量や保存の許可を確認してください。これ以上の操作は止めています。');}
  this.expected=raw;this.attempted=null;this.envelope=decodeSave(raw);return this.envelope;
 }
 private owner():void{if(!this.owned())throw new Error('このタブには保存の操作権がありません。ほかのプレイ中のタブを閉じてから再開してください。');}
}
/** Exclusive lock lasts for the playable session; there is deliberately no unsafe fallback. */
export class SaveOwnership {
 private held=false;
 private releaseHold:(()=>void)|null=null;
 private acquisition:Promise<boolean>|null=null;
 private epoch=0;
 get owned():boolean{return this.held;}
 acquire(locks:Pick<LockManager,'request'>|undefined):Promise<boolean>{
  if(this.held)return Promise.resolve(true);
  if(this.acquisition)return this.acquisition;
  if(!locks)return Promise.reject(new Error('このブラウザでは複数タブからの安全な保存を利用できません。対応ブラウザで開いてください。'));
  const epoch=++this.epoch;
  this.acquisition=new Promise<boolean>((resolve,reject)=>{
   void locks.request(SAVE_LOCK,{mode:'exclusive',ifAvailable:true},async lock=>{
    if(!lock||epoch!==this.epoch){resolve(false);return;}
    this.held=true;resolve(true);
    await new Promise<void>(release=>{this.releaseHold=release;});
   }).catch(error=>{reject(error);}).finally(()=>{if(epoch===this.epoch){this.held=false;this.releaseHold=null;this.acquisition=null;}});
  });
  return this.acquisition;
 }
 release():void{this.epoch++;this.held=false;this.releaseHold?.();this.releaseHold=null;this.acquisition=null;}
}
