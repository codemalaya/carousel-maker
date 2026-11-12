"""PROTOTIPE (Python + Pillow, tanpa numpy): ganti pin hijau chroma di foto dengan desain lain.
Dipakai sebagai referensi hasil untuk port TypeScript (todo.md bagian 9). Bukan bagian dari aplikasi.

Pemakaian (dari folder yang berisi logo-icon.png):
  python3 pin-photo-prototype.py FOTO.png HASIL.png "#ffffff,#1d3f66,..." [grow] [shift_x shift_y]

Nilai yang dipakai pada foto contoh (todo.md): tote hijau sedang 1.12 -0.035 -0.02, tote neon 1.06, ransel 1.08, tangan 1.05.
"""
import sys, math, json
from PIL import Image, ImageDraw, ImageFilter
from collections import deque

def find_discs(im, min_area=4000):
    w,h=im.size; px=im.load()
    mask=bytearray(w*h)
    for y in range(h):
        for x in range(w):
            r,g,b=px[x,y]
            # relative to the green's own brightness, so both neon (9,232,26) and muted (1,169,63) keys are found; a darker real green (a notebook) is not
            if g>100 and r<0.3*g and g-max(r,b)>0.58*g: mask[y*w+x]=1
    seen=bytearray(w*h); comps=[]
    for i in range(w*h):
        if mask[i] and not seen[i]:
            q=deque([i]); seen[i]=1; pts=[]
            while q:
                j=q.popleft(); pts.append(j); x=j%w; y=j//w
                for nx,ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
                    if 0<=nx<w and 0<=ny<h:
                        k=ny*w+nx
                        if mask[k] and not seen[k]: seen[k]=1; q.append(k)
            if len(pts)>=min_area: comps.append(pts)
    discs=[]
    for pts in comps:
        # fill glare holes: per-row span fill
        rows={}
        for j in pts:
            y=j//w; x=j%w
            lo,hi=rows.get(y,(x,x)); rows[y]=(min(lo,x),max(hi,x))
        n=0;sx=sy=sxx=syy=sxy=0.0
        for y,(lo,hi) in rows.items():
            for x in range(lo,hi+1):
                n+=1;sx+=x;sy+=y;sxx+=x*x;syy+=y*y;sxy+=x*y
        cx=sx/n;cy=sy/n
        vxx=sxx/n-cx*cx;vyy=syy/n-cy*cy;vxy=sxy/n-cx*cy
        t=0.5*math.atan2(2*vxy,vxx-vyy)
        tr=(vxx+vyy)/2;d=math.sqrt(max(0,((vxx-vyy)/2)**2+vxy**2))
        l1=tr+d;l2=max(tr-d,1e-6)
        a_,b_=2*math.sqrt(l1),2*math.sqrt(l2)
        if a_/b_<1.08: a_=b_=(a_+b_)/2; t=0.0   # near-circle: the ratio is detection noise, do not shear the design
        discs.append(dict(cx=cx,cy=cy,a=a_,b=b_,theta=t,area=n))
    return discs

def order(discs):  # reading order, rows grouped
    return sorted(discs,key=lambda d:(round(d['cy']/80),d['cx']))

def ellipse_mask(size,d,scale=1.0,ss=4,feather=1.0):
    w,h=size
    m=Image.new("L",(w*ss,h*ss),0); dr=ImageDraw.Draw(m)
    pts=[]
    for k in range(180):
        u=2*math.pi*k/180
        x=d['a']*scale*math.cos(u); y=d['b']*scale*math.sin(u)
        X=d['cx']+x*math.cos(d['theta'])-y*math.sin(d['theta'])
        Y=d['cy']+x*math.sin(d['theta'])+y*math.cos(d['theta'])
        pts.append((X*ss,Y*ss))
    dr.polygon(pts,fill=255)
    m=m.resize((w,h),Image.LANCZOS)
    return m.filter(ImageFilter.GaussianBlur(feather*0.5)) if feather else m

