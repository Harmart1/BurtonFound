# Burton & Found — commercial launch decision record (2026-11-27)

## Current configuration
- Primary site: https://burtonandfound.ca; WWW and original Worker are retained.
- Merchant head office and dispatch origin supplied by owner; postal code P6A 1Z1, Sault Ste. Marie, ON. Do not publish a street/return address until owner confirms appropriate public contact details.
- Owner reports not registered for GST/HST. Stripe Tax head-office setup is active; automatic tax remains off. This is not a determination of eligibility for small-supplier status.
- Owner has accepted a Canada-first launch, with United States deferred. Approved US price settings are retained for future review only. Live carrier credentials are not required for this initial model.
- Owner-approved starting prices in CAD: Canada standard 19.95, express 34.95; US standard 29.95, express 49.95. These are approved seller prices, not verified carrier quotations. FLAT_RATE_PRICES_APPROVED=true, US_SHIPPING_APPROVED=false, CANADA_POST_US_DUTIES_APPROVED=false. All checkout and live-payment flags remain false.
- Verify packed weight, dimensions, protection, carrier prices to representative Canadian destinations and supported cart combinations before authorizing checkout. Oversize, unusually fragile, or uneconomic shipments should be enquiry-only until costed. Do not infer package sizes or customs origin from photographs.
- Verify actual stock, including any imported/automobile items, before changing enquiry-only listings.

## Cross-border process (deferred; not required for Canada-first launch)
1. Open https://www.canadapost-postescanada.ca/cpc/en/personal/sending-to-us-duty-updates.page and review current requirements for the specific shipment and declared value.
2. For typical low-value commercial merchandise shipments, use the Zonos Prepay workflow to classify accurately, determine true country of origin and declared value, assess duties, prepay if required, and obtain the required declaration identifier. Reference: https://www.canadapost-postescanada.ca/cpc/en/support/kb/sending/sending-faq/how-to-use-zonos-prepay-app-to-pay-duty.page
3. Compare duties, fees, postage, packaging and insurance against the proposed flat rates. Decide and disclose who bears these costs and any applicable limitations before accepting orders. Do not represent flat-rate postage as a guaranteed landed cost.
4. Approve the cross-border and duty workflow only once verified. No purchase or account creation was authorized by this document.

## Stripe test webhook
The existing classic TEST endpoint at the original Worker URL covers the four required Checkout events. The corrected GitHub signing credential passed the deployed non-payment isolation probe on all three hostnames. Do not create another endpoint or overwrite Cloudflare with a guessed credential.
- In Stripe Workbench, switch to the correct Burton & Found test/sandbox environment. Inspect the existing exact endpoint https://burtonfound.timharmar.workers.dev/api/stripe-webhook (not a live endpoint). Reveal its actual signing secret without copying it into chat, logs, or repository files.
- Update the encrypted GitHub Actions secret BF_STRIPE_TEST_WEBHOOK_SECRET at https://github.com/Harmart1/BurtonFound/settings/secrets/actions.
- Rerun the read-only payment audit; if the exact deployed signature still fails, review the Cloudflare STRIPE_WEBHOOK_SECRET and determine whether it needs a scoped, authorized test-only synchronization. Keep Stripe webhook mode test and checkout disabled.
- Only run external sandbox test writes after the signed isolation guard and destination checks pass. Test payments are never production orders or inventory.

## GST/HST monitoring
Review worldwide taxable supplies (including applicable associated persons and other business activities), not net payouts or profit. CRA's usual small-supplier threshold is CAD 30,000 in a single calendar quarter or over four consecutive calendar quarters; timing rules differ. Use owner-only live bookkeeping exports to reconcile receipts and obtain any missing off-site sales data. Exclude synthetic/test records and do not deduct refunds or fees without appropriate accounting review. A storefront ledger is only a partial screening input, not a tax assessment. See https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/when-register-charge.html.
Keep the tax approval gate off until the owner has confirmed the correct Canadian tax treatment; review US considerations before expanding.

## Launch gate
Verify actual account confirmation/reset email delivery using an owner-controlled mailbox, provide a working customer support email, approve shipping/returns disclosures, verify stock and package costs, reconcile test checkout and refunds, and approve actual live key and webhook configuration separately. Search indexing and payments remain off pending owner launch approval.

## Owner approval and completed sandbox tests
Owner accepted the four recommended flat prices on November 27, 2026. Keep live checkout and US customs approvals off until separate authorization and operational checks. Stripe sandbox job 46095017815 passed session creation, separate test-card payment, refund, and isolated inventory tests; actual Stripe event delivery and production payment readiness are separate checks.

## Canada-first controlled release
The configured destination allowlist is CA only. Both US approval flags remain false. `LIVE_APPROVED_SKUS_JSON` starts as an empty array; only individually verified and owner-approved listing SKUs may be included for a future live release. No physical item is marked verified by this change. Keep every existing payment and launch approval gate off. A smaller initial verified selection is acceptable; retain remaining listings as enquiry-only or unavailable as appropriate. Verify combined-cart packing and postage before allowing corresponding orders. The production webhook and credentials remain separate from test mode. No live charges or live credential changes are authorized.
