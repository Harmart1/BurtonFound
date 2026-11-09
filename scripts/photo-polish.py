#!/usr/bin/env python3
"""Archive-faithful, reproducible product photo display enhancement.

Creates separate display derivatives; NEVER changes or deletes source photos.
Only minor white balance, neutral-paper lighting correction and thresholded
sharpness are applied. No retouching of artwork, paper wear, text, creases,
tears, stains or unverified content is permitted.
"""
from __future__ import annotations
import argparse
import copy
import json
import math
import re
from pathlib import Path
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

ROOT=Path(__file__).resolve().parent.parent
PUBLIC=ROOT/"public"
IMAGE_DIR=PUBLIC/"assets"/"images"
REPORT=ROOT/"reports"/"photo-polish-audit.json"
MAX_SIDE=1900
MIN_SIDE=350

# Visually flagged for potentially distracting original page backgrounds,
# shadows, edge distortion or glare: these warrant careful manual comparison.
MANUAL_REVIEW={
 "va-002.webp":"Repeated dark ring/mark along the scanned page edge",
 "va-010.webp":"Uneven warm illumination; verify original printed colors",
 "va-013.webp":"Possible page curvature/edge shadow",
 "va-034.webp":"Visible paper edge and warm illumination",
 "va-037.webp":"Color cast on page with illustrations",
 "va-041.webp":"Ring/mark near right margin; verify whether from scan",
 "va-042.webp":"Ring/mark near right margin; verify whether from scan",
 "va-059.webp":"Strong diagonal shadow over original page and text",
 "va-061.webp":"Uneven source lighting and print texture",
 "va-066.webp":"Page skew and dark edge",
 "va-072.webp":"Photographed page is tilted; manual perspective review",
 "va-073.webp":"Photographed page is tilted; manual perspective review",
 "va-077.webp":"Uneven grey illumination on the page",
 "va-078.webp":"Visible paper edge/shadow",
 "va-090.webp":"Darker page background may be genuine print design",
}

def check(condition, message):
    if not condition: raise RuntimeError(message)

def parse_js(path,assignment):
    text=path.read_text("utf-8")
    check(text.lstrip().startswith(assignment),f"Unexpected JS format: {path.name}")
    data=json.loads(text.split("=",1)[1].strip().rstrip(";"))
    return data

def ref_original(path):
    check(path.startswith("assets/images/") and path.endswith(".webp"),
          "Unexpected product image reference: "+path)
    return path.replace("assets/images/polished/","assets/images/",1)

def ref_polished(path):
    base=ref_original(path)
    return base.replace("assets/images/","assets/images/polished/",1)