def ambient(photo, d):
    """Median colour of the non-green surface around the pin (the light the pin sits in)."""
    w,h=photo.size; px=photo.load(); vals=[]
    R=max(d['a'],d['b'])
    for k in range(0,360,6):
        for t in (1.28,1.4,1.52):
            x=int(d['cx']+R*t*math.cos(math.radians(k))); y=int(d['cy']+R*t*math.sin(math.radians(k)))
            if 0<=x<w and 0<=y<h:
                r,g,b=px[x,y]
                if g-max(r,b)<6: vals.append((r,g,b))
    if not vals: return (235,235,235)
    return tuple(sorted(v[i] for v in vals)[len(vals)//2] for i in range(3))

def bilinear(img_px, size, x, y):
    x=min(max(x,0),size-1.001); y=min(max(y,0),size-1.001)
    x0=int(x); y0=int(y); fx=x-x0; fy=y-y0
    p00=img_px[x0,y0];p10=img_px[x0+1,y0];p01=img_px[x0,y0+1];p11=img_px[x0+1,y0+1]
    return tuple(p00[i]*(1-fx)*(1-fy)+p10[i]*fx*(1-fy)+p01[i]*(1-fx)*fy+p11[i]*fx*fy for i in range(3))

def neutralize_rim(out, orig, d, mask, outer=1.08):
    """The pin's rim blends with the green key. Where the ORIGINAL was green-dominant, replace the pixel by a neutral of the same darkness."""
    w,h=orig.size; po=orig.load(); oo=out.load()
    ring=ellipse_mask((w,h),d,scale=outer,feather=0).load(); core=mask.load()
    R=max(d['a'],d['b'])*outer+3
    for y in range(max(0,int(d['cy']-R)),min(h,int(d['cy']+R))):
        for x in range(max(0,int(d['cx']-R)),min(w,int(d['cx']+R))):
            if ring[x,y] and core[x,y]<200:
                r,g,b=po[x,y]; gd=g-max(r,b)
                if gd>2:
                    wgt=min(1.0,gd/22.0)
                    L=max(r,b)*1.0
                    orr,og,ob=oo[x,y]
                    oo[x,y]=(int(orr+(L-orr)*wgt),int(og+(L-og)*wgt),int(ob+(L-ob)*wgt))

def edge_unmix(out, orig, d, layer, box, lo=0.93, hi=1.1, grow=1.0):
    """Edge pixels are a mix of the green key and what is under it. Estimate the green share (alpha) from the original, subtract that share
    (P = a*G0 + (1-a)*U  ->  U = (P - a*G0)/(1-a)) and put the new print in its place: out = a*print + (1-a)*U.
    Pixels with no green (a = 0) stay exactly as photographed, so cloth texture and the cast shadow are untouched."""
    w,h=orig.size; po=orig.load(); oo=out.load(); lp=layer.load(); x0,y0=box
    R=(d['a']+d['b'])/2
    # the pure key colour: median of the disc interior
    pts=[po[int(d['cx']+R*0.55*math.cos(t)),int(d['cy']+R*0.55*math.sin(t))] for t in [k*0.5 for k in range(13)]]
    g0=tuple(sorted(p[i] for p in pts)[len(pts)//2] for i in range(3))
    gd0=max(1,g0[1]-max(g0[0],g0[2]))
    for y in range(max(0,int(d['cy']-R*hi-2)),min(h,int(d['cy']+R*hi+3))):
        for x in range(max(0,int(d['cx']-R*hi-2)),min(w,int(d['cx']+R*hi+3))):
            dx=x-d['cx'];dy=y-d['cy']; dist=math.hypot(dx,dy); rr=dist/R
            if rr<lo or rr>hi: continue
            pr,pg,pb=po[x,y]; gd=pg-max(pr,pb)
            if gd<=3 or (rr<grow*0.985 and grow>1.0): continue   # no green here, or already covered by the (larger) new disc: keep what is there
            ag=max(0.0,min(1.0,gd/(gd0*0.85)))
            if ag>0.92:                              # (almost) pure key colour: nothing of the original survives, use the surface just outside
                ex,ey=(dx/dist,dy/dist) if dist>0 else (1,0)
                sx=min(max(int(d['cx']+ex*R*1.08),0),w-1); sy=min(max(int(d['cy']+ey*R*1.08),0),h-1)
                ur,ug,ub=po[sx,sy]; ag=1.0
            else:
                ur=(pr-ag*g0[0])/(1-ag); ug=(pg-ag*g0[1])/(1-ag); ub=(pb-ag*g0[2])/(1-ag)
                ur,ug,ub=max(0,min(255,ur)),max(0,min(255,ug)),max(0,min(255,ub))
                # the unmixed colour can keep a little green from noise: never greener than the larger of R/B
                m=max(ur,ub); ug=min(ug,m+2)
                ug=max(ug,(ur+ub)/2*0.93)   # removing green must not leave magenta: keep G near the mean of R and B
            fr,fg,fb=lp[min(max(x-x0,0),layer.size[0]-1),min(max(y-y0,0),layer.size[1]-1)]
            oo[x,y]=(int(ag*fr+(1-ag)*ur),int(ag*fg+(1-ag)*ug),int(ag*fb+(1-ag)*ub))

def final_despill(out, d, inner=0.86, outer=1.14, grow=1.0):
    """Last pass on the edge band: green may not exceed the larger of R/B (classic despill). The prints used here contain no green, so this only removes key spill."""
    w,h=out.size; oo=out.load()
    band=ellipse_mask((w,h),d,scale=outer,feather=0).load(); core=ellipse_mask((w,h),d,scale=inner,feather=0).load()
    R=max(d['a'],d['b'])*outer+3
    for y in range(max(0,int(d['cy']-R)),min(h,int(d['cy']+R))):
        for x in range(max(0,int(d['cx']-R)),min(w,int(d['cx']+R))):
            if band[x,y] and not core[x,y]:
                r,g,b=oo[x,y]; m=max(r,b)
                if g>m+6: oo[x,y]=(m,m,m)          # clearly keyed pixel: the metal rim is neutral grey, not teal
                elif g>m: oo[x,y]=(r,m,b)

def replace(photo, discs, faces, shrink=0.965, seed=7, grow=1.0, shift=(0.0,0.0)):
    import random
    rnd=random.Random(seed)
    out=photo.copy(); w,h=photo.size
    po=photo.load(); layers=[]
    for i,d in enumerate(discs):
        Rg=(d['a']+d['b'])/2
        d=dict(d,cx=d['cx']+shift[0]*Rg,cy=d['cy']+shift[1]*Rg)   # the rim is thicker on the side we look from: centre the new disc on the rim, not on the green
        face=faces[i%len(faces)]
        pre=int(2.0*2*max(d['a'],d['b']))
        face=face.resize((pre,pre),Image.LANCZOS); Sd=pre; fp=face.load()
        c,s=math.cos(d['theta']),math.sin(d['theta'])
        ia,ib=1/(d['a']*grow),1/(d['b']*grow)
        m00=c*c*ia+s*s*ib; m01=c*s*(ia-ib); m10=m01; m11=s*s*ia+c*c*ib
        amb=ambient(photo,d); amax=max(amb)
        # light on the print: brightness of the surrounding light, only partly tinted (a white print stays nearly white)
        bright=0.99
        tint=tuple(1+0.18*(amb[k]/amax-1) for k in range(3))
        Rm=max(d['a'],d['b'])*grow+6
        x0=max(0,int(d['cx']-Rm));x1=min(w,int(d['cx']+Rm));y0=max(0,int(d['cy']-Rm));y1=min(h,int(d['cy']+Rm))
        # baseline of min(R,B) inside the disc, to isolate the specular glare
        samples=[]
        mask=ellipse_mask((w,h),d,scale=(grow*0.985 if grow>1.0 else shrink)); mk=mask.load()
        for y in range(y0,y1,3):
            for x in range(x0,x1,3):
                if mk[x,y]>250: r,g,b=po[x,y]; samples.append(min(r,b))
        samples.sort(); p0=samples[len(samples)//2] if samples else 0
        layer=Image.new("RGB",(x1-x0,y1-y0)); lp=layer.load()
        for y in range(y0,y1):
            for x in range(x0,x1):
                dx=x-d['cx'];dy=y-d['cy']
                mx=m00*dx+m01*dy; my=m10*dx+m11*dy          # design-normalised coords (-1..1 across the disc)
                rr=min(1.0,math.hypot(mx,my))
                lens=1-0.03*rr*rr                              # convex glass: print looks slightly compressed toward the rim
                fr,fg,fb=bilinear(fp,Sd,Sd/2*(1+mx*lens),Sd/2*(1+my*lens))
                lx=-(mx*0.62+my*0.78)                          # +1 toward the light (top-left), -1 away
                shade=1+0.045*lx
                rim=1-0.06*rr**4-0.07*max(0.0,-lx)*rr**3       # edge falls off, more on the side away from the light
                blob=0.10*math.exp(-((mx+0.38)**2+(my+0.48)**2)/0.16)   # soft diffuse highlight
                r0,g0,b0=po[x,y]
                gl=max(0.0,min(1.0,(min(r0,b0)-p0)/max(1,255-p0)))*0.9   # real specular glare from the photo
                outc=[]
                # print under gloss is punchier than a flat render: lift saturation a little
                lum=0.299*fr+0.587*fg+0.114*fb
                fr,fg,fb=(lum+(fr-lum)*1.10, lum+(fg-lum)*1.10, lum+(fb-lum)*1.10)
                # bevelled rim: thin bright band on the lit side, thin dark band on the far side
                eband=max(0.0,min(1.0,(rr-0.90)/0.07))*(1-max(0.0,min(1.0,(rr-0.985)/0.015)))
                rimlight=0.42*eband*max(0.0,lx); rimdark=0.16*eband*max(0.0,-lx)
                for k,f in enumerate((fr,fg,fb)):
                    v=f*bright*tint[k]*shade*rim
                    v=v*(1-rimdark)
                    v=v*(1-rimlight)+255*rimlight
                    v=v*(1-blob)+255*blob
                    v=v*(1-gl)+255*gl
                    v+=rnd.gauss(0,1.3)
                    outc.append(max(0,min(255,int(v))))
                lp[x-x0,y-y0]=tuple(outc)
        layer=layer.filter(ImageFilter.GaussianBlur(0.35))   # the photo is slightly soft
        lp=layer.load(); oo=out.load(); layers.append((d,layer,(x0,y0)))
        for y in range(y0,y1):
            for x in range(x0,x1):
                a=mk[x,y]
                if a==0: continue
                t=a/255; orr,og,ob=oo[x,y]; nr,ng,nb=lp[x-x0,y-y0]
                oo[x,y]=(int(orr+(nr-orr)*t),int(og+(ng-og)*t),int(ob+(nb-ob)*t))
    for d,layer,box in layers: edge_unmix(out,photo,d,layer,box,grow=grow)
    for d,_,_ in layers: final_despill(out,d,inner=0.86*grow,outer=1.14*max(1.0,grow))
    return out

def face(bg, logo, size=900, frac=0.54):
    f=Image.new("RGB",(size,size),bg)
    L=logo.resize((int(size*frac),)*2,Image.LANCZOS)
    f.paste(L,((size-L.size[0])//2,(size-L.size[1])//2),L)
    return f

if __name__=="__main__":
    src,dst=sys.argv[1],sys.argv[2]; logo=Image.open("logo-icon.png").convert("RGBA")
    faces=[face(c,logo) for c in sys.argv[3].split(",")]
    im=Image.open(src).convert("RGB")
    discs=order(find_discs(im))
    print(json.dumps([{k:round(v,1) for k,v in d.items()} for d in discs]))
    grow=float(sys.argv[4]) if len(sys.argv)>4 else 1.0
    sh=(float(sys.argv[5]),float(sys.argv[6])) if len(sys.argv)>6 else (0.0,0.0)
    replace(im,discs,faces,grow=grow,shift=sh).save(dst)
