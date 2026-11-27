# Burton & Found — Stripe payment launch runbook (November 2026)

**Status:** Code is prepared for Stripe-hosted Checkout; the deployed Worker **must remain preview-only**. Never authorize live funds from this document or automatically alter tax registration, payout details or personal identity verification.

## Additional runtime Stripe merchant protection

The Checkout server now requires `STRIPE_EXPECTED_ACCOUNT_ID=acct_1SN2j92NSH96TjSa` (a **public account identifier**, not a secret), and securely calls Stripe `GET /v1/account` **before placing a physical inventory hold**. A missing, revoked, or mismatched Stripe key fails closed with HTTP 503 without creating a charge, checkout session, or reservation. This protects against an accidental key copied from a different merchant account. This check runs again for each attempted checkout, but does not itself approve payments, tax settings, merchant payouts or real inventory. The public health endpoint also treats missing expected-merchant configuration as preview-only.

## Safe automated steps implemented

- A repeatable [read-only payment audit](.github/workflows/stripe-payment-readiness.yml) runs against the existing Cloudflare Worker and the configured GitHub Actions **test-only** Stripe key. It reports only encrypted-credential presence, disabled payment gates, and whether a test key belongs to Burton & Found. It probes the live website to verify checkout refuses creation. It does not create charges, tax registrations or webhook endpoints.
- The existing [install-stripe-sandbox-secrets](.github/workflows/install-stripe-sandbox-secrets.yml) action now verifies the supplied test key belongs to the **currently connected Burton & Found Stripe account**. It refuses keys from other merchants. It checks safety gates and deploys only test secrets; it does not enable checkout.
- A separate production guard `STRIPE_PAYOUTS_VERIFIED=false` is now enforced by `functions/_lib/core.js`. Even if someone enters a live key and enables the other switches, **real-money Checkout is blocked** until there is an explicit verified payout approval. This flag is not evidence from Stripe; it requires a current, independently confirmed owner sign-off.
- Webhook signature and test payment RPC regression tests cover no forged payment and signed payment fulfillment recording.

## November 27, 2026 verification

Owner's connected live merchant account reports charges and payouts enabled, no currently due or past due identity requirements, and no pending verification. Stripe Tax remains pending head-office information. The November 27 public audit confirms encrypted Worker bindings and checkout disabled; stored GitHub sandbox API key was rejected or could not connect. The signed non-payment webhook probe passed. No approval flags have been changed; owner verification and tax/stock/shipping review are still required before live checkout. The sandbox installer now builds generated marketing pages before validating the complete preview release.

## Actions the Stripe account holder must take

1. **Reconfirm account verification before launch (November 27 check passed)** in [Stripe Dashboard](https://dashboard.stripe.com/). A connected account's `payouts_enabled=false` status must be fixed through Stripe's secure identity/liveness flow before any production charges are approved. Never share identity documents or verification codes through GitHub or this repository.
2. **Tax**: decide the seller's actual CRA GST/HST registration status and provincial/U.S. sales tax obligations. Set correct head-office information and any legal registrations in [Stripe Tax](https://dashboard.stripe.com/tax). Do not add a Stripe Tax registration just because a location appears in the website.
3. **Test key**: in Stripe, select your business's sandbox/testing environment and obtain a fresh `sk_test_...`. Store it ONLY as a GitHub Actions repository secret named `BF_STRIPE_TEST_SECRET_KEY` (Repository Settings → Secrets and variables → Actions). The merchant identity is checked automatically.
4. **Test webhook**: in Stripe Workbench → Event destinations, create the **sandbox / test-mode** HTTPS endpoint `https://burtonfound.timharmar.workers.dev/api/stripe-webhook` and select:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   Copy its `whsec_...` **sandbox signing secret**, store as `BF_STRIPE_TEST_WEBHOOK_SECRET` (encrypted GitHub Actions repository secret), never in source code or chat. The live webhook has a separate signing secret and must not be substituted for the sandbox secret.
5. **Run the audit**: [Stripe payment readiness workflow](https://github.com/Harmart1/BurtonFound/actions/workflows/stripe-payment-readiness.yml). It checks the merchant key, secret presence and disabled checkout. Download the report artifact.
6. **Install test credentials**: [Safe test-only Stripe install workflow](https://github.com/Harmart1/BurtonFound/actions/workflows/install-stripe-sandbox-secrets.yml). Select **Run workflow**, confirm the sandbox-only input, and check success. If GitHub reports wrong merchant account, do not bypass the check; obtain the correct business sandbox key.
7. **Verify webhook before enabling any checkout**: [Signed non-payment webhook verification](https://github.com/Harmart1/BurtonFound/actions/workflows/verify-stripe-webhook.yml). It posts a **synthetic non-checkout** signed ping (not an order), confirms authentic signatures accepted and tampered signatures rejected, and uses the encrypted GitHub test `whsec_...` value.
8. **Finish physical inventory, shipping and tax**. Current checkout reserves physical units through Supabase and charges the authoritative database CAD amount. The customer shipping address must match a signed quote. Do not mark an unverified vintage print for sale. Verify Canada/U.S. rates and duties or use only owner-approved pricing for allowed destinations.
9. After a controlled code review, enable **Stripe TEST Checkout only**, and verify successful, cancelled, expired, double-clicked and duplicate-event scenarios, no overselling, legitimate tax and shipping totals, and manual reconciliation of refunds and shipping mismatches. A successful synthetic signature check is NOT equivalent to an end-to-end Stripe Checkout test purchase.
10. To go live, **separately** require verified payouts, approved applicable tax, inventory, reliable shipping, tested webhooks, merchant-owned domain, approved Stripe production credentials and a controlled production deployment. Never simply flip `LIVE_PAYMENTS_APPROVED` by itself.

## Current deployment safety gates (must remain disabled)

`LIVE_CHECKOUT_ENABLED=false`, `LIVE_PAYMENTS_APPROVED=false`, `STRIPE_PAYOUTS_VERIFIED=false`, `TAX_CONFIGURATION_APPROVED=false`, `CARRIER_QUOTES_ENABLED=false`, `MARKETING_INDEXING_APPROVED=false`. The normal production deploy pipeline asserts the principal payment and quoting switches remain disabled.

The existing `/api/health` endpoint must return `checkout: preview_only` and a real POST to `/api/checkout` must return HTTP 503, regardless of whether Stripe credentials are present. The Shopify platform, new GitHub repository and separate checkout provider are **not required**.
