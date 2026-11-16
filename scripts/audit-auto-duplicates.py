#!/usr/bin/env python3
"""Read-only visual duplicate and image-quality audit of 93 original automotive scans.
Does not modify, remove or reprice any product or source photograph.
Requires Pillow, numpy, scipy and opencv-python-headless. 
"""
import json,math,re
from pathlib import Path
from collections import defaultdict
import numpy as np
import cv2
from scipy.fft import dctn
from PIL import Image,ImageOps,ImageDraw,ImageFont

ROOT=Path(__file__).resolve().parent.parent
PUB=ROOT/"public"
DATA=PUB/"vintage-cars-data.js"
OUT=ROOT/"reports"/"automobile-visual-audit.json"
ART=ROOT/"reports"/"automobile-duplicate-review.jpg"
items=json.loads(DATA.read_text().split("=",1)[1].strip().rstrip(";"))
assert len(items)==93,"Expected the original 93 scans before de-duplication"
def get_image(x):
    p=PUB/x["image"].replace("assets/images/polished/","assets/images/")
    assert p.exists(),(x["sku"],p)
    im=Image.open(p).convert("RGB")
    return im,p

def hamming(a,b):return (a^b).bit_count()
def phash(im):
    grey=ImageOps.grayscale(im).resize((32,32),Image.Resampling.LANCZOS)
    a=np.asarray(grey,dtype=np.float32)
    spectrum=dctn(a,type=2,norm="ortho")[:8,:8]
    coeff=spectrum.flatten()[1:]
    med=np.median(coeff)
    return sum((int(x>med)<<idx) for idx,x in enumerate(coeff))
def dhash(im):
    a=np.asarray(ImageOps.grayscale(im).resize((9,8),Image.Resampling.LANCZOS),dtype=np.uint8)
    return sum((int(x)<<i) for i,x in enumerate((a[:,:-1]>a[:,1:]).flatten()))
