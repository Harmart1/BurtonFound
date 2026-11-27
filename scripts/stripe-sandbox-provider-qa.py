#!/usr/bin/env python3
"""Authorized, test-only provider check. Never accesses a production database or emits raw API objects."""
import hashlib,hmac,json,os,re,sys,time,subprocess,urllib.parse,urllib.request,urllib.error
KEY=os.environ.get("BF_TEST_KEY","")
SIGN=os.environ.get("BF_TEST_WEBHOOK","")
MARK="burtonfound-sandbox-v1"
RUN=os.environ.get("GITHUB_RUN_ID","")+"-"+os.environ.get("GITHUB_RUN_ATTEMPT","")
MERCHANT="acct_1SN2j92NSH96TjSa"
APP="https://burtonfound.timharmar.workers.dev"
def check(condition,message):
    if not condition: raise RuntimeError(message)
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs): return None
opener=urllib.request.build_opener(NoRedirect())
def request(url,method="GET",fields=None,headers=None):
    req=urllib.request.Request(url,data=fields,method=method,headers=headers or {})
    try:
        with opener.open(req,timeout=25) as res: return res.status,json.load(res)
    except urllib.error.HTTPError as exc:
        return exc.code,{}
def stripe(path,fields=None,tag=None,allow=None):
    headers={"Authorization":"Bearer "+KEY,"Accept":"application/json"}
    method="GET" if fields is None else "POST"
    data=None if fields is None else urllib.parse.urlencode(fields).encode()
    if data is not None: headers["Content-Type"]="application/x-www-form-urlencoded"
    if tag: headers["Idempotency-Key"]="bf-qa-"+RUN+"-"+tag
    status,body=request("https://api.stripe.com/v1/"+path,method,data,headers)
    check(status==200 or status==allow,"Stripe "+path.split("/")[0]+" HTTP "+str(status))
    return body,status
def own(obj,prefix):
    return obj.get("livemode") is False and str(obj.get("id","")).startswith(prefix) and obj.get("metadata",{}).get("bf_isolated_qa")==MARK and obj.get("metadata",{}).get("bf_qa_run")==RUN
def public_request(path,body=None,headers=None):
    # Match the deployed smoke check's curl transport. No redirects, no raw bodies or secrets in logs.
    cmd=["curl","--silent","--show-error","--max-time","20","--write-out","\\n%{http_code}","--request","POST" if body is not None else "GET"]
    for k,v in (headers or {}).items(): cmd+=["--header",k+": "+v]
    if body is not None: cmd+=["--data-binary","@-"]
    result=subprocess.run(cmd+[APP+path],input=body,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=25,check=False)
    check(result.returncode==0,"Public safety probe connection failed")
    raw,code=result.stdout.rsplit(b"\n",1)
    status=int(code)
    try: return status,json.loads(raw)
    except (ValueError,UnicodeError): return status,{}
def probe():
    status,health=public_request("/api/health")
    check(status==200 and health.get("checkout")=="preview_only","Public checkout safety not confirmed (HTTP "+str(status)+")")
    body=json.dumps({"id":"evt_bf_isolation_probe","type":"bf.integration.isolation_probe","livemode":False,"data":{"object":{"id":"cs_test_bf_isolation_probe","livemode":False,"metadata":{"bf_isolated_qa":MARK}}}},separators=(",",":")).encode()
    t=str(int(time.time()))
    sig=hmac.new(SIGN.encode(),t.encode()+b"."+body,hashlib.sha256).hexdigest()
    status,r=public_request("/api/stripe-webhook",body,{"Content-Type":"application/json","Stripe-Signature":"t="+t+",v1="+sig})
    check(status==200 and r.get("qa_isolated") is True,"Deployed isolation guard not confirmed (HTTP "+str(status)+"); no Stripe test writes")
