"""Author dedicated JummBox transformation scores; audio synthesis is official Synth only."""
from pathlib import Path
import json,copy
P=Path(__file__).parent
sources=Path('/workspace/shared/music-production/se-collection-v1/projects')
blue=json.loads((sources/'03_intellectual_direct_damage.jummbox.json').read_text())
red=json.loads((sources/'04_fire_direct_damage.jummbox.json').read_text())
def note(p,points):
 return dict(pitches=p if isinstance(p,list) else [p],points=[dict(tick=t,volume=v,pitchBend=b) for t,v,b in points],continuesLastPattern=False)
def layer(name,template,notes,vol):
 c=copy.deepcopy(template);c['name']=name;c['instruments'][0]['volume']=vol;c['instruments'][0]['envelopes']=[]
 c['patterns']=[dict(notes=notes)];c['sequence']=[1];return c
def save(stem,title,template,channels):
 s=copy.deepcopy(template);s.update(name=title,beatsPerBar=4,beatsPerMinute=300,masterGain=.6,channels=channels)
 (P/(stem+'.jummbox.json')).write_text(json.dumps(s,ensure_ascii=False,indent=2))
# One native tick = 1/120 second. New rising notes + release chord, not renamed attack audio.
save('transform_blue_v1','Cognitive Ascension',blue,[
 layer('Lens charge rises',blue['channels'][0],[note(48,[(0,0,0),(6,25,1),(18,50,5),(36,84,12),(44,0,14)])],-10),
 layer('Ascending logic steps',blue['channels'][1],[note(p,[(t,60,0),(t+5,42,0),(t+10,0,0)]) for t,p in [(6,60),(16,64),(26,67),(36,72)]],-16),
 layer('Prism opens',blue['channels'][0],[note([60,67,72],[(43,0,0),(46,84,0),(54,66,0),(69,28,0),(84,0,0)])],-13),
])
save('transform_red_v1','Flame Ascension',red,[
 layer('Heat charge rises',red['channels'][1],[note(36,[(0,0,0),(8,25,1),(22,55,5),(39,88,12),(46,0,14)])],-11),
 layer('Gathering combustion',red['channels'][2],[note(4,[(0,0,0),(12,17,0),(28,42,1),(42,66,2),(48,0,2)])],-16),
 layer('Flame released',red['channels'][1],[note([48,55],[(44,0,0),(47,93,0),(57,66,-1),(72,28,-3),(86,0,-4)])],-9),
 layer('Dispersing embers',red['channels'][2],[note(5,[(46,0,0),(48,67,0),(57,32,-1),(76,0,-2)])],-18),
])
