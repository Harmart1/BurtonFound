"""Read-only operational monitoring. No orders, payment sessions, refunds, or customer data exported."""
import json,os,re,sys,subprocess,urllib.request,urllib.error
from audit_stripe_payment_setup import cloudflare_bindings,secret_status
ORIGINS=("https://burtonandfound.ca","https://www.burtonandfound.ca","https://burtonfound.timharmar.workers.dev")
def require(condition,message):
    if not condition:raise RuntimeError(message)
def public(base,path,body=None):
    cmd=["curl","--silent","--show-error","--max-time","20","--write-out","\\n%{http_code}"]
    if body is not None:cmd+=["-H","Origin: "+base,"-H","Content-Type: application/json","--data-binary","@-"]
    p=subprocess.run(cmd+[base+path],input=body,capture_output=True,timeout=25)
    require(p.returncode==0,"Connection failed: "+base+path)
    raw,status=p.stdout.rsplit(b"\n",1)
    try:obj=json.loads(raw)
    except ValueError:obj={}
    return int(status),obj
def main():
    key=os.environ.get("BF_LIVE_KEY","").strip()
    require(re.fullmatch(r"sk_live_[A-Za-z0-9]+",key),"Missing production key")
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self,*args,**kwargs):return None
    opener=urllib.request.build_opener(NoRedirect())
    def stripe(path):
        req=urllib.request.Request("https://api.stripe.com/v1/"+path,headers={"Authorization":"Bearer "+key,"Accept":"application/json"})
        try:
            with opener.open(req,timeout=20) as r:return json.load(r)
        except urllib.error.HTTPError as e:raise RuntimeError("Stripe read failed HTTP "+str(e.code))
    account=stripe("account")
    require(account.get("id")=="acct_1SN2j92NSH96TjSa" and account.get("charges_enabled") is True and account.get("payouts_enabled") is True,"Stripe merchant or payment eligibility requires review")
    endpoints=stripe("webhook_endpoints?limit=100")
    required={"checkout.session.completed","checkout.session.expired","checkout.session.async_payment_succeeded","checkout.session.async_payment_failed"}
    exact=[e for e in endpoints.get("data",[]) if e.get("livemode") is True and e.get("status")=="enabled" and e.get("url")==ORIGINS[0]+"/api/stripe-webhook" and required.issubset(set(e.get("enabled_events",[])))]
    require(not endpoints.get("has_more") and len(exact)==1,"Live Stripe destination is missing, duplicated, incomplete, or disabled")
    bindings=cloudflare_bindings()
    for name in ("STRIPE_LIVE_SECRET_KEY","STRIPE_LIVE_WEBHOOK_SECRET"):
        require(secret_status(bindings,name)=="Present as encrypted secret","Missing encrypted binding: "+name)
    approved=json.loads(bindings.get("LIVE_APPROVED_SKUS_JSON",{}).get("text","[]"))
    require(isinstance(approved,list) and 0<len(approved)<=500 and len(set(approved))==len(approved) and all(isinstance(s,str) and re.fullmatch(r"[A-Z0-9-]{2,24}",s) for s in approved),"Invalid deployed approved inventory list")
    for base in ORIGINS:
        status,h=public(base,"/api/health")
        require(status==200 and h.get("checkout")=="live_mode" and h.get("shippingCountries")==["CA"] and h.get("currency")=="CAD" and [(x.get("country"),x.get("standard"),x.get("express")) for x in h.get("flatRates",[])]==[("CA",1995,3495)],"Live Canada configuration differs: "+base)
        status,c=public(base,"/api/catalog")
        rows=c.get("items",[])
        require(status==200 and c.get("configured") is True and isinstance(rows,list) and all(isinstance(r.get("sku"),str) and type(r.get("available")) is bool and type(r.get("price_cents")) is int and r["price_cents"]>0 for r in rows),"Catalogue unavailable or invalid: "+base)
        require(len({r["sku"] for r in rows})==len(rows),"Duplicate catalogue SKU: "+base)
        require({r["sku"] for r in rows if r.get("checkout_eligible") is True}==set(approved),"Live approved inventory differs: "+base)
        require(public(base,"/api/checkout",b'{"skus":[]}')[0]==400,"Invalid cart not rejected: "+base)
        require(public(base,"/api/admin/orders")[0]==403,"Private order endpoint not protected: "+base)
        print("PASS "+base+" — live checkout, Canada-only rates, approved catalogue, empty cart rejection and private access boundary.")
        if base==ORIGINS[0]:
            available=sum(r.get("checkout_eligible") is True and r.get("available") is True for r in rows)
            print("Approved listings: "+str(len(approved))+"; currently available: "+str(available))
    print("PASS merchant charges/payouts enabled and exact live webhook event coverage verified. No charge or stock mutation.")
if __name__=="__main__":
    try:main()
    except RuntimeError as e:sys.exit(str(e))
    except Exception:sys.exit("Live commerce monitor could not verify all checks; inspect run. No secrets or raw provider data printed.")