def quality(im):
    a=np.asarray(im.convert("RGB"),dtype=np.uint8)
    g=cv2.cvtColor(a,cv2.COLOR_RGB2GRAY)
    small=cv2.resize(g,(min(900,g.shape[1]),min(900,g.shape[0])))
    lap=float(cv2.Laplacian(small,cv2.CV_64F).var())
    h,w=g.shape
    # Photograph margin variability; warnings only (not proof of scan defects).
    background=np.concatenate([a[:max(3,h//22),:].reshape(-1,3),a[-max(3,h//22):,:].reshape(-1,3)],axis=0)
    lum=background.mean(axis=1)
    glare=float((lum>247).mean())
    shadow=float((lum<65).mean())
    cast=float(np.abs(background.mean(axis=0)-background.mean()).mean())
    return {"width":im.width,"height":im.height,"megapixels":round(im.width*im.height/1e6,3),
      "sharpness_laplacian":round(lap,2),"bright_edge_fraction":round(glare,3),
      "dark_edge_fraction":round(shadow,3),"edge_cast":round(cast,2)}
descriptors=[]
orb=cv2.ORB_create(nfeatures=1500,scaleFactor=1.22,nlevels=7,edgeThreshold=20,fastThreshold=16)
for index,x in enumerate(items):
    im,p=get_image(x)
    gray=cv2.cvtColor(np.asarray(im),cv2.COLOR_RGB2GRAY)
    scale=min(1.0,1100/max(gray.shape))
    if scale<1:gray=cv2.resize(gray,None,fx=scale,fy=scale,interpolation=cv2.INTER_AREA)
    keys,desc=orb.detectAndCompute(gray,None)
    q=quality(im)
    descriptors.append({"sku":x["sku"],"title":x["title"],"brand":x["brand"],
      "reported_group":x.get("duplicateGroup"),"source":str(p.relative_to(ROOT)),
      "image_path":x["image"],"phash":phash(im),"dhash":dhash(im),
      "orb_count":len(keys or []),"orb_keys":keys,"orb_desc":desc,"quality":q})
    if index%15==0:print("Audited",index+1,"of",len(items),"original photographs",flush=True)
matcher=cv2.BFMatcher(cv2.NORM_HAMMING)
def compare(i,j):
    a,b=descriptors[i],descriptors[j]
    d=a["orb_desc"];e=b["orb_desc"]
    if d is None or e is None:return {"good_matches":0,"inliers":0,"fraction":0}
    matches=matcher.knnMatch(d,e,k=2)
    good=[m for m,n in matches if m.distance<.76*n.distance]
    homography_inliers=0
    if len(good)>=9:
        pts_a=np.float32([a["orb_keys"][m.queryIdx].pt for m in good]).reshape(-1,1,2)
        pts_b=np.float32([b["orb_keys"][m.trainIdx].pt for m in good]).reshape(-1,1,2)
        H,mask=cv2.findHomography(pts_a,pts_b,cv2.RANSAC,5.0)
        if mask is not None:homography_inliers=int(mask.sum())
    return {"good_matches":len(good),"inliers":homography_inliers,
      "fraction":round(homography_inliers/max(1,min(a["orb_count"],b["orb_count"])),3)}
pairs=[]
for i,a in enumerate(descriptors):
    for j in range(i+1,len(descriptors)):
        b=descriptors[j]
        ph=hamming(a["phash"],b["phash"]);dh=hamming(a["dhash"],b["dhash"])
        claimed=a["reported_group"] and a["reported_group"]==b["reported_group"]
        same_title=a["title"].lower().replace("1958 ","").replace("1934 ","")==b["title"].lower().replace("1958 ","").replace("1934 ","")
        if claimed or same_title or ph<=18 or dh<=15:
            other=compare(i,j)
            # Keep uncertain pairs for review; no automatic proof of physical duplicate
            likely=bool((other["inliers"]>=17 and other["fraction"]>=.035) or
                (ph<=7 and dh<=11) or
                (other["inliers"]>=10 and ph<=12))
            candidate=bool(claimed or same_title or likely or (ph<=15 and dh<=15))
            if candidate:pairs.append({"a":a["sku"],"b":b["sku"],"prior_group":a["reported_group"] if claimed else None,
               "same_title":same_title,"phash_distance":ph,"dhash_distance":dh,
               **other,"likely_same_pictured_design":likely})
pairs.sort(key=lambda x:(not x["likely_same_pictured_design"],x["phash_distance"],-x["inliers"]))
def clean(x):
    return {k:v for k,v in x.items() if k not in {"phash","dhash","orb_keys","orb_desc"}}
report={"scope":"93 page scan records; duplicate design does not prove one physical paper copy",
  "examined":len(items),"image_analysis":"Pillow perceptual hashes, dHash, ORB feature matching and RANSAC consistency",
  "prior_groups":dict(sorted({x["reported_group"]:[q["sku"] for q in descriptors if q["reported_group"]==x["reported_group"]] for x in descriptors if x["reported_group"]}.items())),
  "source_audit":[clean(x) for x in descriptors],"candidate_pairs":pairs,
  "likely_pairs":[x for x in pairs if x["likely_same_pictured_design"]],
  "manual_followup":"Remove redundant photograph listings by design only; original image files remain intact and availability is not inferred."}
OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_text(json.dumps(report,indent=2)+"\n")
# A real photograph contact sheet for all prior duplicate groups, with original images.
groups=report["prior_groups"]
font=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",16)
tile=(310,335)
sheet=Image.new("RGB",(tile[0]*4,tile[1]*9),(246,243,238))
draw=ImageDraw.Draw(sheet)
slot=0
for label,skus in groups.items():
  for sku in skus:
    if slot>=36:break
    index=next(i for i,x in enumerate(items) if x["sku"]==sku)
    im,_=get_image(items[index])
    im.thumbnail((tile[0]-25,tile[1]-55),Image.Resampling.LANCZOS)
    x=(slot%4)*tile[0];y=(slot//4)*tile[1]
    draw.text((x+9,y+8),sku+" / "+label,font=font,fill=(25,42,33))
    sheet.paste(im,(x+(tile[0]-im.width)//2,y+36+(tile[1]-55-im.height)//2))
    slot+=1
sheet.crop((0,0,tile[0]*4,tile[1]*math.ceil(slot/4))).save(ART,quality=89,optimize=True)
print("PASS: reviewed",len(descriptors),"scans,",len(pairs),"candidate pairs,",len(report["likely_pairs"]),"likely duplicates")
for x in pairs:print("COMPARE",x["a"],x["b"],"pHash",x["phash_distance"],"inliers",x["inliers"],"fraction",x["fraction"],"prior",x["prior_group"],"likely",x["likely_same_pictured_design"])
print("AUDIT",OUT,"CONTACT",ART)
