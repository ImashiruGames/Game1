import { AudioDirector } from './AudioDirector.ts';
/** Owns a tiny persistent control, separate from the game render tree. */
export function mountAudioControls(audio:AudioDirector,host:HTMLElement):()=>void{
  const button=document.createElement('button');button.type='button';button.id='audio-toggle';
  let pending=false,request=0;
  const update=()=>{
    const state=!audio.effectsEnabled?'OFF':pending?'開始中':audio.status==='ready'?'ON':audio.status==='unavailable'?'再試行':'再開';
    button.textContent=`効果音\n${state}`;button.setAttribute('aria-pressed',String(audio.effectsEnabled));
    button.setAttribute('aria-label',`効果音 ${state}。${!audio.effectsEnabled?'タップで開始':pending||audio.status==='ready'?'タップで停止':'タップで再開'}`);
    button.title=audio.effectsEnabled&&audio.status==='unavailable'?'効果音を開始できませんでした。再度タップしてください':'着地・攻撃・回復の効果音。BGMとは別に切り替えます';
  };
  button.addEventListener('click',()=>{
    if(audio.effectsEnabled&&(pending||audio.status==='ready')){request++;pending=false;audio.setEffectsEnabled(false);update();return;}
    const id=++request;pending=true;void audio.enableEffectsGesture().then(()=>{if(id===request){pending=false;update();}});update();
  });
  host.append(button);const unsubscribe=audio.subscribe(update);update();
  const visibility=()=>audio.setHidden(document.hidden);document.addEventListener('visibilitychange',visibility);visibility();
  return ()=>{unsubscribe();document.removeEventListener('visibilitychange',visibility);button.remove();};
}
