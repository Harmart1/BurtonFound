"""Explicitly authorized, unpaid live Checkout smoke test. Creates one temporary stock hold and expires only its own session. Never supplies a card or creates a payment."""
import json,os,re,sys,time,subprocess,urllib.request,urllib.error
BASE="https://burtonandfound.ca"
SKU=os.environ.get("BF_SMOKE_SKU","CC-010")
if SKU not in ("CC-010","VA-001","BF-VA-SET01"):sys.exit("Unsupported verification SKU")
KEY=os.environ.get("BF_LIVE_KEY","").strip()
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):return None
opener=urllib.request.build_opener(NoRedirect())
def check(ok,msg):
    if not ok:raise RuntimeError(msg)
def public(path,payload=None):
    cmd=["curl","--silent","--show-error","--max-time","20","-w","\\n%{http_code}"]
    data=None
    if payload is not None:
        data=json.dumps(payload).encode()
        cmd+=["-H","Origin: "+BASE,"-H","Content-Type: application/json","--data-binary","@-"]
    p=subprocess.run(cmd+[BASE+path],input=data,capture_output=True,timeout=25)
    check(p.returncode==0,"Public request did not complete: "+path)
    raw,code=p.stdout.rsplit(b"\n",1)
    try:obj=json.loads(raw)
    except ValueError:obj={}
    check(code==b"200","Public request "+path+" returned HTTP "+code.decode("ascii"))
    return obj
def stripe(path,post=False):
    req=urllib.request.Request("https://api.stripe.com/v1/"+path,headers={"Authorization":"Bearer "+KEY,"Accept":"application/json"},data=b"" if post else None,method="POST" if post else "GET")
    try:
        with opener.open(req,timeout=20) as r:return json.load(r)
    except urllib.error.HTTPError as e:raise RuntimeError("Stripe verification HTTP "+str(e.code))
def stock():
    d=public("/api/catalog")
    rows=[x for x in d.get("items",[]) if x.get("sku")==SKU]
    check(d.get("configured") is True and len(rows)==1,"Selected smoke SKU missing")
    return rows[0]
def main():
    check(re.fullmatch(r"sk_live_[A-Za-z0-9]+",KEY),"Production credential unavailable")
    a=stripe("account")
    check(a.get("id")=="acct_1SN2j92NSH96TjSa" and a.get("charges_enabled") is True and a.get("payouts_enabled") is True,"Incorrect or ineligible merchant")
    h=public("/api/health")
    check(h.get("checkout")=="live_mode" and h.get("shippingCountries")==["CA"],"Live Canadian store not confirmed")
    before=stock()
    check(before.get("available") is True and before.get("checkout_eligible") is True and type(before.get("price_cents")) is int,"Designated smoke SKU not currently available; no session created")
    sid=None
    try:
        r=public("/api/checkout",{"skus":[SKU],"shipping_country":"CA","terms_version":"CA-2026-11-28"})
        sid=r.get("session_id")
        check(re.fullmatch(r"cs_live_[A-Za-z0-9_]{12,160}",sid or "") and str(r.get("url","")).startswith("https://checkout.stripe.com/"),"Live Checkout URL not verified; inspect holds if necessary")
        s=stripe("checkout/sessions/"+sid)
        check(s.get("id")==sid and s.get("livemode") is True and s.get("status")=="open" and s.get("payment_status")=="unpaid" and s.get("currency")=="cad" and s.get("metadata",{}).get("source")=="burton-found" and s.get("metadata",{}).get("bf_terms_version")=="CA-2026-11-28" and s.get("amount_subtotal")==before["price_cents"] and s.get("shipping_address_collection",{}).get("allowed_countries")==["CA"],"Live session identity, subtotal or shipping destination mismatch")
        if os.environ.get("BF_VERIFY_BRANDING")=="true":
            check(s.get("branding_settings",{}).get("display_name")=="Burton and Found","Stripe Checkout display name not confirmed")
            print("PASS live Stripe Checkout display name is Burton and Found.")
        opts=s.get("shipping_options") or []
        prices=[]
        for o in opts:
            rate=o.get("shipping_rate","")
            check(re.fullmatch(r"shr_[A-Za-z0-9]+",rate),"Unexpected shipping rate reference")
            fixed=stripe("shipping_rates/"+rate).get("fixed_amount",{})
            check(fixed.get("currency")=="cad","Shipping currency mismatch")
            prices.append(fixed.get("amount"))
        check(sorted(prices)==[1995,3495],"Live shipping amounts mismatch")
        print("PASS actual live storefront created an unpaid Stripe-hosted Checkout session with correct product price and both approved Canadian shipping options.")
        if os.environ.get("BF_VERIFY_CANCELLATION")=="true":
            token=r.get("cancel_token")
            check(re.fullmatch(r"[a-f0-9]{64}",token or ""),"Cancellation capability missing")
            check(stock().get("available") is False,"Reserved original not protected")
            release=public("/api/checkout-cancel",{"session_id":sid,"cancel_token":token})
            check(release.get("released") is True,"Customer cancellation did not confirm unpaid release")
            check(stock().get("available") is True,"Cancelled original did not return to available inventory")
            print("PASS live shopper cancellation restored the reserved original to available stock without charging a card.")
    finally:
        if isinstance(sid,str) and re.fullmatch(r"cs_live_[A-Za-z0-9_]{12,160}",sid):
            s=stripe("checkout/sessions/"+sid)
            check(s.get("id")==sid and s.get("livemode") is True and s.get("metadata",{}).get("source")=="burton-found" and s.get("payment_status")=="unpaid","Unexpected live session state; manual reconciliation required")
            if s.get("status")=="open":s=stripe("checkout/sessions/"+sid+"/expire",post=True)
            check(s.get("status")=="expired" and s.get("payment_status")=="unpaid","Unpaid expiry not confirmed; inspect owner holds")
            print("PASS expired the exact unpaid smoke session; no card, charge or refund created.")
    for i in range(12):
        state=public("/api/checkout-status?session_id="+sid)
        if state.get("status")=="expired":
            print("PASS checkout expiry recorded by the store; no paid order created.")
            return
        time.sleep(2)
    raise RuntimeError("Stripe expiry confirmed but storefront expiry has not propagated; inspect owner holds.")
if __name__=="__main__":
    try:main()
    except RuntimeError as e:sys.exit(str(e))
    except Exception:sys.exit("Unpaid checkout verification interrupted. Inspect owner holds; no raw session, credentials or customer details printed.")
