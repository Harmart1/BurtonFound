#!/usr/bin/env python3
"""Draft-only branded social image generator using unmodified catalogue photographs."""
from pathlib import Path
import csv,json,re,sys
from urllib.parse import urlsplit,unquote
from PIL import Image,ImageOps,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/"marketing-output"; PUBLIC=ROOT/"public"
DEST=OUT/"promotional-graphics"
INK="#20372D"; PAPER="#F8F3E8"; MUTED="#655D50"; ACCENT="#A8745F"
FONT="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
BOLD="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
SERIF="/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"
def font(path,size): return ImageFont.truetype(path,size)
def check(c,m):
    if not c: raise ValueError(m)
def wrap(draw,text,width,maxlines,f):
    words=text.split();lines=[];line=""
    for word in words:
        candidate=(line+" "+word).strip()
        if draw.textlength(candidate,font=f)<=width:line=candidate
        else:
            if line:lines.append(line)
            line=word
    if line:lines.append(line)
    if len(lines)>maxlines:lines=lines[:maxlines];lines[-1]+="…"
    return lines
def graphic(row,fmt,auto=False,live=False):
    sku=row["sku"]
    check(re.fullmatch(r"[A-Z0-9-]{2,45}",sku),"Invalid SKU")
    url=urlsplit(row["image_url"]);base=urlsplit(row["product_url"])
    check(url.scheme==base.scheme=="https" and url.netloc==base.netloc and not url.query and not url.fragment and url.path.startswith("/assets/") and base.path.startswith("/products/"),"Invalid source link")
    photo=(PUBLIC/unquote(url.path).lstrip("/")).resolve()
    check(photo.is_relative_to(PUBLIC.resolve()) and photo.is_file(),"Photo missing or not local")
    with Image.open(photo) as raw:
        raw.load();im=ImageOps.exif_transpose(raw).convert("RGB")
    w,h=fmt
    canvas=Image.new("RGB",(w,h),PAPER);d=ImageDraw.Draw(canvas)
    d.rectangle((0,0,w,134),fill=INK)
    d.text((w/2,48),"BURTON & FOUND",font=font(SERIF,42),anchor="mm",fill=PAPER)
    d.text((w/2,99),"HISTORY WORTH HOLDING",font=font(BOLD,19),anchor="mm",fill="#EAC7AA")
    pad=60;bottom=h-270
    d.rectangle((pad-8,154,w-pad+8,bottom-4),fill="#E7E0D2")
    # No crop, filters, replacement backgrounds or drawn-over details on the item itself.
    im.thumbnail((w-2*pad-24,bottom-180),Image.Resampling.LANCZOS)
    canvas.paste(im,((w-im.width)//2,160+(bottom-160-im.height)//2))
    label="VINTAGE MOTORING COLLECTION" if auto and live else "MOTORING ARCHIVE · ENQUIRY ONLY" if auto else "FROM THE COLLECTOR DESK"
    d.text((pad,bottom+22),label,font=font(BOLD,21),fill=INK)
    title=" ".join(row["title"].split())
    tf=font(SERIF,32);lines=wrap(d,title,w-2*pad,3,tf)
    for i,line in enumerate(lines): d.text((pad,bottom+58+39*i),line,font=tf,fill=INK)
    d.line((pad,h-86,w-pad,h-86),fill=ACCENT,width=2)
    disclaimer="Physical stock and printing date unverified" if auto and not live else "Confirm availability and item details"
    d.text((pad,h-72),disclaimer,font=font(FONT,21),fill=MUTED)
    d.text((pad,h-40),"Catalogue "+sku+" · Burton & Found",font=font(BOLD,18),fill=INK)
    size="square" if w==h else "portrait"
    file=DEST/(sku.lower()+"-"+size+".png");canvas.save(file,optimize=True)
    with Image.open(file) as generated:check(generated.size==fmt and generated.format=="PNG","Graphic failed validation")
    return {"sku":sku,"format":size,"width":w,"height":h,"file":str(file.relative_to(OUT)),"product_url":row["product_url"],"source_photo":row["image_url"],"enquiry_only":auto and not live,"published":False}
def main():
    DEST.mkdir(parents=True,exist_ok=True)
    for f in DEST.glob("*.png"):f.unlink()
    with (OUT/"weekly-social-queue.csv").open(newline="") as f: ordinary=[{**r,"title":r["product_title"]} for r in csv.DictReader(f)]
    with (OUT/"automobile-enquiry-promotions.csv").open(newline="") as f: autos=list(csv.DictReader(f))
    state=json.loads((OUT/"marketing-readiness.json").read_text());live=state.get("liveCommerceSnapshot") is True
    check(len(ordinary)==14 and (len(autos)==state.get("automobilePromotionListings") if live else len(autos)==98),"Unexpected promotion catalogue")
    # Six clearly labelled motoring drafts, rotated deterministically with weekly plan.
    week=json.loads((OUT/"marketing-readiness.json").read_text())["weeklyRotation"]
    if live:autos=[r for r in autos if r["sku"] not in {p["sku"] for p in ordinary}]
    offset=(week*6)%len(autos) if autos else 0;selected=[autos[(offset+i)%len(autos)] for i in range(min(6,len(autos)))]
    rows=[graphic(r,fmt,is_auto,live) for entries,is_auto in [(ordinary,False),(selected,True)] for r in entries for fmt in [(1080,1080),(1080,1350)]]
    check(len(rows)==2*(14+len(selected)) and len({r["file"] for r in rows})==len(rows),"Duplicate or incomplete graphics")
    (DEST/"manifest.json").write_text(json.dumps({"draft_only":True,"graphics":rows},indent=2)+"\n")
    (DEST/"README.txt").write_text(str(len(rows))+" draft PNGs: 14 catalogue picks and "+str(len(selected))+" additional automobile picks ("+("stock-checked" if live else "enquiry-only")+"), each in 1080x1080 and 1080x1350. The original catalogue photo is fitted without cropping or retouching. No prices, discounts, inventory guarantees, published posts or promised delivery dates. Review actual item availability, photo rights, and caption before posting. Product links appear in manifest.json.\n")
    print("PASS generated and dimension-verified "+str(len(rows))+" draft promotional PNGs. No posting or sending.")
if __name__=="__main__":main()
