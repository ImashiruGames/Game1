import numpy as np,json,pathlib
r=pathlib.Path(__file__).parent
x=np.fromfile(r/'checks/render-continuous.f32',dtype='<f4').reshape(-1,2); n=2304000; y=x[2*n:3*n].copy();count=1920
# Preserve exact musical period. Match opening to actual next-cycle continuation then smoothly restore the chosen cycle over 40 ms.
w=(.5-.5*np.cos(np.linspace(0,np.pi,count)))[:,None]
y[:count]=x[3*n:3*n+count]*(1-w)+y[:count]*w
y.astype('<f4').tofile(r/'checks/loop-raw.f32')
