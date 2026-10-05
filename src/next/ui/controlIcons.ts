/** 日本語: 45度ごとの同形8歯。English: Eight identical teeth, exactly symmetric around (12,12). */
export const SETTINGS_GEAR_PATH=Array.from({length:8},(_,tooth)=>[-22.5,-10,10,22.5].map((offset,index)=>{
 const angle=(tooth*45+offset)*Math.PI/180,radius=index===0||index===3?7.7:10;
 return `${tooth===0&&index===0?'M':'L'}${(12+radius*Math.cos(angle)).toFixed(3)} ${(12+radius*Math.sin(angle)).toFixed(3)}`;
}).join(' ')).join(' ')+' Z';
/** 日本語: 小さな操作記号も名前・状態を別に持つ。English: Icons supplement accessible names and state. */
export function controlIcon(name:'bell'|'music'|'settings'|'home',off=false):string{
 const paths={bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',music:'<path d="M9 18V5l11-2v13M9 8l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="17" cy="16" rx="3" ry="2"/>',settings:`<path d="${SETTINGS_GEAR_PATH}"/><circle cx="12" cy="12" r="3.2"/>`,home:'<path d="m3 11 9-8 9 8M5 10v11h5v-7h4v7h5V10"/>'};
 return `<svg class="control-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name]}${off?'<path class="icon-off-slash" d="m3 3 18 18" stroke-width="2.5"/>':''}</svg>`;
}
