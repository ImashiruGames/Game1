import {validateProfile} from './profile.ts';
import type {Profile} from './profile.ts';
export interface ProfileImportFile {readonly size:number;text():Promise<string>}
export interface ProfileImportUpdate {readonly profile:Profile|null;readonly message:string}
/** 日本語: 最後に選んだファイルだけが復元候補になる。閉じると読込を無効化する。
 * English: Only the latest selection may become a candidate; closing invalidates pending reads. */
export function createProfileImportReader(publish:(update:ProfileImportUpdate)=>void){
 let epoch=0;
 return {
  cancel(){epoch++;},
  async select(file:ProfileImportFile|undefined){
   const selection=++epoch;
   publish({profile:null,message:file?'バックアップを確認中…':''});
   if(!file)return;
   try{
    if(file.size>2_000_000)throw new Error('ファイルが大きすぎます');
    const text=await file.text();if(selection!==epoch)return;
    const data=JSON.parse(text);
    if(data?.format!=='game1-profile-backup'||![1,2].includes(data.version))throw new Error('対応する成長バックアップではありません');
    validateProfile(data.profile);if(data.version!==data.profile.schema)throw new Error('バックアップの版と成長データが一致しません');
    if(selection===epoch)publish({profile:data.profile,message:'内容を確認してから復元してください'});
   }catch(error){if(selection===epoch)publish({profile:null,message:String(error)});}
  },
 };
}
