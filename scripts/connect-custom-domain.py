#!/usr/bin/env python3
"""Owner-authorized domain attach: exact domain, existing Worker, no DNS overwrite, no billing or payment changes."""
import json,os,re,subprocess,sys,urllib.request,urllib.error,urllib.parse,time
DOMAIN="burtonandfound.ca"
WORKER="burtonfound"
OLD="https://burtonfound.timharmar.workers.dev"
raw=os.environ.get("CF_TOKEN","").strip()
token=raw.strip("\"'")
if token.lower().startswith("bearer "):token=token[7:].strip().strip("\"'")
if not re.fullmatch(r"[A-Za-z0-9_.-]+",token):
    matches=re.findall(r"cf(?:at|ut)_[A-Za-z0-9_.-]+",raw)
    token=matches[0] if len(matches)==1 else ""
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):return None
opener=urllib.request.build_opener(NoRedirect())
def request(path,method="GET",body=None):
    headers={"Authorization":"Bearer "+token,"Accept":"application/json"}
    if body is not None:headers["Content-Type"]="application/json"
    req=urllib.request.Request("https://api.cloudflare.com/client/v4"+path,method=method,headers=headers,data=json.dumps(body).encode() if body is not None else None)
    try:
        with opener.open(req,timeout=20) as r:j=json.load(r)
    except urllib.error.HTTPError as e:raise RuntimeError("Cloudflare "+method+" "+path.split("?")[0].split("/")[-1]+" HTTP "+str(e.code)+"; no provider response printed") from None
    if j.get("success") is not True:raise RuntimeError("Cloudflare rejected scoped operation")
    return j
def ensure(c,msg):
    if not c:raise RuntimeError(msg)
def ns_lookup():
    try:
        req=urllib.request.Request("https://dns.google/resolve?"+urllib.parse.urlencode({"name":DOMAIN,"type":"NS"}),headers={"Accept":"application/dns-json"})
        with opener.open(req,timeout=12) as r:j=json.load(r)
        ns=sorted({x["data"].rstrip(".").lower() for x in j.get("Answer",[]) if x.get("type")==2 and re.fullmatch(r"[A-Za-z0-9.-]+",x.get("data",""))})
        print("Public nameservers: "+(", ".join(ns) if ns else "not yet resolved"))
        return ns
    except Exception:
        print("Public DNS lookup unavailable")
        return []
def public_check(origin):
    r=subprocess.run(["curl","--silent","--max-time","15","--write-out","\\n%{http_code}",origin+"/api/health"],capture_output=True,text=True,timeout=20)
    try:
        body,code=r.stdout.rsplit("\n",1)
        j=json.loads(body)
        return r.returncode==0 and code=="200" and j.get("service")=="Burton & Found" and j.get("checkout")=="preview_only"
    except (ValueError,AttributeError):return False
def dns_status(host):
    for typ in ("A","AAAA","CNAME"):
        try:
            req=urllib.request.Request("https://dns.google/resolve?"+urllib.parse.urlencode({"name":host,"type":typ}),headers={"Accept":"application/dns-json"})
            with opener.open(req,timeout=12) as r:j=json.load(r)
            count=sum(1 for x in j.get("Answer",[]) if x.get("type")=={"A":1,"AAAA":28,"CNAME":5}[typ])
            print("Public DNS "+host+" "+typ+": status="+str(j.get("Status"))+" records="+str(count))
        except Exception:print("Public DNS "+host+" "+typ+": lookup unavailable")
