"""Verify only the owner-configured production webhook. No charge or order creation."""
import hashlib,hmac,json,os,re,sys,time,subprocess,tempfile
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
    def call(base,path,signature=None):
        cmd=["curl","--silent","--show-error","--max-time","20","--write-out","\\n%{http_code}",base+path]
        if signature is None:
            res=subprocess.run(cmd,capture_output=True,timeout=25)
        else:
            config='header = "Stripe-Signature: t='+stamp+',v1='+signature+'"\n'
            with tempfile.TemporaryFile() as body:
                body.write(payload);body.seek(0)
                res=subprocess.run(cmd+["--config","-","--header","Content-Type: application/json","--data-binary","@/proc/self/fd/"+str(body.fileno())],input=config.encode(),capture_output=True,pass_fds=(body.fileno(),),timeout=25)
        if res.returncode:sys.exit("Public connection failed at "+base+path)
        raw,code=res.stdout.rsplit(b"\n",1)
        try:result=json.loads(raw)
        except ValueError:result={}
        return int(code),result
    def probe(base,sig):return call(base,"/api/stripe-webhook",sig)
    for base in ("https://burtonandfound.ca","https://www.burtonandfound.ca","https://burtonfound.timharmar.workers.dev"):
        status,health=call(base,"/api/health")
        if status!=200:sys.exit("Health probe rejected at "+base+" (HTTP "+str(status)+")")
        if health.get("checkout")!="preview_only":sys.exit("Unexpected payment state at "+base)
        status,body=probe(base,signature)
        if status!=200 or body.get("live_probe") is not True:sys.exit("Production signature probe rejected at "+base+" (HTTP "+str(status)+")")
        if probe(base,"0"*64)[0]!=400:sys.exit("Invalid signature not rejected at "+base)
        print("PASS "+base+" — production signature accepted, invalid signature rejected, checkout remains disabled.")
    print("No real Stripe events, orders, inventory reservations, payments or refunds created.")
if __name__=="__main__":
    try:main()
    except Exception:sys.exit("Production webhook verification unavailable; inspect provider configuration. No raw response or secret printed.")
