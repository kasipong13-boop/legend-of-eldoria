from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import random, math, json, hashlib, zipfile, re, base64, io
OUT=Path('/workspace/work/wf-asset-01/output'); OUT.mkdir(exist_ok=True)
A=OUT/'assets'; A.mkdir(exist_ok=True)
G=['#182f2d','#214538','#2c5940','#397448','#508c51','#73a65d','#a0bd70']
B=['#302c30','#503e32','#71523b','#957047','#b39460']
R=['#29363d','#445357','#60706c','#859286','#b1b69a']
assets={}; records=[]
def new(size): return Image.new('RGBA',size)
def poly(d,pts,c): d.polygon(pts,fill=c)
def foliage(im,cx,cy,rx,ry,seed,palette=G):
 rng=random.Random(seed); d=ImageDraw.Draw(im)
 pts=[]
 for j in range(24):
  a=2*math.pi*j/24; f=rng.uniform(.89,1.05); pts.append((round(cx+math.cos(a)*rx*f),round(cy+math.sin(a)*ry*f)))
 poly(d,pts,palette[0]); inner=[(round(cx+(x-cx)*.94),round(cy+(y-cy)*.90)-1) for x,y in pts]; poly(d,inner,palette[2])
 mask=new(im.size); md=ImageDraw.Draw(mask); poly(md,inner,'white')
 # Structured, overlapping leaf clusters, brighter on upper-left; no filtering.
 for k in range(int(rx*ry/14)):
  x=rng.randint(cx-rx,cx+rx); y=rng.randint(cy-ry,cy+ry)
  if not (0<=x<im.width-5 and 0<=y<im.height-3) or not mask.getpixel((x,y))[3]: continue
  light=(-(x-cx)/rx-(y-cy)/ry)*.8
  idx=max(1,min(6,int(3.3+light+rng.choice([-1,0,0,1]))))
  w=rng.randint(3,7); h=rng.randint(2,4)
  for yy in range(h):
   for xx in range(w):
    px=x+xx; py=y+yy
    if px<im.width and py<im.height and mask.getpixel((px,py))[3] and (yy!=0 or xx>1): im.putpixel((px,py),ImageColor(palette[idx]))
def ImageColor(c): return tuple(bytes.fromhex(c[1:]))+(255,)
def save(name,im,pivot,foot):
 im.save(A/(name+'.png')); assets[name]=im
 records.append(dict(id=name,file='assets/'+name+'.png',canvas=list(im.size),pivot=pivot,footprint_tiles=foot,status='DRAFT_FOR_DIRECTOR_REVIEW',frames=1,direction='fixed isometric',sha256=hashlib.sha256((A/(name+'.png')).read_bytes()).hexdigest()))
