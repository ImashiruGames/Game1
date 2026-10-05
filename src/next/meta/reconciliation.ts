import type {LocalSave} from '../app/localSave.ts';
import type {ProfileStore} from './profile.ts';
/** 日本語: ホーム・新規出発より先に未精算の終端を確定する。例外時は元のランを置換しない。
 * English: Reconcile the saved terminal checkpoint before exposing any replacement flow. */
export function reconcileSavedProgress(save:Pick<LocalSave,'guard'|'latest'>,profile:Pick<ProfileStore,'guard'|'settle'>):void {save.guard();profile.guard();const cp=save.latest?.checkpoint;if(cp)profile.settle(cp);}