def main():
    ns=ns_lookup()
    for host in (DOMAIN,"www."+DOMAIN):
        dns_status(host)
        print("Public HTTPS "+host+": "+("PASS Burton & Found preview-only health" if public_check("https://"+host) else "not verified"))
    ensure(token,"Missing Cloudflare deployment token")
    ensure(public_check(OLD),"Existing preview health not confirmed; no routing changes")
    ids=re.findall(r"(?<![a-fA-F0-9])[a-fA-F0-9]{32}(?![a-fA-F0-9])",os.environ.get("CF_ACCOUNT_HINT",""))
    ensure(len(ids)<=1,"Ambiguous Cloudflare account")
    accounts=ids or [x.get("id","") for x in request("/accounts?per_page=50")["result"]]
    found=[a for a in accounts if re.fullmatch(r"[a-fA-F0-9]{32}",a) and any(x.get("id")==WORKER for x in request("/accounts/"+a+"/workers/scripts")["result"])]
    ensure(len(found)==1,"Existing Worker not uniquely identified")
    account=found[0]
    print("PASS existing Burton & Found Worker found; preview-only health verified")
    zones=request("/zones?"+urllib.parse.urlencode({"name":DOMAIN,"account.id":account,"per_page":50}))["result"]
    exact=[z for z in zones if z.get("name")==DOMAIN and z.get("account",{}).get("id")==account]
    ensure(len(exact)==1,"BLOCKED: add burtonandfound.ca as a Cloudflare zone in the same account first (or grant this token Zone Read); no zone or DNS changes made")
    z=exact[0]
    assigned=sorted({x.rstrip(".").lower() for x in z.get("name_servers",[]) if re.fullmatch(r"[A-Za-z0-9.-]+",x)})
    print("Cloudflare zone status: "+str(z.get("status")))
    print("Assigned Cloudflare nameservers: "+(", ".join(assigned) if assigned else "unavailable"))
    ensure(z.get("status")=="active","BLOCKED: Cloudflare zone not active; complete nameserver delegation at your registrar")
    ensure(bool(ns) and bool(assigned) and set(ns)==set(assigned),"BLOCKED: public NS delegation does not match the active zone; no routing change")
    zone=z["id"]
    path="/accounts/"+account+"/workers/domains"
    for host in (DOMAIN, "www."+DOMAIN):
        existing=request(path+"?"+urllib.parse.urlencode({"hostname":host}))["result"]
        target=[v for v in existing if v.get("hostname")==host]
        print('Exact Worker bindings for '+host+': '+str(len(target)))
        if target:
            ensure(len(target)==1 and target[0].get("service")==WORKER and target[0].get("zone_id")==zone and target[0].get("enabled") is True,"BLOCKED: existing hostname binding belongs elsewhere or is disabled")
            print("PASS "+host+" already attached to intended Worker")
        else:
            try:records=request("/zones/"+zone+"/dns_records?"+urllib.parse.urlencode({"name.exact":host,"per_page":100}))
            except RuntimeError as e:
                raise RuntimeError(str(e)+"; BLOCKED: DNS Read permission required to check conflicts before attachment. Use dashboard Custom Domain or scoped token. No DNS mutation.") from None
            ensure(not records.get("result_info",{}).get("total_pages",1)>1,"BLOCKED: DNS inventory incomplete")
            conflicts=[x for x in records["result"] if x.get("name")==host and x.get("type") in ("A","AAAA","CNAME","HTTPS","SVCB")]
            ensure(not conflicts,"BLOCKED: existing website DNS records require owner review; no records overwritten")
            routes=request("/zones/"+zone+"/workers/routes")["result"]
            ensure(not routes,"BLOCKED: existing zone Worker routes require owner review; none changed")
            obj=request(path,"PUT",{"hostname":host,"service":WORKER,"zone_id":zone,"enabled":True,"previews_enabled":False})["result"]
            ensure(obj.get("hostname")==host and obj.get("service")==WORKER and obj.get("zone_id")==zone and obj.get("enabled") is True,"Custom domain attachment response unexpected")
            print("PASS "+host+" custom domain attached to existing Worker; Cloudflare manages its DNS and TLS")
    ensure(public_check(OLD),"REVIEW: previous preview health could not be verified")
    print("PASS previous preview URL preserved")
    pending={DOMAIN,"www."+DOMAIN}
    for attempt in range(3):
        for host in sorted(pending):
            if public_check("https://"+host):
                print("PASS branded HTTPS preview-only API: "+host)
                pending.remove(host)
        if not pending:break
        if attempt<2:time.sleep(8)
    for host in sorted(pending):
        dns_status(host)
        print("REVIEW: HTTPS health not yet verified: "+host)
    ensure(not pending,"HTTPS verification incomplete; no canonical URL or auth changes made")
    for host in (DOMAIN,"www."+DOMAIN):
        r=subprocess.run(["curl","--silent","--show-error","--fail","--max-time","12","https://"+host+"/"],capture_output=True,timeout=16)
        ensure(r.returncode==0 and b"Browse the collection" in r.stdout,"Homepage not verified: "+host)
        print("PASS branded homepage: "+host)
    ensure(public_check(OLD),"Previous preview health not confirmed")
if __name__=="__main__":
    try:main()
    except RuntimeError as e:sys.exit(str(e))
    except Exception:sys.exit("Domain setup interrupted; no raw API objects or credentials printed. Inspect Cloudflare before retrying.")
