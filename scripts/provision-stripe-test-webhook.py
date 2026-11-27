#!/usr/bin/env python3
"""Owner-authorized, test-only initial webhook provisioning.
Never print, store in artifacts, or return generated signing secret."""
import importlib.util,json,os,re,sys,time,urllib.parse,urllib.request,urllib.error
from pathlib import Path
spec=importlib.util.spec_from_file_location("provider",Path(__file__).with_name("stripe-sandbox-provider-qa.py"))
p=importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)
events=["checkout.session.completed","checkout.session.expired","checkout.session.async_payment_succeeded","checkout.session.async_payment_failed"]
endpoint=p.APP+"/api/stripe-webhook"
def check(c,m):
    if not c: raise RuntimeError(m)
def cf_factory():
    raw=os.environ.get("CF_TOKEN","").strip()
    token=raw.strip("\"'")
    if token.lower().startswith("bearer "): token=token[7:].strip().strip("\"'")
    if not re.fullmatch(r"[A-Za-z0-9_.-]+",token):
        hits=re.findall(r"cf(?:at|ut)_[A-Za-z0-9_.-]+",raw)
        token=hits[0] if len(hits)==1 else ""
    check(bool(token),"Cloudflare authorization missing")
    def req(path,method="GET",data=None):
        headers={"Authorization":"Bearer "+token,"Accept":"application/json"}
        if data is not None: headers["Content-Type"]="application/json"
        status,r=p.request("https://api.cloudflare.com/client/v4"+path,method,json.dumps(data).encode() if data is not None else None,headers)
        check(status==200 and r.get("success") is True,"Cloudflare request failed (HTTP "+str(status)+"); no response body logged")
        return r.get("result")
    hint=os.environ.get("CF_ACCOUNT_HINT","")
    ids=re.findall(r"(?<![a-fA-F0-9])[a-fA-F0-9]{32}(?![a-fA-F0-9])",hint)
    check(len(ids)<=1,"Ambiguous Cloudflare account")
    candidates=ids or [x.get("id","") for x in req("/accounts?per_page=50")]
    matches=[x for x in candidates if re.fullmatch(r"[A-Fa-f0-9]{32}",x) and any(w.get("id")=="burtonfound" for w in req("/accounts/"+x+"/workers/scripts") or [])]
    check(len(matches)==1,"Existing Worker not uniquely identified")
    return req,"/accounts/"+matches[0]+"/workers/scripts/burtonfound"
def main():
    check(re.fullmatch(r"sk_test_[A-Za-z0-9]+",p.KEY),"Test-only Stripe credential required")
    account,_=p.stripe("account")
    check(account.get("id")==p.MERCHANT,"Wrong merchant")
    p.probe()
    cf,path=cf_factory()
    def gates():
        bindings={x.get("name"):x for x in (cf(path+"/settings") or {}).get("bindings",[])}
        for name,value in {"LIVE_CHECKOUT_ENABLED":"false","LIVE_PAYMENTS_APPROVED":"false","CARRIER_QUOTES_ENABLED":"false","STRIPE_WEBHOOK_MODE":"test"}.items():
            b=bindings.get(name,{})
            check(b.get("type")=="plain_text" and b.get("text")==value,"Worker safety gate not confirmed: "+name)
    gates()
    current,_=p.stripe("webhook_endpoints?limit=100")
    check(not current.get("has_more"),"Classic destinations incomplete")
    check(not current.get("data"),"Existing classic endpoint found; refuse duplicate or replacement")
    url="https://api.stripe.com/v2/core/event_destinations?"+urllib.parse.urlencode({"include[0]":"webhook_endpoint.url","limit":100})
    status,dest=p.request(url,headers={"Authorization":"Bearer "+p.KEY,"Stripe-Version":"2026-11-18.endive","Accept":"application/json"})
    check(status==200 and not dest.get("next_page_url") and not dest.get("data"),"Existing or unverified v2 destination; refuse duplicate")
    args={"url":endpoint,"description":"Burton & Found test-only Checkout webhooks","metadata[bf_environment]":"sandbox"}
    for i,event in enumerate(events): args["enabled_events["+str(i)+"]"]=event
    obj,_=p.stripe("webhook_endpoints",args,"create-webhook")
    check(obj.get("livemode") is False and obj.get("status")=="enabled" and obj.get("url")==endpoint and set(obj.get("enabled_events",[]))==set(events),"Created destination not verified")
    secret=obj.get("secret","")
    check(re.fullmatch(r"whsec_[A-Za-z0-9]+",secret),"New endpoint signing secret unavailable")
    print("PASS created the exact test-only Stripe webhook with four required Checkout events")
    # The prior GitHub signing secret is now obsolete. The replacement is sent directly
    # to the existing Worker secret API, never logged. Owner synchronizes GitHub separately.
    gates()
    cf(path+"/secrets","PUT",{"name":"STRIPE_WEBHOOK_SECRET","text":secret,"type":"secret_text"})
    check(cf(path+"/secrets/STRIPE_WEBHOOK_SECRET").get("type")=="secret_text","Encrypted Worker secret not confirmed")
    p.SIGN=secret
    secret=None
    obj.pop("secret",None)
    p.probe()
    print("PASS new endpoint signing secret installed and verified against deployed test isolation guard")
    gates()
    # No real inventory or charge: create and expire a marked Checkout Session.
    stamp=int(time.time())
    common={"metadata[bf_isolated_qa]":p.MARK,"metadata[bf_qa_run]":p.RUN,"mode":"payment","payment_method_types[0]":"card",
      "success_url":"https://example.invalid/qa/success","cancel_url":"https://example.invalid/qa/cancel",
      "line_items[0][price_data][currency]":"cad","line_items[0][price_data][unit_amount]":"1000",
      "line_items[0][price_data][product_data][name]":"Burton & Found isolated webhook QA - NOT FOR FULFILMENT","line_items[0][quantity]":"1",
      "expires_at":str(stamp+1860)}
    s,_=p.stripe("checkout/sessions",common,"webhook-qa-session")
    check(p.own(s,"cs_test_") and s.get("status")=="open" and s.get("payment_status")=="unpaid","Test-only session identity invalid")
    expired,_=p.stripe("checkout/sessions/"+s["id"]+"/expire",{},"webhook-qa-expire")
    check(p.own(expired,"cs_test_") and expired.get("id")==s["id"] and expired.get("status")=="expired" and expired.get("payment_status")=="unpaid","Test-only expiry not confirmed")
    for _ in range(10):
        listing,_=p.stripe("events?"+urllib.parse.urlencode({"type":"checkout.session.expired","created[gte]":stamp-5,"limit":100}))
        matched=[e for e in listing.get("data",[]) if e.get("livemode") is False and (e.get("data",{}).get("object") or {}).get("id")==s["id"]]
        if len(matched)==1 and matched[0].get("pending_webhooks")==0:
            print("PASS Stripe generated marked expiry event; pending webhook deliveries zero (verify individual delivery in Workbench)")
            break
        time.sleep(3)
    else: print("REVIEW marked expiry delivery not yet confirmed; inspect Stripe Workbench")
    p.probe()
    print("PASS checkout remains preview-only; no live payments, production inventory or real customer records used")
    print("OWNER: synchronize BF_STRIPE_TEST_WEBHOOK_SECRET in GitHub from this new test endpoint before any future Stripe install or signed verification workflow")
if __name__=="__main__":
    try: main()
    except RuntimeError as e: sys.exit(str(e))
    except Exception: sys.exit("Webhook setup interrupted; inspect Stripe Workbench before retrying; no raw credentials or provider data logged")
