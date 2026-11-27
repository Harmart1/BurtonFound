#!/usr/bin/env python3
"""Read-only evidence for an existing, explicitly marked Stripe sandbox QA run.
No payments, refund creation, endpoint updates or secret logging."""
import importlib.util, os, re, sys, urllib.parse
from pathlib import Path
spec=importlib.util.spec_from_file_location("provider",Path(__file__).with_name("stripe-sandbox-provider-qa.py"))
p=importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)
run=os.environ.get("QA_EVIDENCE_RUN","")
required={"checkout.session.completed","checkout.session.expired","checkout.session.async_payment_succeeded","checkout.session.async_payment_failed"}
def check(c,m):
    if not c: raise RuntimeError(m)
def main():
    check(re.fullmatch(r"sk_test_[A-Za-z0-9]+",p.KEY) and re.fullmatch(r"\d+-\d+",run),"Test credentials or prior-run reference invalid")
    a,_=p.stripe("account")
    check(a.get("id")==p.MERCHANT,"Wrong sandbox merchant")
    p.probe()
    print("PASS matching test merchant, preview-only and signed isolation preflight")
    data,_=p.stripe("payment_intents?limit=100")
    matches=[x for x in data.get("data",[]) if x.get("metadata",{}).get("bf_qa_run")==run and x.get("metadata",{}).get("bf_isolated_qa")==p.MARK]
    check(len(matches)==1,"Expected exactly one prior marked payment in bounded query")
    pi=matches[0]
    check(pi.get("livemode") is False and pi.get("status")=="succeeded" and pi.get("currency")=="cad" and pi.get("amount_received")==1500,"Prior marked test payment mismatch")
    charge_id=pi.get("latest_charge","")
    check(isinstance(charge_id,str) and re.fullmatch(r"ch_[A-Za-z0-9]+",charge_id),"Test charge reference invalid")
    ch,_=p.stripe("charges/"+charge_id)
    check(ch.get("livemode") is False and ch.get("payment_intent")==pi["id"] and ch.get("paid") is True and ch.get("currency")=="cad" and ch.get("amount")==1500,"Test charge mismatch")
    print("PASS existing CAD 15.00 sandbox card charge verified; no duplicate charge")
    print("Stripe hosted receipt URL present: "+("YES" if str(ch.get("receipt_url","")).startswith("https://") else "NO")+"; inbox delivery not tested")
    refunds,_=p.stripe("refunds?"+urllib.parse.urlencode({"payment_intent":pi["id"],"limit":100}))
    rows=[r for r in refunds.get("data",[]) if r.get("metadata",{}).get("bf_qa_run")==run and r.get("metadata",{}).get("bf_isolated_qa")==p.MARK]
    valid=[r for r in rows if r.get("object")=="refund" and r.get("payment_intent")==pi["id"] and r.get("charge")==charge_id and r.get("currency")=="cad" and r.get("amount")==1500]
    if len(valid)==1 and valid[0].get("status")=="succeeded" and ch.get("amount_refunded")==1500 and ch.get("refunded") is True:
        print("PASS existing CAD 15.00 sandbox refund succeeded; no duplicate refund")
    else:
        status=valid[0].get("status") if len(valid)==1 else None
        print("REVIEW prior refund status: "+(status if status in ("pending","requires_action","succeeded","failed","canceled") else "unknown"))
    classic,_=p.stripe("webhook_endpoints?limit=100")
    enabled=[x for x in classic.get("data",[]) if x.get("livemode") is False and x.get("status")=="enabled"]
    matching=[x for x in enabled if x.get("url")==p.APP+"/api/stripe-webhook"]
    complete=[x for x in matching if required.issubset(set(x.get("enabled_events",[]))) or "*" in x.get("enabled_events",[])]
    print("Classic test endpoints: enabled="+str(len(enabled))+", correct URL="+str(len(matching))+", required events="+str(len(complete))+"; more pages="+str(bool(classic.get("has_more"))))
    url="https://api.stripe.com/v2/core/event_destinations?"+urllib.parse.urlencode({"include[0]":"webhook_endpoint.url","limit":100})
    status,body=p.request(url,headers={"Authorization":"Bearer "+p.KEY,"Stripe-Version":"2026-11-18.endive","Accept":"application/json"})
    if status==200:
        active=[x for x in body.get("data",[]) if x.get("livemode") is False and x.get("status")=="enabled"]
        dest=[x for x in active if x.get("type")=="webhook_endpoint" and (x.get("webhook_endpoint") or {}).get("url")==p.APP+"/api/stripe-webhook"]
        full=[x for x in dest if x.get("event_payload")=="snapshot" and required.issubset({e.removeprefix("v1.") for e in x.get("enabled_events",[])})]
        print("V2 test event destinations: enabled="+str(len(active))+", correct URL="+str(len(dest))+", required snapshot events="+str(len(full))+"; more pages="+str(bool(body.get("next_page_url"))))
    else:
        print("V2 destination inspection unavailable (HTTP "+str(status)+")")
    print("Read-only evidence check completed; no payment, refund or webhook mutation.")
if __name__=="__main__":
    try: main()
    except RuntimeError as e: sys.exit(str(e))
    except Exception: sys.exit("Evidence check failed; no raw provider objects or credentials printed")