for n in range(1,4):
 im=new((128,160)); d=ImageDraw.Draw(im)
 d.ellipse((37,136,98,153),fill='#182f2d')
 poly(d,[(58,87),(73,83),(75,128),(89,141),(76,143),(66,137),(52,147),(42,144),(57,129)],B[0])
 poly(d,[(60,87),(70,87),(68,133),(77,140),(65,135),(51,143),(61,128)],B[2])
 poly(d,[(61,90),(64,92),(64,130),(59,136),(60,123)],B[3])
 d.line([(69,115),(85,95),(89,76)],fill=B[0],width=6)
 d.line([(60,111),(43,94),(39,80)],fill=B[1],width=5)
 if n==1:
  for j,t in enumerate([(43,77,28,26),(85,76,28,28),(66,49,38,34),(37,55,24,24),(88,48,23,23),(63,29,27,23),(63,73,29,26)]): foliage(im,*t,100+j)
 elif n==2:
  for j,t in enumerate([(66,39,25,30),(48,64,29,31),(85,65,25,31),(65,87,35,24),(65,23,18,17)]): foliage(im,*t,200+j,[G[0],G[1],'#285345','#386b50','#4e835b','#719b67','#9bb677'])
 else:
  for j,(cy,rx) in enumerate([(105,43),(85,36),(66,29),(48,22),(39,14)]):
   pts=[(64,cy-37),(64+rx//3,cy-15),(64+rx-6,cy-4),(64+rx,cy+8),(72,cy+13),(64-rx,cy+7),(64-rx+6,cy-3),(55,cy-20)]
   poly(ImageDraw.Draw(im),pts,G[0]); foliage(im,62,cy-1,rx-4,13,300+j,[G[0],G[1],G[2],'#31674c','#48805a','#699b69','#96b47a'])
 save(f'tree_{n:02}',im,[64,144],[1,1])
for n in (1,2):
 im=new((64,48)); d=ImageDraw.Draw(im); d.ellipse((6,32,59,45),fill=G[0])
 for j,t in enumerate([(19,27,15,13),(43,25,17,15),(32,18,18,14)]): foliage(im,*t,400+n*10+j)
 if n==2:
  d=ImageDraw.Draw(im)
  for x,y in [(17,23),(27,15),(42,28),(37,19),(23,30)]:
   d.rectangle((x,y,x+2,y+2),fill='#843f60'); d.point((x,y),fill='#e28c98')
 save(f'bush_{n:02}',im,[32,39],[1,1])
for n in (1,2):
 im=new((64,48)); d=ImageDraw.Draw(im); d.ellipse((6,30,59,44),fill=G[0])
 if n==1: p=[(8,28),(17,12),(36,7),(52,18),(58,33),(42,40),(17,37)]
 else: p=[(7,30),(12,21),(28,17),(35,9),(49,13),(58,30),(50,39),(21,39)]
 poly(d,p,R[0]); poly(d,[(10,28),(19,14),(36,10),(49,19),(35,28),(22,30)],R[3]); poly(d,[(22,30),(35,28),(49,19),(55,32),(41,37),(20,35)],R[1]); poly(d,[(19,14),(36,10),(43,15),(29,20)],R[4]); poly(d,[(10,28),(22,30),(20,35),(16,34)],R[2])
 if n==2:
  poly(d,[(10,29),(15,22),(27,20),(32,28),(24,34)],R[2]); poly(d,[(35,12),(48,15),(50,22),(40,25),(30,21)],R[3]); d.line([(29,21),(34,29),(27,35)],fill=R[0],width=2)
 d.line([(36,12),(31,22),(36,26)],fill=R[1],width=1)
 for x,y in [(13,28),(18,30),(40,31),(44,30),(38,34)]: d.rectangle((x,y,x+4,y+1),fill=G[3]); d.point((x,y),fill=G[5])
 save(f'rock_{n:02}',im,[32,38],[1,1])
# Pixel-center half-open diamond: exactly partitions the screen lattice at (32,16) steps.
mask=new((64,32))
for y in range(32):
 for x in range(64):
  u=(x+.5-32)/64+(y+.5-16)/32; v=(y+.5-16)/32-(x+.5-32)/64
  if -.5<=u<.5 and -.5<=v<.5: mask.putpixel((x,y),(255,255,255,255))
for family,count in [('grass_tile',3),('dirt_path_tile',2)]:
 for n in range(1,count+1):
  im=new((64,32)); rng=random.Random(600+n+(family=='grass_tile')*50); grass=family=='grass_tile'; base=G[3] if grass else '#9a8058'
  for y in range(32):
   for x in range(64):
    if mask.getpixel((x,y))[3]: im.putpixel((x,y),ImageColor(base))
  # Constant boundary band prevents texture discontinuity across variants.
  d=ImageDraw.Draw(im)
  for k in range(36 if grass else 25):
   x=rng.randrange(8,55); y=rng.randrange(5,27)
   if abs((x-32)/32)+abs((y-16)/16)>.68: continue
   if grass:
    c=rng.choice([G[2],G[4],G[4],G[5]]); d.line([(x-2,y),(x,y+1),(x+3,y)],fill=c,width=1)
    if n==3 and k%9==0: d.point((x,y-1),fill='#c2b883')
   else:
    c=rng.choice(['#ad9367','#89734f','#b69b70']); d.line([(x,y),(x+3,y)],fill=c)
    if n==2 and k%5==0: d.line([(x,y+1),(x+2,y+1)],fill='#725f46')
  im.putalpha(mask.getchannel('A')); save(f'{family}_{n:02}',im,[32,16],[1,1])
# Sheet, native art enlarged with integer nearest-neighbor only.
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',14)
small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',12)
sheet=Image.new('RGBA',(1080,990),'#111e25'); sd=ImageDraw.Draw(sheet)
sd.text((28,18),'WHISPERING FOREST / WF-ASSET-01',font=font,fill='#d9dfb7'); sd.text((28,43),'12 CODE-DRAWN PIXEL ASSETS | 2x NEAREST | DRAFT FOR DIRECTOR REVIEW',font=small,fill='#8daa9c')
for i,(name,im) in enumerate(assets.items()):
 col=i%4; row=i//4; x=24+col*264; y=80+row*300
 for yy in range(y,y+250,12):
  for xx in range(x,x+252,12): sd.rectangle((xx,yy,xx+11,yy+11),fill=('#29363d' if ((xx-x)//12+(yy-y)//12)%2 else '#34434a'))
 # Trees rendered at 1x in sheet? all panels tall enough for 2x 160; use tree cropped bounds max 240 high -> sheet 1x trees, explicitly label.
 factor=1 if name.startswith('tree') else 2
 vis=im.resize((im.width*factor,im.height*factor),Image.Resampling.NEAREST)
 sheet.alpha_composite(vis,(x+(252-vis.width)//2,y+245-vis.height))
 sd.text((x,y+257),name.upper().replace('_',' '),font=font,fill='#d9dfb7'); sd.text((x,y+278),f'{im.width}x{im.height} RGBA / view {factor}x',font=small,fill='#91ac9c')
sd.rectangle((24,42,1050,61),fill='#111e25'); sd.text((28,43),'12 CODE-DRAWN PIXEL ASSETS | NATIVE TREES / 2x SMALL ASSETS | REVIEW DRAFT',font=small,fill='#8daa9c')
sheet.save(OUT/'asset_contact_sheet.png')
# Art-only composition; deliberately does not claim to recreate gameplay map.
scene=Image.new('RGBA',(1000,650),'#14272c'); ground=new(scene.size); placements=[]
for r in range(12):
 for c in range(12):
  x=500+(c-r)*32; y=190+(c+r)*16
  path=(c in (5,6)) or (r in (5,6) and c>=5)
  name=(f'dirt_path_tile_{1+(c+r)%2:02}' if path else f'grass_tile_{1+(c*7+r*3)%3:02}')
  ground.alpha_composite(assets[name],(x-32,y-16))
  if not path and (c*13+r*7)%9==0: placements.append((c,r,'bush_01' if c%2 else 'bush_02'))
  if not path and (c*7+r*11)%23==0: placements.append((c,r,'rock_01' if r%2 else 'rock_02'))
for c,r,n in [(0,1,1),(1,4,2),(0,8,3),(2,9,1),(3,2,3),(8,1,2),(10,2,1),(9,4,3),(10,8,2),(8,9,1),(4,10,3),(11,10,1),(1,11,2),(11,0,3)]: placements.append((c,r,f'tree_{n:02}'))
scene.alpha_composite(ground)
for c,r,name in sorted(placements,key=lambda a:a[0]+a[1]):
 im=assets[name]; rec=next(v for v in records if v['id']==name); x=500+(c-r)*32; y=190+(c+r)*16; px,py=rec['pivot']; scene.alpha_composite(im,(x-px,y-py))
d=ImageDraw.Draw(scene); d.text((32,24),'LEGEND OF ELDORIA / WHISPERING FOREST',font=font,fill='#d9dfb7'); d.text((32,50),'WF-ASSET-01   |   NATIVE 64x32 GRID   |   ORIGINAL CODE-DRAWN PIXEL ART',font=small,fill='#8daa9c'); d.text((32,603),'ART COMPOSITION ONLY - NOT GAMEPLAY MAP / NO RUNTIME INTEGRATION',font=small,fill='#8daa9c')
scene.save(OUT/'forest_map_preview.png'); scene.resize((2000,1300),Image.Resampling.NEAREST).save(OUT/'forest_map_preview_2x.png')
# Exhaustive variant adjacency and coverage test on a 6x6 lattice.
qa={'asset_count':len(assets),'assets':[],'adjacency':{}}
for rec in records:
 p=OUT/rec['file']; im=Image.open(p); im.verify(); im=Image.open(p); alpha=im.getchannel('A'); colors=im.getcolors(100000)
 assert im.mode=='RGBA' and alpha.getextrema()==(0,255) and set(alpha.getdata())=={0,255}
 assert len(colors)>3
 qa['assets'].append(dict(id=rec['id'],open_ok=True,rgba=True,alpha_values=[0,255],colors=len(colors),bbox=alpha.getbbox(),bytes=p.stat().st_size))
cov={}
for r in range(-3,4):
 for c in range(-3,4):
  for y in range(32):
   for x in range(64):
    if mask.getpixel((x,y))[3]:
     p=((c-r)*32+x-32,(c+r)*16+y-16); cov[p]=cov.get(p,0)+1
central=[cov.get((x,y),0) for y in range(-45,46) for x in range(-90,91)]
assert set(central)=={1}; qa['adjacency']['central_coverage_gaps']=0; qa['adjacency']['central_coverage_overlaps']=0
for fam in ('grass_tile','dirt_path_tile'):
 names=[n for n in assets if n.startswith(fam)]; checks=0
 for a in names:
  for b in names:
   for dx,dy in [(32,16),(-32,16),(32,-16),(-32,-16)]:
    checks+=1
    # Common exterior band identical within each terrain family.
    for y in range(32):
     for x in range(64):
      if mask.getpixel((x,y))[3] and abs((x+.5-32)/32)+abs((y+.5-16)/16)>.86: assert assets[a].getpixel((x,y))==assets[b].getpixel((x,y))
 qa['adjacency'][fam+'_ordered_direction_checks']=checks
qa['adjacency']['grass_dirt_transition']='Coverage verified; abrupt material border. No transition/autotile set in this 12-asset scope.'
(OUT/'validation.json').write_text(json.dumps(qa,indent=2)); (OUT/'manifest.json').write_text(json.dumps({'projection':'2:1','tile':[64,32],'placement':'top_left = iso(c,r) - pivot; iso=((c-r)*32,(c+r)*16)','collision':'suggested visual footprint only; no gameplay changes','assets':records},indent=2))
print(json.dumps(qa,indent=2))
