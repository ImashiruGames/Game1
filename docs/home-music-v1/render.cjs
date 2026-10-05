const fs=require('fs'),crypto=require('crypto');
// Browser-independent harness: all voices and effects are the unmodified official JummBox Synth.
global.window={};global.document={title:""};
const {Song,Synth}=require('./compiled/synth/synth.js');
global.beepbox={...require('./compiled/synth/synth.js'),...require('./compiled/synth/SynthConfig.js')};
const source=JSON.parse(fs.readFileSync('projects/home_starlight_terminal_v1.jummbox.json'));
const song=new Song();song.fromJsonObject(source);
const canonical=song.toJsonObject();fs.writeFileSync('projects/home_starlight_terminal_v1.jummbox.json',JSON.stringify(canonical,null,2));
const compact=song.toBase64String();fs.writeFileSync('projects/home_starlight_terminal_v1.jummbox.url.txt','https://jummb.us/#'+compact+'\n');
const round=new Song(compact);if(round.barCount!==16||round.tempo!==80)throw Error('Roundtrip failed');
const synth=new Synth(song);synth.samplesPerSecond=48000;synth.loopRepeatCount=-1;synth.renderingSong=true;synth.warmUpSynthesizer(song);
const frames=2304000,total=frames*4+4800,out=Buffer.alloc(total*8);let peak=0,nonfinite=0;
for(let pos=0;pos<total;pos+=2048){const n=Math.min(2048,total-pos),l=new Float32Array(n),r=new Float32Array(n);synth.synthesize(l,r,n,true);for(let i=0;i<n;i++){for(let ch=0;ch<2;ch++){const v=ch?r[i]:l[i];peak=Math.max(peak,Math.abs(v));if(!Number.isFinite(v))nonfinite++;out.writeFloatLE(v,8*(pos+i)+4*ch);}}}
fs.writeFileSync('checks/render-continuous.f32',out);
fs.writeFileSync('checks/render-provenance.json',JSON.stringify({renderer:'Unmodified official JummBox Synth',commit:'f745b1c83e46359227a7e324d5f05075c306ac3b',sampleRate:48000,bars:16,bpm:80,cycleFrames:frames,rawPeakDbfs:20*Math.log10(peak),nonfinite,nativeCompactRoundtripPassed:true,sourceSha256:crypto.createHash('sha256').update(fs.readFileSync('projects/home_starlight_terminal_v1.jummbox.json')).digest('hex')},null,2));
console.log({peak,nonfinite,playhead:synth.playhead});
