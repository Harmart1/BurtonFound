"""Public read-only checks against deployed account UI and actual Auth settings."""
import json, urllib.request, sys
BASE="https://burtonfound.timharmar.workers.dev"
PROJECT="https://nyvdrgpcwfasajyncnhi.supabase.co"
def get(url,headers=None):
    with urllib.request.urlopen(urllib.request.Request(url,headers=headers or {}),timeout=20) as r:
        if r.status!=200:raise RuntimeError("Unexpected public response.")
        return r.read()
def main():
    cfg=json.loads(get(BASE+"/api/public-account-config"))
    assert cfg.get("configured") is True and cfg.get("supabaseUrl")==PROJECT
    key=cfg.get("supabasePublishableKey","")
    assert key.startswith("sb_publishable_")
    settings=json.loads(get(PROJECT+"/auth/v1/settings",{"apikey":key}))
    assert settings.get("external",{}).get("email") is True,"Email auth provider not enabled"
    assert settings.get("disable_signup") is False,"Signup disabled or not verified"
    assert settings.get("mailer_autoconfirm") is False,"Confirmation disabled or not verified"
    page=get(BASE+"/account.html").decode()
    for marker in ['id="signInForm"','id="signUpForm"','id="forgotForm"','id="resendForm"','id="recoveryForm"','auth-callback.js']:
        assert marker in page,"Missing deployed account feature: "+marker
    assert 'finishRecovery' in get(BASE+"/account-core.js").decode()
    assert json.loads(get(BASE+"/api/health")).get("checkout")=="preview_only"
    print("PASS: deployed forms, live email provider, signup enabled, email confirmation required, preview-only payments.")
    print("Not checked: management-only redirect settings, SMTP credentials, inbox delivery.")
if __name__=="__main__":
    try:main()
    except AssertionError as e:sys.exit(str(e))
    except Exception:sys.exit("Public authentication probe failed; no email sent and no account created.")
