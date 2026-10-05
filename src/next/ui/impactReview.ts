/** Read-only rendered-frame observations, mounted only in the isolated /energy-qa/ route. */
export function installImpactReview(root:HTMLElement):void {
 const game=root.querySelector<HTMLElement>('.game'),details=root.querySelector('#details');if(!game||!details)return;
 const panel=document.createElement('details');panel.innerHTML='<summary>着弾とHPの検証ログ</summary><pre id="impact-review-log" style="white-space:pre-wrap;font-size:11px"></pre>';details.append(panel);
 const output=panel.querySelector('pre')!,records:unknown[]=[];let start=performance.now(),frame=0,previous='',observing=true;
 const read=()=>{
  const layer=game.querySelector<HTMLElement>('.energy-link-layer');
  const particles=Array.from(game.querySelectorAll<HTMLElement>('.energy-attack-particle'));
  const enemy=game.querySelector('#enemy-image')!.getBoundingClientRect(),player=game.querySelector('#player-image')!.getBoundingClientRect();
  const target=layer?.classList.contains('enemy')?player:enemy;
  const gaps=particles.map(p=>{const r=p.getBoundingClientRect();return Math.round(Math.hypot(r.x+r.width/2-target.x-target.width/2,r.y+r.height/2-target.y-target.height/2));});
  const sample={axis:layer?.dataset.axis??null,phase:layer?.dataset.phase??null,player:game.querySelector('#player-hp')?.textContent,enemy:game.querySelector('#enemy-hp')?.textContent,playerFill:(game.querySelector('#player-fill') as HTMLElement)?.style.width,enemyFill:(game.querySelector('#enemy-fill') as HTMLElement)?.style.width,particles:particles.length,gaps,hit:game.querySelector<HTMLElement>('.portrait-reaction-layer')?.dataset.target??null,feedback:game.querySelector('#feedback-layer')?.textContent,result:!!game.querySelector('dialog[open]'),status:game.querySelector('#save-status')?.textContent};
  const key=JSON.stringify(sample);if(key!==previous){previous=key;records.push({ms:Math.round(performance.now()-start),...sample});if(records.length>300)records.shift();output.textContent=JSON.stringify({viewport:{width:innerWidth,height:innerHeight},records},null,2);}
  if(layer&&!frame&&observing)frame=requestAnimationFrame(()=>{frame=0;read();});
 };
 const observer=new MutationObserver(read);observer.observe(game,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['data-phase','open']});read();
 window.addEventListener('pagehide',()=>{observing=false;observer.disconnect();cancelAnimationFrame(frame);},{once:true});
}