def main():
    check(re.fullmatch(r"sk_test_[A-Za-z0-9]+",KEY) and SIGN.startswith("whsec_"),"Missing test-only credentials")
    check(re.fullmatch(r"\d+-\d+",RUN),"Missing CI run identity")
    account,_=stripe("account")
    check(account.get("id")==MERCHANT,"Wrong Stripe test merchant")
    probe()
    print("PASS verified test merchant, disabled public checkout and signed isolation guard")
    common={"metadata[bf_isolated_qa]":MARK,"metadata[bf_qa_run]":RUN}
    # Guard against unintended other test destinations receiving Checkout events.
    endpoints,_=stripe("webhook_endpoints?limit=100")
    check(not endpoints.get("has_more"),"Webhook destinations exceed safe audit limit")
    enabled=[e for e in endpoints.get("data",[]) if e.get("status")=="enabled"]
    for e in enabled:
        check(e.get("url")==APP+"/api/stripe-webhook","Unexpected enabled sandbox webhook destination; no test writes")
    print("Enabled matching classic sandbox webhook endpoints: "+str(len(enabled))+"; actual delivery is not asserted")
    session=None
    try:
        session,_=stripe("checkout/sessions",{
            **common,"mode":"payment","payment_method_types[0]":"card",
            "success_url":"https://example.invalid/qa/success?session_id={CHECKOUT_SESSION_ID}",
            "cancel_url":"https://example.invalid/qa/cancel",
            "line_items[0][price_data][currency]":"cad","line_items[0][price_data][unit_amount]":"1000",
            "line_items[0][price_data][product_data][name]":"Burton & Found ISOLATED QA - NOT FOR FULFILMENT",
            "line_items[0][quantity]":"1","shipping_address_collection[allowed_countries][0]":"CA",
            "shipping_options[0][shipping_rate_data][type]":"fixed_amount",
            "shipping_options[0][shipping_rate_data][fixed_amount][currency]":"cad",
            "shipping_options[0][shipping_rate_data][fixed_amount][amount]":"500",
            "shipping_options[0][shipping_rate_data][display_name]":"Synthetic QA shipping",
            "expires_at":str(int(time.time())+1860)
        },"session")
        check(own(session,"cs_test_") and session.get("status")=="open" and session.get("currency")=="cad" and session.get("amount_subtotal")==1000 and session.get("amount_total") in (1000,1500) and session.get("payment_status")=="unpaid" and str(session.get("url","")).startswith("https://checkout.stripe.com/"),"Unexpected checkout session state")
        options=session.get("shipping_options") or []
        check(len(options)==1,"Synthetic checkout shipping option missing")
        rate_id=options[0].get("shipping_rate","")
        check(isinstance(rate_id,str) and re.fullmatch(r"shr_[A-Za-z0-9]+",rate_id),"Unexpected shipping rate reference")
        rate,_=stripe("shipping_rates/"+rate_id)
        check(rate.get("livemode") is False and rate.get("fixed_amount",{}).get("amount")==500 and rate.get("fixed_amount",{}).get("currency")=="cad","Synthetic shipping option price mismatch")
        print("PASS real Stripe sandbox hosted Checkout Session created; CAD 10.00 subtotal and CAD 5.00 shipping option")
    finally:
        if session and own(session,"cs_test_") and session.get("status")=="open":
            expired,_=stripe("checkout/sessions/"+session["id"]+"/expire",{},"expire")
            check(own(expired,"cs_test_") and expired.get("id")==session["id"] and expired.get("status")=="expired" and expired.get("payment_status")=="unpaid","Test session expiration not confirmed")
            print("PASS real Stripe sandbox checkout expiration")
    pi=None
    try:
        pi,_=stripe("payment_intents",{**common,"amount":"1500","currency":"cad","payment_method_types[0]":"card","payment_method":"pm_card_visa","confirm":"true","description":"Burton & Found isolated QA test only"},"payment")
        check(own(pi,"pi_") and pi.get("status")=="succeeded" and pi.get("amount_received")==1500 and pi.get("currency")=="cad","Test PaymentIntent did not succeed")
        print("PASS real Stripe sandbox test-card PaymentIntent succeeded (separate from hosted Checkout)")
    finally:
        if pi and own(pi,"pi_") and pi.get("status")=="succeeded":
            refund,_=stripe("refunds",{**common,"payment_intent":pi["id"],"amount":"1500"},"refund")
            check(refund.get("object")=="refund" and refund.get("amount")==1500 and refund.get("currency")=="cad" and refund.get("payment_intent")==pi["id"] and refund.get("metadata",{}).get("bf_qa_run")==RUN and refund.get("status") in ("succeeded","pending"),"Test refund not confirmed")
            print("PASS real Stripe sandbox refund request accepted; status "+refund["status"])
    probe()
    print("PASS public preview remains disabled and isolated")
if __name__=="__main__":
    try: main()
    except RuntimeError as exc: sys.exit(str(exc))
    except Exception: sys.exit("Provider QA failed; no raw provider response or credentials printed")
