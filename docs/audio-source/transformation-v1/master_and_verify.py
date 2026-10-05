from pathlib import Path
import json,subprocess,hashlib,numpy as np
from scipy.signal import butter,sosfilt,resample_poly
P=Path(__file__).parent;rate=48000
result=[]
def db(v):return float(20*np.log10(max(float(v),1e-15)))
for char in ['blue','red']:
 stem='transform_'+char+'_v1'
 raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(P/(stem+'.render-f32.wav')),'-f','f32le','-acodec','pcm_f32le','-'])
 x=np.frombuffer(raw,dtype='<f4').reshape(-1,2).astype(float)
 x=sosfilt(butter(2,30,btype='highpass',fs=rate,output='sos'),x,axis=0)
 x[:192]*=np.linspace(0,1,192)[:,None];x[-1440:]*=np.linspace(1,0,1440)[:,None]
 gain=10**(-12.1/20)/np.max(np.abs(resample_poly(x,4,1,axis=0)));x*=gain
 target=P/(stem+'.wav')
 subprocess.run(['ffmpeg','-v','error','-y','-f','f32le','-ar','48000','-ac','2','-i','-','-c:a','pcm_s24le',str(target)],input=x.astype('<f4').tobytes(),check=True)
 final=np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',str(target),'-f','f32le','-']),dtype='<f4').reshape(-1,2)
 measured=dict(peak_dbfs=db(np.max(np.abs(final))),true_peak_dbtp_4x=db(np.max(np.abs(resample_poly(final,4,1,axis=0)))),rms_dbfs=db(np.sqrt(np.mean(final**2))),first_100ms_rms_dbfs=db(np.sqrt(np.mean(final[:4800]**2))),clip_samples=int((np.abs(final)>=1).sum()),nonfinite_samples=int((~np.isfinite(final)).sum()),dc=final.mean(axis=0).tolist(),first_frame=final[0].tolist(),last_frame=final[-1].tolist(),last_1ms_peak_dbfs=db(np.max(np.abs(final[-48:]))))
 assert measured['true_peak_dbtp_4x']<=-12 and measured['clip_samples']==0 and measured['nonfinite_samples']==0
 assert not final[0].any() and not final[-1].any()
 result.append(dict(character=char,id='transformation-'+char,filename=target.name,public_url='/assets/audio/transformation-v1/'+target.name,sha256=hashlib.sha256(target.read_bytes()).hexdigest(),bytes=target.stat().st_size,format='PCM WAV',sample_rate=rate,channels=2,bits=24,frames=len(final),duration_seconds=len(final)/rate,native_project=stem+'.jummbox.json',gain_db=db(gain),metrics=measured))
manifest=dict(version=1,purpose='Two dedicated transformation cues: rising charge then release. Authored native JummBox notes; not reused attack PCM.',production='Official unmodified JummBox Synth render; post-render 30Hz high-pass, static gain to -12.1dBTP, 4ms input/30ms tail edge fades only.',runtime='Decoded PCM playback; existing FX bus unity/master -3dB; no normalization or synthesis.',listening='Numerical QC only. Subjective listening and iPhone device playback unverified.',sounds=result)
(P/'asset-contract.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2));print(json.dumps(manifest,ensure_ascii=False,indent=2))
