# Burton & Found — Owner launch decisions

Before enabling real payments, confirm each item below. Leave `LIVE_CHECKOUT_ENABLED=false` until finished.

- [ ] GitHub repository connected to Cloudflare Pages Git integration (output `public`)
- [ ] Public HTTPS domain selected and checkout success page reachable
- [ ] Supabase project created, migration 001 and migration 002 executed, seed loaded
- [ ] Verify 22 sale listings map to the actual 40 unique physical items; confirm bundle contents and quantities
- [ ] Confirm authenticity, printing dates, condition and front/back photos where possible; especially OH-006 complete May 1933 issue
- [ ] Stripe business identity and bank payout details approved
- [ ] Stripe test keys, webhook signing secret and Cloudflare secrets configured, with no private keys in GitHub
- [ ] Test successful, canceled, failed and expired payments and simultaneous purchases of overlapping bundles
- [ ] Review business's GST/HST registration, tax obligations and printed-book tax treatment; set truthful tax rates and explicit approval
- [ ] Establish actual tracked shipping charges from 356 Queen St. E., Sault Ste. Marie, Ontario P6A 1Z1
- [ ] Decide reliable shipping handling commitment (do not promise unverified transit dates)
- [ ] Connect Supabase customer registration, test sign-up, sign-out, password reset and user-data deletion
- [ ] Grant owner account access only through Supabase SQL editor; verify a normal customer is denied admin access
- [ ] Test printing packing slips, updating tracking, exporting order register and manually sending shipping notification
- [ ] Publish final contact email, shipping, privacy, returns/refund and terms pages; review relevant legal compliance
- [ ] Review Cloudflare preview-vs-production branch settings and SEO indexing before public launch
- [ ] Set `STRIPE_SECRET_KEY=sk_live_...`, matching live webhook secret and `LIVE_CHECKOUT_ENABLED=true` **only when fully ready**

**Never enter real payment-card details into the downloadable interactive previews.** The previews are non-transactional demonstrations.

### International / carrier setup
- [ ] Measure every actual packed item (and popular combined carts) using `SHIPPING_PACKAGE_MEASUREMENTS.csv`
- [ ] Generate `SHIPPING_PACKAGES_JSON` with `scripts/build_shipping_packages.py`
- [ ] Connect and test FedEx Rate & Transit API with the correct account number
- [ ] Obtain the new Canada Post JSON Rating specification and credentials or verified legacy XML credentials
- [ ] Verify Canada, US and each additional destination country separately
- [ ] Confirm carrier-supplied dates, tracking eligibility and account discounts with real test shipments
- [ ] Document customs declarations, declared value, insurance and possible duties for international shipments
- [ ] Test Stripe destination mismatch and owner resolution; do not ship review or duplicate-inventory orders
