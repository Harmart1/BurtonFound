"""No card or charge: check provider branding support before changing the live storefront."""
import json,os,re,sys,urllib.request,urllib.parse,urllib.error
key=os.environ.get("BF_LIVE_KEY","").strip()
def require(ok,message):
    if not ok:raise RuntimeError(message)
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):return None
opener=urllib.request.build_opener(NoRedirect())
def stripe(path,fields=None):
    body=None if fields is None else urllib.parse.urlencode(fields).encode()
    req=urllib.request.Request("https://api.stripe.com/v1/"+path,data=body,headers={"Authorization":"Bearer "+key,"Accept":"application/json","Content-Type":"application/x-www-form-urlencoded"})
    try:
        with opener.open(req,timeout=20) as r:return json.load(r)
    except urllib.error.HTTPError as e:raise RuntimeError("Stripe brand probe returned HTTP "+str(e.code))
def main():
    require(re.fullmatch(r"sk_live_[A-Za-z0-9]+",key),"Missing live key")
    a=stripe("account")
    require(a.get("id")=="acct_1SN2j92NSH96TjSa" and a.get("charges_enabled") is True,"Wrong merchant or payments unavailable")
    sid=None
    try:
        s=stripe("checkout/sessions",{"mode":"payment","payment_method_types[0]":"card","success_url":"https://burtonandfound.ca/","cancel_url":"https://burtonandfound.ca/","line_items[0][price_data][currency]":"cad","line_items[0][price_data][unit_amount]":"100","line_items[0][price_data][product_data][name]":"Unpaid internal branding verification","line_items[0][quantity]":"1","branding_settings[display_name]":"Burton and Found","metadata[bf_isolated_qa]":"burtonfound-brand-check-v1"})
        sid=s.get("id")
        require(re.fullmatch(r"cs_live_[A-Za-z0-9_]{12,160}",sid or "") and s.get("livemode") is True and s.get("payment_status")=="unpaid","Unexpected Stripe session")
        require(s.get("branding_settings",{}).get("display_name")=="Burton and Found","Stripe did not confirm requested branding")
        print("PASS Stripe accepts Burton and Found display name on a live hosted session.")
    finally:
        if isinstance(sid,str) and re.fullmatch(r"cs_live_[A-Za-z0-9_]{12,160}",sid):
            s=stripe("checkout/sessions/"+sid)
            require(s.get("metadata",{}).get("bf_isolated_qa")=="burtonfound-brand-check-v1" and s.get("payment_status")=="unpaid","Unexpected probe session; review manually")
            if s.get("status")=="open":s=stripe("checkout/sessions/"+sid+"/expire",{})
            require(s.get("status")=="expired" and s.get("payment_status")=="unpaid","Probe expiry not confirmed")
            print("PASS isolated session expired unpaid; no stock reserved, no payment made.")
if __name__=="__main__":
    try:main()
    except RuntimeError as e:sys.exit(str(e))
    except Exception:sys.exit("Stripe brand probe interrupted; inspect provider state.")
