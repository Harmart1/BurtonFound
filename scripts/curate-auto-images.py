#!/usr/bin/env python3
"""Archival-faithful enhancement of the 80 unique motoring ad designs.

Source images and first-pass polished images are retained unchanged.
No generative fills, artwork synthesis, element removal or invented text.
A manually identified page perspective correction is applied to VA-072 only.
"""
import json,math
from pathlib import Path
import numpy as np
import cv2
from PIL import Image,ImageEnhance,ImageFilter,ImageDraw,ImageFont

ROOT=Path(__file__).resolve().parent.parent
PUBLIC=ROOT/"public"
SOURCE=PUBLIC/"assets"/"images"/"vintage-cars"
POLISHED=PUBLIC/"assets"/"images"/"polished"/"vintage-cars"
OUTPUT=PUBLIC/"assets"/"images"/"curated"/"vintage-cars"
AUDIT=ROOT/"reports"/"auto-image-enhancement-v2.json"
CONTACT=ROOT/"reports"/"auto-enhancement-before-after.jpg"
# The thirteen redundant scans were confirmed by ORB matching AND visual inspection.
# VA-003 and VA-066 are distinct illustrated Lincoln advertisements.
# VA-027 and VA-037 are distinct Nash advertisements.
REMOVED={
 "VA-007":"VA-006",
 "VA-009":"VA-049",
 "VA-043":"VA-049",
 "VA-050":"VA-044",
 "VA-015":"VA-079",
 "VA-019":"VA-028",
 "VA-021":"VA-069",
 "VA-008":"VA-022",
 "VA-042":"VA-041",
 "VA-088":"VA-040",
 "VA-059":"VA-060",
 "VA-075":"VA-066",
 "VA-073":"VA-072"
}
ALL=[f"VA-{i:03d}" for i in range(1,94)]
KEPT=[sku for sku in ALL if sku not in REMOVED]
assert len(KEPT)==80 and len(REMOVED)==13
OUTPUT.mkdir(parents=True,exist_ok=True)

def open_rgb(path):
    with Image.open(path) as im:
        assert im.format=="WEBP",path
        return im.convert("RGB")

def safe_paper_lighting(im):
    # Correct neutral paper lighting, only where color is relatively absent.
    # The vignette, actual printed dark inks, yellowing, tears and aged-paper
    # flaws are not artificially removed.
    pic=np.asarray(im).astype(np.float32)
    sm=cv2.resize(pic,(min(220,im.width),min(280,im.height)),interpolation=cv2.INTER_AREA)
    grey=sm.mean(axis=2)
    chroma=sm.max(axis=2)-sm.min(axis=2)
    neutral=(grey>182)&(chroma<24)
    if neutral.mean()<.09:return im,False
    median=np.median(sm[neutral],axis=0)
    gains=np.clip((np.mean(median)/np.maximum(median,1))**.32,.985,1.015)
    pic=pic*gains.reshape(1,1,3)
    lum=pic.mean(axis=2)
    colour=pic.max(axis=2)-pic.min(axis=2)
    # Smooth field approximates illumination instead of altering fine print.
    lsm=cv2.resize(lum,(150,150),interpolation=cv2.INTER_AREA).astype("float32")
    field=cv2.GaussianBlur(lsm,(0,0),sigmaX=22,sigmaY=22)
    field=cv2.resize(field,(im.width,im.height),interpolation=cv2.INTER_LINEAR)
    delta=np.clip(218-field,0,26)*0.38
    mask=np.clip((lum-168)/65,0,1)*np.clip((39-colour)/28,0,1)
    pic=np.clip(pic+(delta*mask)[:,:,None],0,255).astype("uint8")
    return Image.fromarray(pic),True

