import test from 'node:test';
import assert from 'node:assert/strict';
import {availableViewportHeight,installViewportHeight} from '../src/next/ui/viewportLayout.ts';
import {feedbackLayerPosition,placeFeedbackBubble} from '../src/next/ui/feedbackLayout.ts';

test('viewport height: old-browser fallback, browser chrome, keyboard and pinch zoom are presentation-only',()=>{
 for(const [inner,visual,scale,want] of [[667,0,1,667],[667,568,1,568],[844,600,1,600],[667,900,1,667],[667,300,2,667]]){
  const view={innerHeight:inner!,visualViewport:visual?{height:visual,scale}:null} as Window;
  assert.equal(availableViewportHeight(view),want);
 }
 assert.equal(availableViewportHeight({innerHeight:NaN,visualViewport:null} as Window),0);
});
test('viewport height: resize/pageshow fallback updates once and removes every listener on disposal',()=>{
 const events=new Map<string,EventListener>(),visualEvents=new Map<string,EventListener>(),writes:string[]=[];
 const visual={height:667,scale:1,addEventListener:(n:string,fn:EventListener)=>visualEvents.set(n,fn),removeEventListener:(n:string)=>visualEvents.delete(n)};
 const view={innerHeight:667,visualViewport:visual,addEventListener:(n:string,fn:EventListener)=>events.set(n,fn),removeEventListener:(n:string)=>events.delete(n)};
 const root={style:{setProperty:(name:string,value:string)=>{assert.equal(name,'--available-viewport-height');writes.push(value);}}};
 const dispose=installViewportHeight(root as unknown as HTMLElement,view as unknown as Window);
 assert.deepEqual(writes,['667px']);events.get('resize')!(new Event('resize'));assert.equal(writes.length,1);
 visual.height=568;visualEvents.get('resize')!(new Event('resize'));assert.equal(writes.at(-1),'568px');
 view.innerHeight=375;visual.height=375;events.get('pageshow')!(new Event('pageshow'));assert.equal(writes.at(-1),'375px');
 dispose();assert.equal(events.size,0);assert.equal(visualEvents.size,0);
});
test('feedback coordinates: viewport edges remain contained after resize and scroll at phone widths',()=>{
 for(const width of [320,375,390,393,414,667,736])for(const height of [240,300,410,600]){
  const view={left:31,top:123,width:width-16,height},label={width:Math.min(280,width-32),height:96};
  for(const scroll of [0,40,170])for(const corner of ['left','right'] as const){
   const layer={left:view.left-12,top:view.top-scroll},cell={left:view.left+(corner==='left'?0:view.width-32),right:view.left+(corner==='left'?32:view.width),top:view.top+height-38,bottom:view.top+height-6};
   const p=feedbackLayerPosition(view,layer,[cell],label,'enemy',16);
   const x=p.x+layer.left,y=p.y+layer.top;
   assert(x-label.width/2>=view.left+6);assert(x+label.width/2<=view.left+view.width-6);
   assert(y-label.height-p.rise>=view.top+6);assert(y<=view.top+height-6);
  }
 }
});
test('feedback DOM placement: remeasurement tracks scroller offsets and new label dimensions without stale positions',()=>{
 let ar={left:20,top:100,width:375,height:300},lr={left:20,top:100},labelWidth=250;
 const values:Record<string,string>={},style={setProperty:(k:string,v:string)=>{values[k]=v;}};
 const area={getBoundingClientRect:()=>ar,clientLeft:0,clientTop:0,get clientWidth(){return ar.width;},get clientHeight(){return ar.height;}};
 const layer={getBoundingClientRect:()=>lr,clientLeft:0,clientTop:0};
 const bubble={isConnected:true,style, get offsetWidth(){return labelWidth;},offsetHeight:90};
 const cell={getBoundingClientRect:()=>({left:ar.left+ar.width-30,right:ar.left+ar.width,top:ar.top+250,bottom:ar.top+280})};
 const place=()=>placeFeedbackBubble(area as HTMLElement,layer as HTMLElement,bubble as unknown as HTMLElement,[cell as HTMLElement],'enemy');
 place();const first={...(style as unknown as {left:string;top:string})};
 lr={left:20,top:30};place();assert.equal(Number.parseFloat((style as unknown as {top:string}).top),Number.parseFloat(first.top)+70);
 ar={...ar,width:304};labelWidth=272;place();assert(Number.parseFloat((style as unknown as {left:string}).left)+136<=298);
 const last=JSON.stringify(style);bubble.isConnected=false;ar={...ar,width:500};place();assert.equal(JSON.stringify(style),last);
 assert(Number.parseFloat(values['--rise']!)>=-10/3);
});
