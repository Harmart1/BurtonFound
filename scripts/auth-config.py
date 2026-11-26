"""Audit or repair hosted Supabase Auth settings. Owner authorization required.
Never prints API response bodies, credentials, or customer information.
"""
import argparse, json, os, re, sys, urllib.request, urllib.error
from urllib.parse import urlsplit
REF="nyvdrgpcwfasajyncnhi"
SITE="https://burtonfound.timharmar.workers.dev"
CALLBACK=SITE+"/account.html"
ENDPOINT="https://api.supabase.com/v1/projects/"+REF+"/config/auth"
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):
        return None
def request(token, patch=None):
    headers={"Authorization":"Bearer "+token,"Accept":"application/json","Content-Type":"application/json"}
    req=urllib.request.Request(ENDPOINT,headers=headers,method="GET" if patch is None else "PATCH",data=None if patch is None else json.dumps(patch).encode())
    try:
        with urllib.request.build_opener(NoRedirect()).open(req,timeout=25) as r:
            result=json.load(r)
    except urllib.error.HTTPError as e:
        raise RuntimeError("Management API HTTP "+str(e.code)+"; check project permission. No response body printed.") from None
    except Exception:
        raise RuntimeError("Management API connection or response failed.") from None
    if not isinstance(result,dict):raise RuntimeError("Unexpected management response.")
    return result
def redirects(cfg):
    v=cfg.get("uri_allow_list")
    if v is None or v=="":return []
    if isinstance(v,str):return [x.strip() for x in v.split(",") if x.strip()]
    raise ValueError("Unexpected allow-list type; refusing to overwrite.")
def report(cfg):
    return {"Canonical site URL":str(cfg.get("site_url","")).rstrip("/")==SITE,
            "Exact account callback present":CALLBACK in redirects(cfg),
            "Email authentication enabled":cfg.get("external_email_enabled") is True,
            "Signup permitted":cfg.get("disable_signup") is False,
            "Email confirmation required":cfg.get("mailer_autoconfirm") is False,
            "Custom SMTP host and sender present":bool(cfg.get("smtp_host") and cfg.get("smtp_admin_email")),
            "Secure email change enabled":cfg.get("mailer_secure_email_change_enabled") is True}
def make_patch(cfg,apply_smtp=False,environ=None):
    environ=os.environ if environ is None else environ
    patch={}
    existing=str(cfg.get("site_url") or "").strip()
    # Preserve deliberately configured external/custom domain; explicit owner review required.
    if existing.rstrip("/")!=SITE:
        u=urlsplit(existing)
        if existing and u.hostname not in ("localhost","127.0.0.1","::1"):
            raise ValueError("Different configured Site URL detected; review in dashboard before overwriting.")
        patch["site_url"]=SITE
    allowed=redirects(cfg)
    if CALLBACK not in allowed:patch["uri_allow_list"]=",".join([*allowed,CALLBACK])
    for k,v in {"external_email_enabled":True,"disable_signup":False,"mailer_autoconfirm":False,"mailer_secure_email_change_enabled":True}.items():
        if cfg.get(k) is not v:patch[k]=v
    if apply_smtp:
        values={k:environ.get("BF_SMTP_"+name,"").strip() for k,name in {"smtp_host":"HOST","smtp_user":"USER","smtp_pass":"PASSWORD","smtp_admin_email":"FROM"}.items()}
        if not all(values.values()):raise ValueError("All SMTP host, username, password and verified sender values required.")
        if not re.fullmatch(r"[A-Za-z0-9.-]+",values["smtp_host"]) or "." not in values["smtp_host"]:raise ValueError("Invalid SMTP host.")
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+",values["smtp_admin_email"]):raise ValueError("Invalid sender email.")
        port=environ.get("BF_SMTP_PORT","587")
        if port not in ("465","587"):raise ValueError("Use TLS port 465 or STARTTLS port 587.")
        patch.update(values,smtp_port=int(port),smtp_sender_name="Burton & Found")
    return patch
def main():
    p=argparse.ArgumentParser();p.add_argument("--apply",action="store_true");p.add_argument("--smtp",action="store_true");args=p.parse_args()
    if args.smtp and not args.apply:raise ValueError("--smtp requires --apply.")
    token=os.environ.get("BF_SUPABASE_MANAGEMENT_TOKEN","").strip()
    if not token:
        print("BLOCKED: Supabase management token not provided. Project API keys cannot update hosted Auth settings.")
        return 2
    cfg=request(token)
    for label,ok in report(cfg).items():print(label+": "+("PASS" if ok else "REVIEW"))
    if not args.apply:return 0 if all(report(cfg).values()) else 2
    patch=make_patch(cfg,args.smtp)
    if patch:
        # Never log patch values. Only update narrowly scoped fields.
        print("Applying approved authentication settings:",", ".join(sorted(patch)))
        request(token,patch)
    current=request(token)
    results=report(current)
    for label,ok in results.items():print("After repair — "+label+": "+("PASS" if ok else "REVIEW"))
    if args.smtp and any(current.get(k)!=patch.get(k) for k in ("smtp_host","smtp_user","smtp_admin_email","smtp_port")):
        raise RuntimeError("SMTP settings did not match expected values after repair.")
    print("Actual inbox delivery remains unverified; test with an owner-controlled mailbox.")
    return 0 if all(results.values()) else 2
if __name__=="__main__":
    try:sys.exit(main())
    except (ValueError,RuntimeError) as e:sys.exit(str(e))
