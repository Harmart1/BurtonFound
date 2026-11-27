#!/usr/bin/env python3
"""Bounded, anonymous HTTP timing and response integrity monitor. No writes, credentials or real-user tracking."""
import json, re, subprocess, tempfile, sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit, urljoin
ROOT=Path(__file__).resolve().parent.parent
ALLOWED={"https://burtonfound.timharmar.workers.dev","https://burtonandfound.ca"}
TARGETS=[
 ("Home","/",b"Browse the collection",850_000),
 ("Automobile collection","/collections/automobiles.html",b"Vintage Automobile Advertising",850_000),
 ("Account","/account",b"signInForm",600_000),
 ("Health API","/api/health",b"Burton & Found",25_000),
 ("Catalogue API","/api/catalog",b'"items"',250_000),
 ("Featured product photo","/assets/images/curated/vintage-cars/va-049.webp",None,2_000_000)
]
def permitted(url,origin):
    p=urlsplit(url)
    return p.scheme=="https" and f"{p.scheme}://{p.netloc}"==origin and not p.username and not p.password and not p.fragment
def check(origin,path,marker,budget):
    url=origin+path
    totals=0
    with tempfile.TemporaryDirectory() as tmp:
        body=Path(tmp)/"body"
        for hop in range(3):
            if not permitted(url,origin): raise ValueError("Cross-origin redirect blocked")
            r=subprocess.run(["curl","--silent","--show-error","--max-time","20","--max-filesize","4000000","--proto","=https","--output",str(body),"--write-out","%{json}",url],capture_output=True,text=True,timeout=25)
            if r.returncode!=0: raise ValueError("HTTP transfer unsuccessful (curl exit "+str(r.returncode)+")")
            d=json.loads(r.stdout)
            totals+=float(d.get("time_total",0))
            status=int(d["http_code"])
            if status in (301,302,303,307,308):
                url=urljoin(url,str(d.get("redirect_url","")))
                continue
            data=body.read_bytes()
            valid=status==200 and ((marker in data) if marker else (data[:4]==b"RIFF" and data[8:12]==b"WEBP"))
            if path=="/api/health" and valid:
                obj=json.loads(data);valid=obj.get("service")=="Burton & Found" and obj.get("checkout")=="preview_only"
            if path=="/api/catalog" and valid:
                obj=json.loads(data);valid=obj.get("configured") is True and isinstance(obj.get("items"),list) and len(obj["items"])>0
            notes=[]
            if not valid: notes.append("Unexpected HTTP response or content; inspect (not a passing health check)")
            if len(data)>budget: notes.append("Body exceeds provisional budget")
            if totals>5: notes.append("Slow synthetic request (>5 s including redirects)")
            return {"path":path,"http":status,"response_ok":valid,"bytes":len(data),"budget":budget,"ttfb_ms":round(float(d.get("time_starttransfer",0))*1000),"elapsed_ms":round(totals*1000),"redirects":hop,"notes":notes}
    raise ValueError("Too many redirects")
def main():
    cfg=json.loads((ROOT/"wrangler.jsonc").read_text())
    origin=cfg.get("vars",{}).get("MARKETING_SITE_URL","").rstrip("/")
    if origin not in ALLOWED: sys.exit("Refuse unexpected public monitor origin")
    result=[]
    for name,path,marker,budget in TARGETS:
        try: row=check(origin,path,marker,budget)
        except (ValueError,OSError,subprocess.TimeoutExpired): row={"path":path,"response_ok":False,"notes":["Unable to verify endpoint; review access, timeout or response content"]}
        result.append({"target":name,**row})
    stamp=datetime.now(timezone.utc).isoformat()
    out=ROOT/"performance-output";out.mkdir(exist_ok=True)
    (out/"public-performance.json").write_text(json.dumps({"checked_utc":stamp,"origin":origin,"synthetic":True,"targets":result},indent=2)+"\n")
    lines=["# Public HTTP performance snapshot","",stamp+" · "+origin,"","Single anonymous synthetic HTTP sample from the CI region; no real-user metrics, browser rendering or load test. Budgets are provisional review thresholds, not measured historical baselines.","","| Endpoint | HTTP | Bytes | TTFB (ms) | Total (ms) | Status |","|---|---:|---:|---:|---:|---|"]
    for x in result:
        status="PASS" if x["response_ok"] and not x["notes"] else "REVIEW: "+"; ".join(x["notes"])
        lines.append("| "+" | ".join(str(v) for v in (x["target"],x.get("http","—"),x.get("bytes","—"),x.get("ttfb_ms","—"),x.get("elapsed_ms","—"),status))+" |")
    lines+=["","Timing and size thresholds are review signals only. Unexpected endpoint content fails this workflow. No customer data or private endpoints requested."]
    (out/"public-performance.md").write_text("\n".join(lines)+"\n")
    print("\n".join(lines))
    if any(not x["response_ok"] for x in result):sys.exit(1)
if __name__=="__main__":main()
