'use strict';
// Standalone cosmetic study. No game imports, network calls or persistent storage.
const ICONS = {"player":"<svg class=\"energy-box player\" data-box-type=\"normal\" data-energy-theme=\"blue\" viewBox=\"0 0 40 40\" aria-hidden=\"true\" focusable=\"false\" style=\"--delay:0s\"><rect class=\"eb-glass-body\" x=\"2.5\" y=\"2.5\" width=\"35\" height=\"35\" rx=\"6\"/><rect class=\"eb-glass-bevel\" x=\"5\" y=\"5\" width=\"30\" height=\"30\" rx=\"4\"/><path class=\"eb-glass-shine\" d=\"M8 4.5H16M4.5 10V16M25 35.5H31\"/><path class=\"eb-corner-foot\" d=\"M8 36h4v1H8Zm20 0h4v1h-4Z\"/><ellipse class=\"eb-base-shadow\" cx=\"20\" cy=\"32\" rx=\"7\" ry=\"1.4\"/><g class=\"eb-energy-float\"><ellipse class=\"eb-inner-aura\" cx=\"20\" cy=\"20\" rx=\"12\" ry=\"12\"/><g class=\"eb-blue-energy\"><path class=\"eb-prism-field\" d=\"M20 7L28 13L30 25L20 31L10 25L12 13Z\"/><path class=\"eb-prism-seam\" d=\"M20 7V31M12 13L20 16L28 13M10 25L20 21L30 25\"/><path class=\"eb-core-rim\" d=\"M26.8 20a6.8 6.8 0 1 1-13.6 0 6.8 6.8 0 0 1 13.6 0\"/><circle class=\"eb-core-fill\" cx=\"20\" cy=\"20\" r=\"4.8\"/><path class=\"eb-core-shade\" d=\"M15.4 21.3a4.8 4.8 0 0 0 9-1.2q-5.3 2.3-9 1.2\"/><path class=\"eb-core-glint\" d=\"M17 16.8q3-2 5.3.2l-1.6 1.7q-1.5-1-3 .2Z\"/><circle class=\"eb-dust\" cx=\"28\" cy=\"10\" r=\".6\"/><circle class=\"eb-dust\" cx=\"11\" cy=\"29\" r=\".45\"/></g><g class=\"eb-red-energy\"><g class=\"eb-flame-tongue\"><path class=\"eb-flame-outer\" d=\"M20 6c3 5-1 6 3 9 2-2 2-4 2-4 7 9 6 18-4 21C9 33 8 22 12 17c0 3 2 4 3 4-2-8 5-8 5-15Z\"/><path class=\"eb-flame-edge\" d=\"M15 26c-2-6 5-7 4-15 6 9-1 10 6 15\"/></g><circle class=\"eb-core-rim\" cx=\"20\" cy=\"22\" r=\"6.8\"/><circle class=\"eb-core-fill\" cx=\"20\" cy=\"22\" r=\"4.8\"/><path class=\"eb-flame-inner\" d=\"M20 17c3 2 4 4 2 7-1 2-5 2-5-1 0-2 3-3 3-6Z\"/><circle class=\"eb-dust\" cx=\"28\" cy=\"16\" r=\".6\"/><circle class=\"eb-dust\" cx=\"13\" cy=\"10\" r=\".45\"/></g></g><rect class=\"eb-conversion-wash\" x=\"3\" y=\"3\" width=\"34\" height=\"34\" rx=\"4\"/></svg>","enemy":"<svg class=\"energy-box enemy\" data-box-type=\"normal\" data-energy-theme=\"marujiro\" viewBox=\"0 0 40 40\" aria-hidden=\"true\" focusable=\"false\" style=\"--delay:0s\"><path class=\"eb-glass-body\" d=\"M8 2.5H32L37.5 8V32L32 37.5H8L2.5 32V8Z\"/><path class=\"eb-glass-bevel\" d=\"M9 5H31L35 9V31L31 35H9L5 31V9Z\"/><path class=\"eb-glass-shine\" d=\"M8 4.5H16M4.5 10V16M25 35.5H31\"/><path class=\"eb-corner-foot\" d=\"M8 36h4v1H8Zm20 0h4v1h-4Z\"/><ellipse class=\"eb-base-shadow\" cx=\"20\" cy=\"32\" rx=\"7\" ry=\"1.4\"/><g class=\"eb-energy-float\"><ellipse class=\"eb-inner-aura\" cx=\"20\" cy=\"20\" rx=\"12\" ry=\"12\"/><path class=\"eb-prism-field\" d=\"M20 6L30 20L20 33L10 20Z\"/><path class=\"eb-prism-seam\" d=\"M20 6V33M10 20H30M20 11L27 20L20 28L13 20Z\"/><path class=\"eb-core-rim\" d=\"M20 11.5L28 20L20 28.5L12 20Z\"/><path class=\"eb-core-fill\" d=\"M20 14L25.5 20L20 26L14.5 20Z\"/><path class=\"eb-core-glint\" d=\"M20 14L20 20L14.5 20Z\"/><path class=\"eb-core-shade\" d=\"M20 20L25.5 20L20 26Z\"/><path class=\"eb-glass-shine\" d=\"M29 9l2 2M9 29l2 2\"/></g><rect class=\"eb-conversion-wash\" x=\"3\" y=\"3\" width=\"34\" height=\"34\" rx=\"4\"/></svg>"};
const $ = id => document.getElementById(id);
const clamp = n => Math.max(0,Math.min(1,n));
const mix = (a,b,t) => a+(b-a)*t;
const smooth = t => t*t*(3-2*t);
const duration = 1550;
const titles = ['輪郭の炎','火種のリレー','舞い上がる火の粉','走る連鎖炎'];
const links = {horizontal:[[5,1],[5,2],[5,3]],vertical:[[3,2],[4,2],[5,2]],diagonal:[[3,1],[4,2],[5,3]]};
const media = matchMedia('(prefers-reduced-motion: reduce)');
const scenes = [];
let frame = 0, active = null, queue = [], generation = 0;
$('calm').checked = media.matches;
const intensity = () => Number($('intensity').value);
const quiet = () => media.matches || $('calm').checked;
function say(s){$('status').textContent=s;}
function boardMarkup(axis){
 const targets=links[axis];
 let html='';
 for(let row=0;row<8;row++)for(let col=0;col<6;col++){
  const target=targets.some(([r,c])=>r===row&&c===col);
  const occupied=target||row>=6||(row===5&&[0,4,5].includes(col))||(row===4&&col===5);
  const own=target||((row+col)%3!==0);
  html+='<button type="button" class="cell '+(target?'target ':'')+(!occupied?'empty ':'')+(!own?'enemy-box':'')+'" data-row="'+row+'" data-col="'+col+'" aria-label="'+(row+1)+'行'+(col+1)+'列 '+(occupied?(own?'自分の箱':'敵の箱'):'空きマス')+(target?'・対象リンク':'')+'">'+(occupied?(own?ICONS.player:ICONS.enemy):'')+'</button>';
 }
 return html;
}
for(const card of document.querySelectorAll('article[data-variant]')){
 const stage=card.querySelector('.stage');
 stage.innerHTML='<div class="skill"><span class="skill-icon" aria-label="成長する火・3リンク以上">3+</span><div class="skill-name">成長する火<small>リンクスキル</small></div></div><div class="attack-target">攻撃先</div><div class="board" aria-label="同一の比較用盤面"></div><canvas aria-hidden="true"></canvas><div class="phase" aria-live="off">待機中</div>';
 const canvas=stage.querySelector('canvas');
 const scene={card,stage,canvas,ctx:canvas.getContext('2d'),board:stage.querySelector('.board'),phase:stage.querySelector('.phase'),id:Number(card.dataset.variant),points:[],source:null,enemy:null};
 scene.board.addEventListener('click',e=>{
  const cell=e.target.closest('.cell');if(!cell)return;
  scene.board.querySelectorAll('.selected').forEach(c=>c.classList.remove('selected'));cell.classList.add('selected');
  say(titles[scene.id]+'：'+cell.getAttribute('aria-label')+'を選択。演出中も入力できます。');
 });
 scenes.push(scene);
}
function geometry(s){
 const rect=s.stage.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
 s.canvas.width=Math.round(rect.width*dpr);s.canvas.height=Math.round(rect.height*dpr);
 if(s.ctx)s.ctx.setTransform(s.canvas.width/360,0,0,s.canvas.height/455,0,0);
 const center=e=>{const b=e.getBoundingClientRect();return {x:(b.left+b.width/2-rect.left)*360/rect.width,y:(b.top+b.height/2-rect.top)*455/rect.height,w:b.width*360/rect.width};};
 s.points=links[$('axis').value].map(([row,col])=>center(s.board.querySelector('[data-row="'+row+'"][data-col="'+col+'"]')));
 s.source=center(s.stage.querySelector('.skill-icon'));s.enemy=center(s.stage.querySelector('.attack-target'));
}
function clean(s){if(s.ctx)s.ctx.clearRect(0,0,360,455);s.phase.textContent='待機中';s.card.removeAttribute('data-playing');}
function stop(message){
 generation++;if(frame)cancelAnimationFrame(frame);frame=0;active=null;queue=[];
 scenes.forEach(clean);if(message)say(message);
}
function resetBoards(){
 stop();for(const s of scenes){s.board.innerHTML=boardMarkup($('axis').value);geometry(s);}say('同じ条件で比較できます。案を選んで再生してください。');
}
function path(ctx,points,color,width=1,alpha=1){
 ctx.save();ctx.globalAlpha=clamp(alpha);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';
 ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();ctx.restore();
}
function ring(ctx,p,size,strength=1,alpha=1){
 ctx.save();ctx.globalAlpha=clamp(alpha);ctx.strokeStyle='#ffac4c';ctx.lineWidth=1.4*strength;
 ctx.shadowColor='#fa7132';ctx.shadowBlur=7*strength;ctx.beginPath();ctx.roundRect(p.x-size/2,p.y-size/2,size,size,6);ctx.stroke();
 ctx.shadowBlur=0;ctx.strokeStyle='#ffe5a6';ctx.lineWidth=.65;ctx.stroke();ctx.restore();
}
function ember(ctx,p,r=2,alpha=1){
 ctx.save();ctx.globalAlpha=clamp(alpha);ctx.fillStyle='#ffbd65';ctx.shadowColor='#ff8534';ctx.shadowBlur=7;ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();ctx.restore();
}
function travel(ctx,a,b,t,bend=35){
 const at=u=>({x:mix(a.x,b.x,u)+Math.sin(u*Math.PI)*bend,y:mix(a.y,b.y,u)-Math.sin(u*Math.PI)*24});
 const trail=[];for(let i=0;i<8;i++)trail.push(at(clamp(t-i*.018)));
 path(ctx,trail,'#ff9b42',1.7*intensity(),.8);ember(ctx,at(t),2.5*intensity());
}
function flame(ctx,p,t,strength,tall=false){
 // Flames stay at the upper rim; central ownership marks remain untouched.
 const y=p.y-p.w*.4;
 for(let k=0;k<3;k++){
  const x=p.x+(k-1)*p.w*.26,h=(tall?48:17)*strength*(.8+.15*Math.sin(t*7+k)),w=3.2*strength;
  ctx.save();ctx.globalAlpha=.58;ctx.fillStyle=k===1?'#ffd491':'#ff8638';ctx.beginPath();ctx.moveTo(x-w,y);
  ctx.bezierCurveTo(x-w*2,y-h*.35,x+w*2,y-h*.55,x+Math.sin(k+1)*4,y-h);
  ctx.bezierCurveTo(x+w*2,y-h*.42,x+w,y-h*.25,x+w,y);ctx.closePath();ctx.fill();ctx.restore();
 }
}
function draw(s,ms){
 const ctx=s.ctx;if(!ctx)return;ctx.clearRect(0,0,360,455);
 const t=ms/1000,I=intensity(),points=s.points;
 if(quiet()){
  ring(ctx,s.source,s.source.w+3,I,.85);points.forEach(p=>ring(ctx,p,p.w*.9,I,.8));
  path(ctx,points,'#ebbe7c',.8,.45);
  s.phase.textContent='成長する火 → 対象リンク → 攻撃（静かな表示）';return;
 }
 const fade=clamp((1.46-t)/.25),icon=clamp((.56-t)/.35);
 if(icon>0)ring(ctx,s.source,s.source.w+3+smooth(clamp(t/.3))*3,I,icon);
 for(let i=0;i<points.length;i++){
  const p=points[i],ignite=s.id===1?.44:s.id===3?.18+i*.2:.2,age=t-ignite;
  if(age>=0&&t<1.16){
   const a=clamp(age/.1)*clamp((1.16-t)/.25);
   ring(ctx,p,p.w*.91,I,a);
   if(s.id===0){
    // A traveling accent follows only the perimeter, never across the core.
    const d=p.w*.45,per=[{x:p.x-d,y:p.y-d},{x:p.x+d,y:p.y-d},{x:p.x+d,y:p.y+d},{x:p.x-d,y:p.y+d},{x:p.x-d,y:p.y-d}];
    const u=(age*2+i*.17)%1*4,j=Math.floor(u);ember(ctx,{x:mix(per[j].x,per[j+1].x,u-j),y:mix(per[j].y,per[j+1].y,u-j)},1.8*I,a);
   }
   if(s.id===2||s.id===3&&i===2&&t>.73)flame(ctx,p,t,I,s.id===3);
   if(s.id===1&&age<.32){
    const size=p.w*.91+smooth(age/.32)*9;ring(ctx,p,size,.7*I,(1-age/.32)*.45);
   }
   if(s.id===2){
    const count=Math.round(9*I);for(let j=0;j<count;j++){
     const u=clamp((age-(j%4)*.045)/.75);if(u<=0||u>=1)continue;
     ember(ctx,{x:p.x+Math.sin(j*2.4+i)*p.w*.38+Math.sin(j*3)*u*12,y:p.y-p.w*.43-u*(24+j%5*5)},.65+(j%3)*.35,(1-u)*a);
    }
   }
  }
 }
 if(s.id===1&&t>=.1&&t<.46)points.forEach((p,i)=>travel(ctx,s.source,p,smooth(clamp((t-.1)/.36)),(i-1)*24));
 if(s.id===3&&t>=.05&&t<.72){
  const route=[s.source,...points],index=Math.min(2,Math.floor((t-.05)/.22)),u=clamp((t-.05-index*.22)/.22);
  travel(ctx,route[index],route[index+1],smooth(u),index?0:24);
 }
 if(s.id===0&&t>.2&&t<.92)path(ctx,points,'#ffb768',1,.28);
 if(s.id===2&&t>.16&&t<.95)path(ctx,points,'#ffb768',1,.22);
 if(t>=1.04&&t<1.3){
  const from=s.id===3?points[2]:points[1];travel(ctx,from,s.enemy,smooth(clamp((t-1.04)/.26)),-20);
 }
 if(t>=1.3){
  const u=clamp((t-1.3)/.2);ctx.save();ctx.globalAlpha=(1-u)*.65;ctx.strokeStyle='#ffd394';ctx.lineWidth=1.2;
  ctx.beginPath();ctx.arc(s.enemy.x,s.enemy.y,7+u*11,0,Math.PI*2);ctx.stroke();ctx.restore();
 }
 s.phase.textContent=t<.2?'成長する火が発動':t<1.04?'対象リンクに着火':fade>0?'リンクから攻撃':'完了';
}
function runNext(){
 if(document.hidden){stop('非表示になったため停止しました。');return;}
 const id=queue.shift();if(id===undefined){active=null;frame=0;say('再生完了。同じ条件でもう一度比較できます。');return;}
 const s=scenes[id];scenes.forEach(clean);geometry(s);
 if(!s.ctx){stop('このブラウザーでは Canvas 2D が利用できません。');return;}
 s.card.dataset.playing='true';active={id,started:performance.now(),token:generation};
 const token=generation,scale=Number($('speed').value),end=quiet()?900:duration;
 say(String(id+1).padStart(2,'0')+' '+titles[id]+' を再生中'+(quiet()?'（動きを抑えた表示）':''));
 function tick(now){
  if(token!==generation||!active)return;
  const ms=(now-active.started)*scale;
  if(ms>=end){clean(s);active=null;frame=0;runNext();return;}
  draw(s,ms);frame=requestAnimationFrame(tick);
 }
 frame=requestAnimationFrame(tick);
}
function play(ids){stop();queue=[...ids];runNext();}
document.querySelectorAll('[data-play]').forEach(b=>b.addEventListener('click',()=>play([Number(b.dataset.play)])));
$('play-all').addEventListener('click',()=>play([0,1,2,3]));
$('stop').addEventListener('click',()=>stop('停止しました。'));
$('axis').addEventListener('change',resetBoards);
for(const id of ['intensity','speed','calm'])$(id).addEventListener('change',()=>stop('設定を変更しました。再生すると反映されます。'));
media.addEventListener('change',()=>{if(media.matches)$('calm').checked=true;stop('動きの設定を反映しました。');});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop('非表示になったため停止しました。');});
addEventListener('pagehide',()=>stop());
addEventListener('resize',()=>{stop('表示サイズを変更しました。');scenes.forEach(geometry);});
document.addEventListener('keydown',e=>{if(e.key==='Escape')stop('停止しました。');});
resetBoards();
