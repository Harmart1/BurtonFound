#!/usr/bin/env python3
"""Read-only Stripe launch audit. No live charges, secrets or account IDs in output."""
import json
import os
import re
import subprocess
import urllib.error
import urllib.request
from pathlib import Path

OUT = Path("stripe-payment-readiness-report.md")
APP = "https://burtonfound.timharmar.workers.dev"
EXPECTED_MERCHANT = "acct_1SN2j92NSH96TjSa"

def finish(rows):
    # Only presence booleans and safe states are ever written to the artifact/logs.
    doc = ["# Burton & Found — Stripe payment readiness audit", "",
           "Read-only automated audit. **No charges, orders, payout changes, tax registrations, "
           "merchant identity changes, or Stripe webhooks were created.**", "",
           "This report describes configuration presence, not successful payment settlement.",
           ""] + rows
    OUT.write_text("\n".join(doc) + "\n", encoding="utf8")
    for line in rows:
        if line.startswith("|") or line.startswith("**"):
            print(line)
    print("Read-only payment audit complete; report available as GitHub Actions artifact.")

def cf_api(token, path):
    req = urllib.request.Request("https://api.cloudflare.com/client/v4" + path,
              headers={"Authorization": "Bearer " + token, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = json.load(resp)
    if data.get("success") is not True:
        raise ValueError("Cloudflare API request rejected")
    return data.get("result")

def cloudflare_bindings():
    raw = os.environ.get("CF_TOKEN", "").strip()
    hint = os.environ.get("CF_ACCOUNT_HINT", "")
    token = raw.strip("\"'")
    if token.lower().startswith("bearer "):
        token = token[7:].strip().strip("\"'")
    if not re.fullmatch(r"[A-Za-z0-9_.-]+", token or ""):
        candidates = re.findall(r"cf(?:ut|at)_[A-Za-z0-9_.-]+", raw)
        token = candidates[0] if len(candidates) == 1 else ""
    if not token or not hint:
        raise ValueError("Cloudflare authentication not available")
    ids = re.findall(r"(?<![a-fA-F0-9])[a-fA-F0-9]{32}(?![a-fA-F0-9])", hint)
    if len(ids) > 1:
        raise ValueError("Ambiguous Cloudflare account selection")
    accounts = ids if ids else [v.get("id", "") for v in cf_api(token, "/accounts?per_page=50")]
    found = []
    for account in accounts:
        if not re.fullmatch(r"[0-9a-fA-F]{32}", account or ""):
            continue
        scripts = cf_api(token, "/accounts/" + account + "/workers/scripts")
        if any(x.get("id") == "burtonfound" for x in (scripts or [])):
            found.append(account)
    if len(found) != 1:
        raise ValueError("Existing Worker was not uniquely identified")
    settings = cf_api(token, "/accounts/" + found[0] + "/workers/scripts/burtonfound/settings")
    return {x["name"]: x for x in (settings or {}).get("bindings", [])
            if isinstance(x, dict) and isinstance(x.get("name"), str)}

def secret_status(bindings, name):
    value = bindings.get(name)
    if value is None: return "Missing"
    if value.get("type") in ("secret_text", "secret_key"): return "Present as encrypted secret"
    return "Present as non-secret (must be fixed before launch)"

def flag_status(bindings, name):
    value = bindings.get(name, {})
    if value.get("type") != "plain_text": return "Missing or unreadable"
    if value.get("text") == "true": return "ON"
    if value.get("text") == "false": return "OFF"
    return "Non-boolean or missing"

def stripe_test_key_status():
    key = os.environ.get("STRIPE_TEST_KEY", "").strip()
    if not key: return "Missing from encrypted GitHub Actions secrets"
    if not re.fullmatch(r"sk_test_[A-Za-z0-9]+", key):
        return "Invalid test-key format (no key value shown)"
    req = urllib.request.Request("https://api.stripe.com/v1/account",
                                 headers={"Authorization": "Bearer " + key,
                                          "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            account = json.load(resp)
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError):
        return "Stripe rejected test credential or connection failed"
    return ("Validated with the connected Burton & Found merchant"
            if account.get("id") == EXPECTED_MERCHANT else
            "MISMATCH: test key belongs to a DIFFERENT merchant — do not install")

def public_safety_check():
    def call(url, method=None, body=None, origin=False):
        args = ["curl", "--silent", "--show-error", "--max-time", "20",
                "--write-out", "\\n%{http_code}"]
        if method: args += ["-X", method, "-H", "Content-Type: application/json"]
        if origin: args += ["-H", "Origin: " + APP]
        if body is not None: args += ["--data", body]
        args.append(url)
        p = subprocess.run(args, capture_output=True, text=True, timeout=25, check=False)
        if p.returncode != 0: raise ValueError("Live site request unavailable")
        raw, status = p.stdout.rsplit("\n", 1)
        return int(status.strip()), json.loads(raw)
    try:
        status, health = call(APP + "/api/health")
        if status != 200 or health.get("checkout") != "preview_only":
            return "WARNING — current store is NOT confirmed in preview-only mode"
        status, _ = call(APP + "/api/checkout", "POST", '{"skus":["OH-003"]}', True)
        if status != 503:
            return "WARNING — checkout did not return the expected disabled-mode response"
        return "VERIFIED: website rejects payment session creation (HTTP 503)"
    except (ValueError, subprocess.TimeoutExpired, OSError, KeyError):
        return "Unavailable — inspect deployed checkout manually"

def main():
    rows = ["## Active Cloudflare Worker bindings", "",
            "| Payment requirement | Status |", "|---|---|"]
    try:
        bindings = cloudflare_bindings()
        for key in ("STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "SUPABASE_SECRET_KEY"):
            rows.append("| `" + key + "` | " + secret_status(bindings, key) + " |")
        for key in ("LIVE_CHECKOUT_ENABLED", "LIVE_PAYMENTS_APPROVED",
                    "TAX_CONFIGURATION_APPROVED", "STRIPE_PAYOUTS_VERIFIED",
                    "CARRIER_QUOTES_ENABLED", "STRIPE_AUTOMATIC_TAX"):
            rows.append("| `" + key + "` | " + flag_status(bindings, key) + " |")
        rows.append("| `SHIPPING_MODE` | " +
                    ("Live carrier" if bindings.get("SHIPPING_MODE", {}).get("text") == "live_carrier"
                     else "Flat rate / not live carrier") + " |")
    except (ValueError, urllib.error.HTTPError, urllib.error.URLError,
            TimeoutError, TypeError, KeyError):
        rows.append("| Cloudflare inspection | Unavailable; check Workers API token permissions |")
    rows += ["", "## GitHub Stripe test credentials", "",
             "| Setting | Status |", "|---|---|"]
    rows.append("| `BF_STRIPE_TEST_SECRET_KEY` | " + stripe_test_key_status() + " |")
    test_webhook = os.environ.get("STRIPE_TEST_WEBHOOK", "")
    rows.append("| `BF_STRIPE_TEST_WEBHOOK_SECRET` | " +
                ("Present (format valid; NOT compared to live Cloudflare secret)"
                 if re.fullmatch(r"whsec_[A-Za-z0-9]+", test_webhook or "")
                 else "Missing or incorrectly formatted") + " |")
    rows += ["", "## Public checkout safety", "", "**" + public_safety_check() + "**", "",
             "## Owner-required prerequisites", "",
             "1. Stripe account must report **payouts_enabled=true** after completing its overdue identity/liveness verification.",
             "2. Determine actual tax collection requirements; complete Stripe Tax head-office address and applicable real registrations. Never invent a tax registration.",
             "3. Save fresh Stripe TEST key and matching TEST webhook signing secret in encrypted GitHub Actions repository secrets.",
             "4. Configure a test-mode Stripe webhook endpoint subscribed to the four Checkout events; use the current storefront /api/stripe-webhook URL.",
             "5. Validate inventory and actual shipping before end-to-end test-mode purchase.",
             "6. Leave production card processing OFF pending business, tax, shipping and testing approvals.",
             "",
             "This report does not access Stripe's live account through Cloudflare's hidden credentials "
             "or assert that payout verification is complete.",
            ]
    finish(rows)

if __name__ == "__main__":
    main()
