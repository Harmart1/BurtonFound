"""Verify only the owner-configured production webhook. No charge or order creation."""
import hashlib,hmac,json,os,re,sys,time,urllib.request,urllib.error
from audit_stripe_payment_setup import cloudflare_bindings,secret_status
def main():
    sign=os.environ.get("BF_LIVE_WEBHOOK","").strip()
    if not re.fullmatch(r"whsec_[A-Za-z0-9]+",sign):
        sys.exit("Production signing credential not present in GitHub or wrong format.")
    bindings=cloudflare_bindings()
    for name in ("STRIPE_LIVE_SECRET_KEY","STRIPE_LIVE_WEBHOOK_SECRET"):
        if secret_status(bindings,name)!="Present as encrypted secret":
            sys.exit("Required encrypted Worker binding missing or not secret: "+name)
    for name in ("LIVE_CHECKOUT_ENABLED","LIVE_PAYMENTS_APPROVED"):
        if bindings.get(name,{}).get("text")!="false":
            sys.exit("Unexpected checkout configuration; stop staging verification.")
    payload=json.dumps({"id":"evt_bf_live_staging_probe","type":"bf.integration.live_probe","livemode":True},separators=(",",":")).encode()
    stamp=str(int(time.time()))
    signature=hmac.new(sign.encode(),stamp.encode()+b"."+payload,hashlib.sha256).hexdigest()
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self,*args,**kwargs):return None
    opener=urllib.request.build_opener(NoRedirect())
    def probe(base,sig):
        req=urllib.request.Request(base+"/api/stripe-webhook",data=payload,headers={"Content-Type":"application/json","Stripe-Signature":"t="+stamp+",v1="+sig})
        try:
            with opener.open(req,timeout=20) as r:return r.status,json.load(r)
        except urllib.error.HTTPError as e:return e.code,{}
    for base in ("https://burtonandfound.ca","https://www.burtonandfound.ca","https://burtonfound.timharmar.workers.dev"):
        with opener.open(base+"/api/health",timeout=20) as r:health=json.load(r)
        if health.get("checkout")!="preview_only":sys.exit("Unexpected payment state at "+base)
        status,body=probe(base,signature)
        if status!=200 or body.get("live_probe") is not True:sys.exit("Production signature probe rejected at "+base+" (HTTP "+str(status)+")")
        if probe(base,"0"*64)[0]!=400:sys.exit("Invalid signature not rejected at "+base)
        print("PASS "+base+" — production signature accepted, invalid signature rejected, checkout remains disabled.")
    print("No real Stripe events, orders, inventory reservations, payments or refunds created.")
if __name__=="__main__":
    try:main()
    except Exception:sys.exit("Production webhook verification unavailable; inspect provider configuration. No raw response or secret printed.")