def perspective_for_072(im):
    # Four manually inspected, photograph-specific source-paper corners.
    # This transforms known page perspective; it does not retouch the print.
    w,h=im.size
    raw=np.asarray(im)
    src=np.float32([[188,14],[944,70],[1092,1304],[10,1341]])
    src[:,0]*=w/1171;src[:,1]*=h/1450
    dest=np.float32([[0,0],[985,0],[985,1350],[0,1350]])
    matrix=cv2.getPerspectiveTransform(src,dest)
    corrected=cv2.warpPerspective(cv2.cvtColor(raw,cv2.COLOR_RGB2BGR),matrix,
       (986,1351),flags=cv2.INTER_CUBIC,borderMode=cv2.BORDER_CONSTANT,borderValue=(246,246,243))
    return Image.fromarray(cv2.cvtColor(corrected,cv2.COLOR_BGR2RGB))

rows=[]
for sku in KEPT:
    suffix=sku.lower()+".webp"
    src=SOURCE/suffix
    prior=POLISHED/suffix
    assert src.exists() and prior.exists(),sku
    orig=open_rgb(src);image=open_rgb(prior)
    assert orig.size==image.size or max(orig.size)>1900,(sku,orig.size,image.size)
    corrected=False
    if sku=="VA-072":
        image=perspective_for_072(image)
        corrected=True
    image,balanced=safe_paper_lighting(image)
    image=ImageEnhance.Contrast(image).enhance(1.018)
    # Tiny sharpening of printed lettering; no oversharpening or fake detail.
    image=image.filter(ImageFilter.UnsharpMask(radius=.63,percent=32,threshold=5))
    if max(image.size)>1900:
        image.thumbnail((1900,1900),Image.Resampling.LANCZOS)
    out=OUTPUT/suffix
    image.save(out,"WEBP",quality=89,method=6)
    with Image.open(out) as img:
        assert img.format=="WEBP" and min(img.size)>=350
    rows.append({"sku":sku,"source":str(src.relative_to(PUBLIC)),
       "previous_display":str(prior.relative_to(PUBLIC)),
       "new_display":str(out.relative_to(PUBLIC)),
       "source_bytes":src.stat().st_size,"new_bytes":out.stat().st_size,
       "source_dimensions":list(orig.size),"new_dimensions":list(image.size),
       "page_perspective_corrected":corrected,
       "neutral_lighting_adjusted":balanced,
       "original_preserved":True})
    if len(rows)%15==0:print("Enhanced",len(rows),"of",len(KEPT),flush=True)
assert len(rows)==80
assert not(set(KEPT)&set(REMOVED.keys()))
report={"distinct_display_design_count":80,"redundant_scans_hidden":13,
   "retained_original_source_count":93,"removed_records_map":REMOVED,
   "note":"Photographic similarity does not establish physical stock. Original, polished and removed scan files are preserved.",
   "processing":"Conservative source-faithful WebP display derivatives; separate files, neutral-paper lighting, slight sharpening; manual page perspective correction VA-072",
   "items":rows}
AUDIT.write_text(json.dumps(report,indent=2)+"\n")
# Comparison of actual source photographs and actual current proposed site display.
samples=["VA-002","VA-006","VA-049","VA-028","VA-069","VA-022","VA-037","VA-060","VA-072","VA-079","VA-041","VA-066"]
font=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",16)
W=1200;cardw=600;rowh=430
sheet=Image.new("RGB",(W,rowh*math.ceil(len(samples)/2)+55),(249,247,241))
draw=ImageDraw.Draw(sheet)
draw.text((15,17),"Burton & Found — actual source (left) and curated display (right)",font=font,fill=(22,52,38))
for i,sku in enumerate(samples):
    x=(i%2)*cardw;y=(i//2)*rowh+55
    draw.text((x+12,y),sku+"  /  actual image comparison",font=font,fill=(22,52,38))
    for side,path in enumerate([SOURCE/(sku.lower()+".webp"),OUTPUT/(sku.lower()+".webp")]):
        im=open_rgb(path);im.thumbnail((cardw//2-14,rowh-46),Image.Resampling.LANCZOS)
        ix=x+side*(cardw//2)+(cardw//2-im.width)//2
        iy=y+26+(rowh-46-im.height)//2
        sheet.paste(im,(ix,iy))
sheet.save(CONTACT,quality=90,optimize=True)
print("PASS:",len(rows),"distinct ad designs rendered; 93 original scans untouched; 13 redundant page views identified.")
print("REPORT",AUDIT,"CONTACT",CONTACT)
