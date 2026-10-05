import {NEON_AUDIO_ASSETS} from './neonAudioAssets.ts';
import type {MusicAsset} from './sampleAssets.ts';
const base='/assets/audio/boss-v1/';
export const SPEED_MUSIC:MusicAsset={url:`${base}speedcore_velocity_loop_v1.flac`,fallbackUrl:`${base}speedcore_velocity_loop_v1.pcm16.wav`,loopStartSeconds:0,loopEndSeconds:48,loopWholeBuffer:true};
export const MOTHER_MUSIC:MusicAsset={url:`${base}mothercore_gravity_loop_v1.flac`,fallbackUrl:`${base}mothercore_gravity_loop_v1.pcm16.wav`,loopStartSeconds:0,loopEndSeconds:2560000/48000,loopWholeBuffer:true};
/** Source selection is presentation-only, shared by new battles and save restoration. */
export function musicForEnemy(enemy?:string):MusicAsset{return enemy==='mother-core'?MOTHER_MUSIC:enemy==='speed-core'?SPEED_MUSIC:NEON_AUDIO_ASSETS.music;}
