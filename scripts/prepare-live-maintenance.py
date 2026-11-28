"""Prepare local maintenance config from the existing verified deployment. Never modifies Cloudflare."""
import json,os,re,sys
from pathlib import Path
from audit_stripe_payment_setup import cf_api,cloudflare_bindings,secret_status
LIVE_FLAGS=("LIVE_CHECKOUT_ENABLED","LIVE_PAYMENTS_APPROVED","STRIPE_PAYOUTS_VERIFIED","PHYSICAL_STOCK_APPROVED","DOMESTIC_POSTAGE_VERIFIED","SELLER_TERMS_APPROVED","TAX_CONFIGURATION_APPROVED","PRODUCTION_WEBHOOK_READY")
def prepare(base,bindings):
    if base.get("name")!="burtonfound":raise ValueError("Wrong Worker")
    vars=base["vars"]
    expected={**vars,**{name:"true" for name in LIVE_FLAGS},"STRIPE_WEBHOOK_MODE":"live"}
    for name,value in expected.items():
        if name=="LIVE_APPROVED_SKUS_JSON":continue
        row=bindings.get(name,{})
        if row.get("type")!="plain_text" or row.get("text")!=value:raise ValueError("Deployed commercial configuration differs: "+name)
    if {k for k,v in bindings.items() if v.get("type")=="plain_text"}!=set(vars):
        raise ValueError("Unexpected deployed plain-text settings; review before maintenance")
    for name in ("STRIPE_LIVE_SECRET_KEY","STRIPE_LIVE_WEBHOOK_SECRET","SUPABASE_SECRET_KEY"):
        if secret_status(bindings,name)!="Present as encrypted secret":raise ValueError("Missing encrypted binding: "+name)
    raw=bindings.get("LIVE_APPROVED_SKUS_JSON",{}).get("text","")
    approved=json.loads(raw)
    if not isinstance(approved,list) or len(approved) not in (131,229) or not all(isinstance(s,str) and re.fullmatch(r"[A-Z0-9-]{2,24}",s) for s in approved) or len(set(approved))!=len(approved):
        raise ValueError("Approved listing scope changed; review before maintenance")
    # Use the existing approval list, not current availability. Sold and reserved SKUs
    # stay approved but the database still prevents their purchase.
    expected["LIVE_APPROVED_SKUS_JSON"]=raw
    return {**base,"vars":expected}
def main():
    base=json.loads(Path("wrangler.jsonc").read_text())
    config=prepare(base,cloudflare_bindings())
    if "--add-auto" in sys.argv:
        previous=json.loads(config["vars"]["LIVE_APPROVED_SKUS_JSON"])
        manifest=json.loads(Path("release-review/vintage-auto-candidates.json").read_text())
        rows=manifest["products"]
        units={r["sku"] for r in rows if re.fullmatch(r"VA-\\d{3}",r["sku"])}
        sets={r["sku"] for r in rows if re.fullmatch(r"BF-VA-SET\\d{2}",r["sku"])}
        if len(rows)!=98 or len(units)!=80 or len(sets)!=18 or any(not r["units"] or len(set(r["units"]))!=len(r["units"]) or not set(r["units"]).issubset(units) or type(r["price_cents"]) is not int or r["price_cents"]<=0 for r in rows):raise ValueError("Automobile manifest invalid")
        if len(previous)!=131 or set(previous)&(units|sets):raise ValueError("Automobile expansion requires existing 131-item release")
        config["vars"]["LIVE_APPROVED_SKUS_JSON"]=json.dumps(sorted(set(previous)|units|sets),separators=(",",":"))
        print("PASS expanded approval list to 229; original 131 approvals retained; 98 staged automobile listings added.")
    token=os.environ.get("CF_VERIFIED_API_TOKEN","");account=os.environ.get("CF_RESOLVED_ACCOUNT_ID","")
    if not token or not re.fullmatch(r"[0-9a-fA-F]{32}",account):raise ValueError("Verified deployment account unavailable")
    d=cf_api(token,"/accounts/"+account+"/workers/scripts/burtonfound/deployments?per_page=1")
    versions=d["deployments"][0]["versions"]
    if len(versions)!=1 or versions[0].get("percentage")!=100:raise ValueError("Split or unknown active deployment; no automatic maintenance")
    version=versions[0].get("version_id","")
    if not re.fullmatch(r"[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}",version):raise ValueError("Invalid rollback version")
    Path("wrangler.maintenance.generated.jsonc").write_text(json.dumps(config,indent=2)+"\n")
    with open(os.environ["GITHUB_ENV"],"a") as out:out.write("BF_PREVIOUS_LIVE_VERSION="+version+"\n")
    print("PASS preserved live commercial settings and prior 100% traffic version. No deployment or secret values exported.")
if __name__=="__main__":
    try:main()
    except ValueError as e:sys.exit(str(e))
    except Exception:sys.exit("Maintenance configuration could not be verified; no deployment performed.")
