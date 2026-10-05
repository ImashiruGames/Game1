import {musicForEnemy} from './bossMusic.ts';
import type {MusicAsset} from './sampleAssets.ts';

/** Native JummBox composition, exported as a whole-buffer 48-second loop. */
export const HOME_MUSIC:MusicAsset={
 url:'/assets/audio/home-v1/home_starlight_terminal_v1.flac',
 fallbackUrl:'/assets/audio/home-v1/home_starlight_terminal_v1.wav',
 loopStartSeconds:0,loopEndSeconds:48,loopWholeBuffer:true,
};
export type MusicScene='home'|'battle'|'boss';
interface MusicTarget {setMusicAsset(asset:MusicAsset):Promise<boolean>}

/** Navigation owns the scene; a background/restored battle render does not.
 * Asset replacement delegates cancellation, OFF, hidden and gesture rules to
 * SampleAudioDirector, independently of effects and saved volume settings. */
export class MusicSceneController {
 private target:MusicTarget;
 private current:MusicScene='home';
 constructor(target:MusicTarget){this.target=target;void this.showHome();}
 get scene():MusicScene{return this.current;}
 showHome():Promise<boolean>{this.current='home';return this.target.setMusicAsset(HOME_MUSIC);}
 enterBattle(enemy?:string):Promise<boolean>{
  this.current=enemy==='speed-core'||enemy==='mother-core'?'boss':'battle';
  return this.target.setMusicAsset(musicForEnemy(enemy));
 }
 updateBattle(enemy?:string):Promise<boolean>{
  return this.current==='home'?Promise.resolve(false):this.enterBattle(enemy);
 }
}
