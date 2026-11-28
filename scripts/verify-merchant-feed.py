"""Public, read-only verification; no submission to Google or creation of orders."""
import json,subprocess,sys
from decimal import Decimal
from xml.etree import ElementTree as ET
BASE="https://burtonandfound.ca"
NS={"g":"http://base.google.com/ns/1.0"}
def get(path):
    p=subprocess.run(["curl","--fail","--silent","--show-error","--max-time","20",BASE+path],capture_output=True,timeout=25)
    if p.returncode:raise ValueError("Public request failed: "+path)
    return p.stdout
def require(x,msg):
    if not x:raise ValueError(msg)
def main():
    stock=json.loads(get("/api/catalog"));require(stock.get("configured") is True,"Stock service unavailable")
    rows={r["sku"]:r for r in stock["items"]}
    feed=ET.fromstring(get("/merchant-feed.xml"));items=feed.findall("./channel/item")
    require(0<len(items)<=229,"Wrong feed size")
    seen=set()
    for item in items:
        def field(k):return item.findtext("g:"+k,namespaces=NS)
        sku=field("id");r=rows.get(sku,{})
        require(sku not in seen and r.get("checkout_eligible") is True,"Duplicate or unapproved SKU")
        seen.add(sku)
        require(field("price")==f'{Decimal(r["price_cents"])/100:.2f} CAD' and field("availability")==("in_stock" if r["available"] else "out_of_stock"),"Stock changed or price mismatched; recheck feed")
        require(field("condition")=="used" and field("identifier_exists")=="no" and bool(field("title")) and bool(field("description")),"Missing item attributes")
        require(item.findtext("g:shipping/g:country",namespaces=NS)=="CA" and item.findtext("g:shipping/g:price",namespaces=NS)=="19.95 CAD","Wrong shipping data")
        link=field("link");img=field("image_link")
        require(link.startswith(BASE+"/products/") and img.startswith(BASE+"/assets/images/"),"Wrong domain")
        html=get(link[len(BASE):]).decode();require(('data-bf-stock-sku="'+sku+'"') in html and ('href="'+link+'"') in html,"Wrong landing page")
        require(len(get(img[len(BASE):]))>1000,"Missing product image")
    print(f"PASS {len(items)} documented Merchant candidates: current prices, stock, Canada shipping, canonical pages and image responses.")
    print("No Google submission, advertising expenditure or store changes.")
if __name__=="__main__":
    try:main()
    except Exception as e:sys.exit("Merchant feed verification: "+str(e))