def sample_metrics(im):
    sm=np.asarray(im.resize((max(48,im.width//8),max(48,im.height//8)),Image.Resampling.LANCZOS),dtype=np.float32)
    light=sm.mean(axis=2);spread=sm.max(axis=2)-sm.min(axis=2)
    neutral=(light>=173)&(light<=249)&(spread<=19)
    return sm,light,neutral,float(neutral.mean())

def enhance(im):
    im=ImageOps.exif_transpose(im)
    if im.mode=="RGBA":
        canvas=Image.new("RGB",im.size,(250,249,245))
        canvas.paste(im,mask=im.getchannel("A"))
        im=canvas
    else:
        im=im.convert("RGB")
    original_size=im.size
    check(min(original_size)>=MIN_SIDE, "Image too small for reliable display enhancement")
    if max(im.size)>MAX_SIDE:
        im.thumbnail((MAX_SIDE,MAX_SIDE),Image.Resampling.LANCZOS)
    sm,light,neutral,fraction=sample_metrics(im)
    balance_applied=False
    if fraction>=.12:
        median=np.median(sm[neutral],axis=0)
        target=float(np.mean(median))
        gains=np.clip((target/np.maximum(median,1))**.27,.985,1.015)
        if np.max(np.abs(gains-1))>.002:
            pixels=np.asarray(im,dtype=np.float32)
            pixels=np.clip(pixels*gains.reshape((1,1,3)),0,255).astype("uint8")
            im=Image.fromarray(pixels,"RGB")
            balance_applied=True
    p2,p98=np.percentile(light,[2,98])
    contrast=1.032 if (38<p2<138 and 160<p98<244) else 1.012
    im=ImageEnhance.Contrast(im).enhance(contrast)
    shadow_lift=False
    if fraction>=.25:
        pixels=np.asarray(im,dtype=np.float32)
        luminance=pixels.mean(axis=2)
        chroma=pixels.max(axis=2)-pixels.min(axis=2)
        small=Image.fromarray(np.clip(luminance,0,255).astype("uint8"),"L").resize((190,190))
        illumination=small.filter(ImageFilter.MaxFilter(19)).filter(ImageFilter.GaussianBlur(17))
        field=np.asarray(illumination.resize(im.size,Image.Resampling.BILINEAR),dtype=np.float32)
        delta=np.clip(228-field,0,40)*.60
        # Restore only broad cast lighting gradients on near-neutral pale paper.
        # Printed ink, colorful art and existing distressed paper are not recreated.
        mask=np.clip((luminance-137)/73,0,1)*np.clip((34-chroma)/26,0,1)
        delta=delta*mask
        if float(np.mean(delta))>.25:
            corrected=np.clip(pixels+delta[:,:,None],0,255).astype("uint8")
            im=Image.fromarray(corrected,"RGB")
            shadow_lift=True
    im=im.filter(ImageFilter.UnsharpMask(radius=.70,percent=36,threshold=4))
    return im,{"neutral_paper_fraction":round(fraction,3),"mild_white_balance":balance_applied,
               "paper_illumination_equalized":shadow_lift,"minor_contrast":contrast,
               "original_dimensions":[*original_size],"display_dimensions":[*im.size]}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--dry-run",action="store_true")
    args=parser.parse_args()
    prod_file=PUBLIC/"products.js"
    car_file=PUBLIC/"vintage-cars-data.js"
    products=parse_js(prod_file,"window.BURTON_DATA")
    cars=parse_js(car_file,"window.BURTON_VINTAGE_CARS")
    inventory=products["inventory"]
    check(len(inventory)==22,"Refusing unexpected modification of existing sale inventory")
    check(len(cars)==93 and all(c.get("salesEnabled") is False for c in cars),
          "Automobile page previews must remain 93 records and non-purchasable")
    original_product_refs=set()
    for p in inventory:
        original_product_refs.add(ref_original(p["image"]))
        for image in p.get("images",[]): original_product_refs.add(ref_original(image))
    original_car_refs={ref_original(x["image"]) for x in cars}
    check(len(original_product_refs)==48,
          f"Expected 48 distinct source images for the 22 existing listings, got {len(original_product_refs)}")
    check(len(original_car_refs)==93,
          "Expected 93 distinct vintage automobile source photographs")
    original_refs=sorted(original_product_refs|original_car_refs)
    check(len(original_refs)==141,"Source image count mismatch")
    output_rows=[]
    total_src=0
    total_out=0
    for reference in original_refs:
        source=PUBLIC/reference
        target=PUBLIC/ref_polished(reference)
        check(source.is_file(),"Missing source photograph "+reference)
        with Image.open(source) as original:
            check(original.format=="WEBP","Unexpected source image format "+reference)
            polished,metrics=enhance(original)
        target.parent.mkdir(parents=True,exist_ok=True)
        # WebP is efficient for full-size print text, art and mobile devices.
        if not args.dry_run:
            polished.save(target,"WEBP",quality=86,method=6)
            with Image.open(target) as verified:
                verified.verify()
        bytes_in=source.stat().st_size
        bytes_out=target.stat().st_size if not args.dry_run else 0
        total_src+=bytes_in
        total_out+=bytes_out
        name=source.name
        item={"source":reference,"display":ref_polished(reference),"source_bytes":bytes_in,
              "display_bytes":bytes_out,**metrics}
        if name in MANUAL_REVIEW and "/vintage-cars/" in reference:
            item["manual_review"]=MANUAL_REVIEW[name]
        output_rows.append(item)
        print("Optimized",reference,"->",item["display"],"("+str(bytes_out)+" bytes)")
    # Safely adjust references while retaining prices, descriptions, stock and physical provenance.
    old_products=copy.deepcopy(products)
    for p in inventory:
        p["image"]=ref_polished(p["image"])
        p["images"]=[ref_polished(x) for x in p.get("images",[])]
    old_car_records=copy.deepcopy(cars)
    for c in cars:c["image"]=ref_polished(c["image"])
    for a,b in zip(old_products["inventory"],inventory):
        ac=copy.deepcopy(a);bc=copy.deepcopy(b)
        ac.pop("image",None);ac.pop("images",None)
        bc.pop("image",None);bc.pop("images",None)
        check(ac==bc,"Unexpected sale listing data change: "+a["sku"])
    for a,b in zip(old_car_records,cars):
        ac=copy.deepcopy(a);bc=copy.deepcopy(b)
        ac.pop("image",None);bc.pop("image",None)
        check(ac==bc,"Unexpected preview metadata change: "+a["sku"])
    if not args.dry_run:
        prod_file.write_text("window.BURTON_DATA = "+json.dumps(products,ensure_ascii=False,separators=(",",":"))+";\n",encoding="utf-8")
        car_file.write_text("window.BURTON_VINTAGE_CARS="+json.dumps(cars,ensure_ascii=False,separators=(",",":"))+";\n",encoding="utf-8")
        mapping={x:ref_polished(x) for x in original_refs}
        html_changes=[]
        for page in sorted(PUBLIC.glob("*.html")):
            before=page.read_text("utf-8")
            after=before
            for source,display in mapping.items():
                after=after.replace(source,display)
            if before!=after:
                page.write_text(after,encoding="utf-8")
                html_changes.append(page.name)
    else:html_changes=[]
    report={"version":1,"method":"Conservative, archival-faithful display derivatives; originals preserved",
            "source_image_count":len(original_refs),
            "existing_listing_image_count":len(original_product_refs),
            "automobile_scan_image_count":len(original_car_refs),
            "all_automobile_previews_non_purchasable":True,
            "original_bytes":total_src,"display_bytes":total_out,
            "html_pages_updated":html_changes,
            "notes":["No artwork, text, tears, folds or genuine print condition intentionally removed.",
                     "Automated processing cannot reliably reconstruct obscured details or fix severe perspective, glare or clipping.",
                     "Compare any flagged scans to the physical page before creating sale listings."],
            "images":output_rows}
    if not args.dry_run:
        REPORT.parent.mkdir(parents=True,exist_ok=True)
        REPORT.write_text(json.dumps(report,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    print(f"PASS: {len(original_refs)} archive-faithful display images prepared; "
          f"{len(original_product_refs)} catalogue assets; {len(original_car_refs)} vintage automobile scans.")
    print(f"Source {total_src} bytes; display {total_out} bytes. Original photographs remain untouched.")

if __name__=="__main__":main()
