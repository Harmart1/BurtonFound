# Burton & Found — current owner launch checklist

Updated November 25, 2026. The current deployment uses the existing Cloudflare **Worker**, not a new Pages project. All payment, carrier quote, payout, tax, cross-border, and indexing approvals remain off. This checklist supersedes the initial 22-listing setup instructions.

## Current sources of truth

- [Deployed storefront](https://burtonfound.timharmar.workers.dev/)
- [Private owner launch dashboard](https://burtonfound.timharmar.workers.dev/admin/orders.html)
- [Live coordination tracker](https://github.com/Harmart1/BurtonFound/issues/16)
- [Latest inventory reconciliation runs](https://github.com/Harmart1/BurtonFound/actions/workflows/launch-inventory-audit.yml) — download the current CSV rather than assuming old counts.
- [Stripe sandbox readiness and owner runbook](STRIPE_PAYMENT_LAUNCH_2026.md)
- [Canada Post and FedEx Canada/U.S. rollout](CARRIER_LAUNCH_CA_US.md)
- [Legal and policy checklist](POLICIES_LAUNCH_CHECKLIST.md)

## Owner work before test checkout

- [ ] Confirm actual seller identity, tax registration/status and appropriate tax treatment; complete Stripe verification and payout setup through Stripe itself.
- [ ] Verify the correct Stripe merchant's sandbox credentials and test webhook. Never paste secrets into source, public issues or chat.
- [ ] Choose the branded domain, configure DNS and HTTPS, establish a working seller mailbox, and test Supabase customer confirmation/reset redirects and email delivery.
- [ ] Verify owner login and admin allowlist, and confirm a normal user cannot see admin information.
- [ ] Download the current inventory reconciliation. Physically inspect, price and confirm every offered original and any shared bundle inventory. Never create stock based only on an image or a design.
- [ ] Fill the measured packed-parcel worksheet for saleable SKUs and supported combined carts. Obtain and validate carrier account credentials and genuine Canada/U.S. rates.
- [ ] Confirm tracked shipping, handling, cross-border duties/customs, returns, privacy, accessibility and support policies.
- [ ] Verify checkout cancellation, expiry, payment failure, idempotency, shared-inventory overlap, destination mismatch, tax, real carrier quote totals and anti-abuse controls in a separate test-only release.

## Release discipline

The ordinary preview deployment must remain main-branch-only and fail closed unless all preview flags match the safe defaults, including disabled checkout, payments, payouts approval, taxes, carrier quotes, provider production approvals, U.S. customs approvals and search indexing. The release guard checks these settings before Cloudflare credentials are used. This is not evidence of merchant approval or physical stock.

A future test checkout or real-money release must be separately reviewed; never bypass the preview guard or turn on a single payment flag to launch. Verify live payout status, genuine rates, approved stock, tax setup, domain and customer emails, and obtain explicit owner authorization. Never submit real cards to a preview.
