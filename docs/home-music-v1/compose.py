import json,copy,pathlib
R=pathlib.Path(__file__).parent
old=json.load(open(R.parent/'audio-source/neon_undertow_game_loop.jummbox.json'))
s={k:copy.deepcopy(v) for k,v in old.items() if k!='channels'}
s.update(name='Home — Starlight Terminal',loopBars=16,beatsPerMinute=80,channels=[])
def inst(i,vol,pan=0):
 d=copy.deepcopy(old['channels'][i]['instruments'][0]);d['volume']=vol;d['pan']=pan;return d
def note(p,t,d,v=70,end=None):
 return {'pitches':p if isinstance(p,list) else [p], 'points':[{'tick':t,'pitchBend':0,'volume':v},{'tick':t+d,'pitchBend':0,'volume':v if end is None else end}]}
def channel(name,instrument,bars,typ='pitch'):
 s['channels'].append({'type':typ,'name':name,'instruments':[instrument],'patterns':[{'notes':b,'instruments':[1]} for b in bars],'sequence':list(range(1,17))})
# Four-bar harmonic phrases, changing voicings and response contours in the B section.
roots=[28,25,21,23,28,25,21,23,20,25,21,23,28,25,21,23]
chords=[[52,56,59,66],[49,52,56,63],[45,49,52,59],[47,51,54,61]]*2+[[44,47,51,59],[49,52,56,63],[45,49,52,59],[47,51,54,61]]+[[52,56,59,66],[49,52,56,63],[45,49,52,59],[47,51,54,61]]
bass=inst(0,-12);bass['operators'][1]['amplitude']=2;bass['feedbackAmplitude']=0;bass['fadeInSeconds']=.013
channel('Soft orbit bass',bass,[[note(r,0,5,69,45),note(r+12,7,2,47,20),note(r+7,10,4,52,25)] for r in roots])
pad=inst(3,-2,-12);pad['feedbackAmplitude']=0;pad['operators'][1]['amplitude']=2;pad['reverb']=27;pad['chorus']=25;pad['fadeInSeconds']=.18
channel('Windowlight chords',pad,[[note(c,0,14.5,48,28)] for c in chords])
lead=inst(2,-1,12);lead['echoSustain']=20;lead['echoDelayBeats']=.75;lead['reverb']=19;lead['fadeOutTicks']=8
# Distinct singable 3+2+rest motif and answering descent. Notes are native JummBox piano-roll events.
mel=[[(64,0,2),(68,3,1),(71,5,3),(66,10,2),(64,13,2)],[(63,1,3),(64,5,2),(68,8,3)],[(64,0,3),(61,4,2),(59,7,3),(61,12,2)],[(63,1,2),(66,4,3),(63,9,2),(59,12,2)],[(64,0,2),(68,3,1),(71,5,3),(73,10,2),(71,13,2)],[(68,1,3),(64,5,2),(63,9,3)],[(61,0,3),(64,4,2),(66,7,3),(64,12,2)],[(63,1,3),(59,6,2),(66,10,3)],[(71,0,3),(68,4,2),(66,8,3)],[(68,1,2),(73,4,3),(71,9,2),(68,12,2)],[(69,0,3),(68,4,2),(64,8,3)],[(66,1,3),(63,6,2),(59,10,3)],[(64,0,2),(68,3,1),(71,5,3),(66,10,2),(64,13,2)],[(63,1,3),(64,5,2),(68,8,3)],[(64,0,3),(61,4,2),(59,8,2)],[(63,1,2),(66,4,3),(63,9,2),(59,12,2)]]
channel('Starlight signature',lead,[[note(p,t,d,74 if j==0 else 66,42) for j,(p,t,d) in enumerate(bar)] for bar in mel])
arp=inst(2,-15,-28);arp['echoSustain']=14;arp['reverb']=16;arp['operators'][1]['frequency']='3×';arp['operators'][1]['amplitude']=2
channel('Playful satellite answers',arp,[[note(c[(j+i)%4]+12,t,.65,40,15) for j,t in enumerate([2,6,11,14])] if i%4 in [1,3] else [note(c[3]+12,14,.6,34,10)] for i,c in enumerate(chords)])
kick=inst(4,-20)
channel('Soft landing pulse',kick,[[{'pitches':[39],'points':[{'tick':t,'pitchBend':0,'volume':60},{'tick':t+.25,'pitchBend':-20,'volume':42},{'tick':t+1,'pitchBend':-26,'volume':0}]} for t in ([0,8] if i%4!=3 else [0])] for i in range(16)])
hat=inst(6,-18,22);hat['reverb']=4
channel('Tiny clock dust',hat,[[note(8,t,.3,26 if j%2 else 33,0) for j,t in enumerate([2,6,10,14])] for i in range(16)],'drum')
(R/'projects/home_starlight_terminal_v1.jummbox.json').write_text(json.dumps(s,indent=2))
