# Burton & Found — GitHub, Cloudflare Pages, Supabase and Stripe

This is a **working integration scaffold**, not a live payment system. The preview stays safe and non-transactional until the owner creates credentials, executes SQL, configures real shipping fees and taxes, and deliberately enables live checkout. The code contains no secret keys.

## 1. Deploy source to GitHub and Cloudflare Pages

1. Upload the **contents of this ZIP** to a new private or public GitHub repo. Never commit `.dev.vars`, `.env` or live secrets. The storefront and `functions/` belong in the same repository.
2. In [Cloudflare Workers & Pages](https://dash.cloudflare.com/) create a **Pages** project and connect the GitHub repository.
3. Framework: **None**; build command: **leave blank**; build output directory: **`public`**. Root directory: repository root.
4. Cloudflare detects the repository-root `functions/` directory. Do **not** attempt to deploy this backend with Netlify Drop or with Cloudflare Pages dashboard Direct Upload: the necessary Functions would not deploy. Use Cloudflare Git integration or Wrangler CLI.
5. Before enabling payments, deploy the static preview and verify the products, assets, Paper Trail Lab, accounts and response at `/api/health`. It should say `checkout: preview_only`.
6. Configure a real domain and check page paths. `checkout-success.html` should exist at your public domain. In Supabase Auth URL Configuration add your actual site URL and account email redirect URL.

## 2. Create Supabase free-tier project

1. Create a [Supabase](https://supabase.com/) project in a region appropriate to your intended customer base and privacy disclosures.
2. In **SQL Editor**, run `supabase/migrations/001_accounts_and_commerce.sql` ONCE, then `supabase/migrations/002_fulfillment_workflow.sql`, then `003_live_carrier_shipping.sql` and `004_shipping_review_resolution.sql`, and finally `supabase/seed.sql`.
3. The SQL creates the customer account tables, per-user RLS, checkout reservations, paid orders, fulfillment audit history and an administrator allowlist; the seed creates 22 products and 40 physical item IDs.
4. In `public/config.js` set only `supabaseUrl` and **public publishable key**. Never paste the `secret/service_role` key into this public file.
5. Configure sign-up email confirmations, authenticated email redirects, and sufficient Supabase Auth email deliverability (the free built-in SMTP has restrictions). Test sign-up, confirmation, password reset and account deletion.
6. Sign up for a real owner account using the public website. Then, in the Supabase **SQL Editor**, grant owner access using your own email address (replace the sample):

```sql
insert into public.bf_admin_users(user_id)
select id from auth.users where email = 'YOUR_OWNER_EMAIL@example.com'
on conflict do nothing;
```

Never grant admin status using a browser input or a user-controlled metadata field. Then visit `/admin/orders.html` while signed in as owner.

## 3. Stripe account and checkout setup

1. Open [Stripe](https://dashboard.stripe.com/), complete identity/business verification, add a bank account and start **test mode**.
2. Obtain the Stripe test secret key `sk_test_...` in Stripe dashboard; store it **only in Cloudflare encrypted secrets**.
3. In Stripe Developers → Webhooks add the endpoint **`https://YOUR_PUBLIC_DOMAIN/api/stripe-webhook`**. Select `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`. Save the signing secret `whsec_...` in Cloudflare secrets. A separate webhook signing secret is required for test and live modes.
4. Cloudflare Pages → project → Settings → Variables and Secrets; add these entries:

| Name | Purpose | Type |
|---|---|---|
| `SUPABASE_URL` | `https://YOURPROJECT.supabase.co` | Plain |
| `SUPABASE_PUBLISHABLE_KEY` | Public `sb_publishable_...` | Plain |
| `SUPABASE_SECRET_KEY` | Private Supabase secret/service-role key | **Encrypted secret** |
| `STRIPE_SECRET_KEY` | `sk_test_...` first, then `sk_live_...` | **Encrypted secret** |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` for the matching mode | **Encrypted secret** |
| `SHIPPING_STANDARD_CA_CENTS` | Real standard shipping charge in integer **CAD cents** | Plain |
| `SHIPPING_EXPRESS_CA_CENTS` | Optional express shipping charge in integer CAD cents | Plain |
| `STRIPE_AUTOMATIC_TAX` | Optional `true` **only if Stripe Tax is properly configured** | Plain |
| `TAX_CONFIGURATION_APPROVED` | Set `true` **only after tax obligations and rates are reviewed** | Plain |
| `LIVE_CHECKOUT_ENABLED` | Set `true` **only when ready to test/launch checkout** | Plain |

The public storefront itself contains no secret credentials. If any mandatory variable is missing, `/api/health` stays `preview_only` and the site shows enquiry mode, not payment.

### Tax obligations — read before accepting money

This template cannot establish whether you must charge GST/HST, or how provincial taxes and printed-book rebates apply. Canada-wide taxation of vintage ephemera and books cannot safely be hard-coded as a single universal rate. **Do not enable live checkout until you confirm your tax registration/status and accurate tax configuration with qualified advice.** `STRIPE_AUTOMATIC_TAX=true` may incur Stripe Tax charges and requires configuration; without it, this template does **not** calculate sales tax. The explicit `TAX_CONFIGURATION_APPROVED` flag is a deployment safety gate, not a determination that taxes are correct.

## 4. Shipping from Sault Ste. Marie

- Origin: **356 Queen St. E., Sault Ste. Marie, Ontario, P6A 1Z1, Canada**.
- In **flat-rate mode** Checkout collects Canadian delivery addresses and charges the owner-configured per-order rate. In **live carrier mode** the checkout requires a server-signed Canada Post or FedEx rate for an owner-measured package and an enabled destination country. The legacy Canada Post adapter requires legacy-issued keys; the current JSON/OAuth portal adapter still needs implementation. No carrier price is invented.
- Price packing material and the largest combinations of items before you set shipping prices. Shipping price fields are in CAD **cents**; for example, `1295` means $12.95, **not a recommendation for your actual shipping charge**.
- Orders appear in `/admin/orders.html` after a **verified paid Stripe webhook**. Pack with archival protection, buy labels in [Canada Post Snap Ship](https://www.canadapost-postescanada.ca/cpc/en/small-business/snap-ship.page), enter the carrier and tracking number, then send the email draft the dashboard prepares.
- No automatic shipping emails, carrier-generated ETAs, label purchases or actual tracking API integrations are claimed. Do not promise dates until carriers are checked.

## 5. Checkout safeguards and order handling

- Price and inventory calculations occur in Supabase service-only Postgres routines. Browser-supplied prices cannot set the charged amount.
- The 22 sale listings map to **40 physical pieces**, so an overlapping individual ad / bundle cannot be purchased simultaneously.
- Each checkout temporarily holds physical units; Stripe session is configured to expire after ~30 minutes. Reservations are not automatically recycled merely when a local timer passes: Stripe's **signed expiration webhook** releases them. A lost webhook can leave a piece reserved until you reconcile and release it manually after verifying its Stripe status. This prioritizes avoiding overselling.
- Signed webhooks record a paid order transactionally and only once. An unexpected double-sale or late paid event is flagged **needs_attention** for manual remedy/refund; the site cannot guarantee that payment settlement cannot precede the webhook.
- The checkout success page reports **pending** until the webhook confirms payment, to avoid false success messages.
- Customers may buy as guests. Orders placed while signed into Supabase can appear in their order history. Guest purchases are confirmed by Stripe email and are not linked to a later account automatically.
- The administrator dashboard includes packing slips, filtered CSV export, status-change history and owner-verified hold reconciliation, but it is **not** an automated email or postage service. It securely retrieves orders only for allowlisted owner accounts and prepares email templates.

## 6. Testing checklist — all must pass before going live

- Supabase SQL migration and seed completed; RLS policies tested using a second account.
- `/api/health` shows `test_mode` or `live_mode` only when the full server-side setup gate is satisfied. Do not enable before completing legal tax review.
- Test card payment with $0 fake mode disabled? **Use Stripe test mode only**, never an invented card or live money while testing.
- Check success page updates only after signed webhook; no payment record on cancellation/failed payment.
- Try double-clicking Checkout, concurrent checkout of the same original, and cart containing overlapping bundle/physical items.
- Confirm 22 SKUs and 40 physical units, Canadian address collection, configured shipping cost and any taxes.
- Use Stripe dashboard to issue test refund and manually verify inventory and order handling; refund synchronization is **not automated**.
- Check sign-up, sign-out, profile editing, guest cart, saved bag, account order history, and admin privacy isolation.
- Confirm email receipts are enabled in Stripe and enter actual seller contact information, privacy and returns policies.

## Why Cloudflare instead of GitHub Pages?

GitHub remains the source-code repository. **GitHub Pages is not intended for operating a full ecommerce checkout business**, and it cannot run trusted Stripe webhooks or private Supabase service code. Cloudflare Pages with Functions supports the necessary serverless endpoints on a free tier, within its usage limits.

## Developer notes

- Cloudflare Pages Functions live at repository root `functions/`. Static public files live under `public/`.
- The owner should normally enable Git-based deployments so each GitHub push updates the live site.
- No commercial dependency is required for backend logic: the server uses `fetch`, Web Crypto and Supabase REST RPC directly. No `npm install` is required for the static site.
- Before production, add independent abuse/rate-limiting protection to `/api/checkout` (e.g., Cloudflare Turnstile / WAF) to stop bots temporarily reserving inventory.
- Maintain backups of the original product images and historic sale records; avoid storing payment card numbers, which Stripe handles separately.
- `supabase/seed.sql` is only a starter snapshot: new products need both product and physical-unit records. **Do not reset sold units** when updating the catalogue.

### Official references

- Cloudflare Pages Functions: https://developers.cloudflare.com/pages/functions/get-started/
- Cloudflare encrypted secrets: https://developers.cloudflare.com/pages/functions/bindings/
- Stripe Checkout: https://docs.stripe.com/checkout/quickstart
- Stripe webhooks: https://docs.stripe.com/webhooks
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security

## 7. Owner shipping workflow — operations update

This edition adds the following to the private **`/admin/orders.html`** page:

1. Four counters (recent orders, to pack, shipped, and needs attention), plus search/status filters.
2. A **printable packing slip** containing only the delivery address and order contents, not payment-card information.
3. A **copy address** action for entering the destination into Canada Post Snap Ship.
4. A **CSV export** of the current filtered order list, for offline reconciliation. The export contains personal information; keep it securely and delete copies when no longer required.
5. A shipping-status editor that retains the initial dispatch timestamp and records an owner-attributed audit event for each change.
6. A **prepare email** action that opens your email application. No message is sent automatically; inspect and send it yourself.
7. A **Check holds** panel: for a reserved checkout, **Verify expiration with Stripe** contacts Stripe from the server and releases inventory *only if Stripe itself reports that the session is expired and unpaid*. An open or paid Stripe session is never released by this button.

### Required new database migration

After running `supabase/migrations/001_accounts_and_commerce.sql`, **also run**:

`supabase/migrations/002_fulfillment_workflow.sql`

Then run `supabase/seed.sql`. If you installed the previous starter's first migration already, apply **only migration 002** and retain existing inventory/order data; do not create a new project just to update shipping.

This migration adds `bf_fulfillment_events`, the secure `bf_update_fulfillment` procedure, and a catalogue stock check that treats products without physical unit mappings as unavailable. It does not reset paid orders or previously sold items.

### Reservations and refunds

Checkout holds are checked against Stripe before they can be released; a reservation with no linked Stripe session still requires manual investigation. Payments in manual-review state need human reconciliation and, if necessary, refund from the Stripe dashboard. Automated refunds and chargeback handling are not implemented. **Do not use the release tool as a refund mechanism.**

### Test-mode banner

When all checkout services are configured with a `sk_test_...` key, `/api/health` returns `test_mode` and the public storefront displays **TEST MODE** clearly. Switching to `sk_live_...` only occurs after the owner explicitly updates the encrypted key, compatible webhook secret, shipping configuration, and tax approval. This banner does not itself validate the correctness of your Stripe or tax setup.


## 8. Live carrier rates for Canada, US and international destinations

**This branch contains real carrier-rating connectors, not simulated rate tables.** They will not return actual rates until the owner creates carrier developer accounts, supplies their credentials to Cloudflare encrypted secrets, enters real **packed** parcel dimensions/weight, and enables checkout after tax review.

### Canada Post API transition notice (November 2026)
Canada Post has **deprecated its legacy XML REST API** as of 2026 in favour of a new JSON/OAuth Developer Portal. This version includes a **legacy XML Rating v4 adapter only**, which may be used if Canada Post has granted the required legacy credentials. **The new Canada Post JSON/OAuth Rating API is not connected** in this version; do not try putting new Developer Portal API credentials into the old XML username/password fields. We have deliberately avoided guessing the new portal's complete request/response schema. For a new Canada Post account, obtain the Rating API OpenAPI specification from the new portal and complete/migrate that adapter before promising live Canada Post quotes. The FedEx adapter uses current OAuth client credentials and Rates and Transit Times API.

Official current documentation:
- New Canada Post Portal: https://developer-developpeur.canadapost-postescanada.ca/devportal-portaildesdeveloppeurs/
- Existing XML v4 Rating: https://www.canadapost-postescanada.ca/info/mc/business/productsservices/developers/services/rating/getrates/default.jsf
- Canada Post 2026 legacy-deprecation clarification: https://forum.developer-developpeur.canadapost-postescanada.ca/t/is-soap-api-deprecated/78
- FedEx Rates and Transit Times: https://developer.fedex.com/api/en-us/catalog/rate.html

### Required steps to enable actual quotes

1. Join Canada Post's Solutions for Small Business and the new Canada Post Developer Portal; obtain your customer number and developer Rating credentials. Obtain a FedEx account and create a FedEx Developer Portal project; activate Rates and Transit Times API and get test credentials. You may start with FedEx only while you transition Canada Post to the new portal.
2. Take a packed test parcel for each sellable SKU (archival sleeve, backing, mailer or shipping box included) and **weigh/measure** it. Fill `SHIPPING_PACKAGE_MEASUREMENTS.csv`. For combined carts, measure the packed combined parcel and add a profile with a key made by sorted SKU IDs joined with `+`, e.g. `CC-010+OH-003`. Do not infer dimensions from the flat printed page.
3. Create `SHIPPING_PACKAGES_JSON` using the sample structure in `.dev.vars.example`: `{"OH-003":{"weightKg":0.3,"lengthCm":32,"widthCm":24,"heightCm":3,"verified":true}}`. **These numbers are an example only**, not verified measurements. Do not mark `verified:true` until measured; otherwise rates will not be offered.
4. In Cloudflare Pages **Settings → Variables and Secrets**, enter `SHIPPING_MODE=live_carrier`, `CARRIER_QUOTES_ENABLED=true`, `SHIPPING_ALLOWED_COUNTRIES=CA,US` (add `GB,AU,DE,FR,JP` only after testing each destination), `SHIPPING_HANDLING_BUSINESS_DAYS`, `SHIPPING_PACKAGES_JSON`, and `SHIPPING_QUOTE_SECRET` (random ≥32-character secret). Enter FedEx credentials and, only if granted by Canada Post, legacy XML credentials. Use sandbox/test credentials until all scenarios are verified.
5. On checkout, a customer enters country, postal/ZIP code, city, province/state; Cloudflare contacts available carriers and shows authentic available tracked services. The customer selects one, and a **10-minute HMAC-signed quote** binds destination, packed measurements, SKU combination, carrier service, amount and expected mailing date to the Stripe checkout session.
6. Stripe **collects the full address again** on its hosted page. A signed webhook checks for a country/postal/city/province/price mismatch and marks the order **Needs attention** for manual contact/correction. This is a post-payment safeguard, not an address-locking guarantee; you may need to refund a mismatched shipment. Do not dispatch any review order.
7. At fulfillment, use the built-in **Copy address** and **Packing slip** dashboard actions, then Canada Post Snap Ship or FedEx Ship Manager to buy actual postage and enter tracking. No automatic label billing, carrier pickup scheduling or tracked-event sync is claimed.

**Do not deploy the ZIP to GitHub Pages as a paid store.** Upload source to GitHub and connect it to **Cloudflare Pages**, using output directory `public` and repository-root `functions`.

### Accurate international estimates

- Cross-border quotes can change because of fuel surcharges, remote area fees, billable dimensional weight, customs procedures and service availability. Carrier prices may **exclude** customs duties, brokerage and import taxes; tell the buyer before payment.
- Quote dispatch dates assume the configured **handling business days**, not shipment acceptance; holiday disruptions and actual drop-off may change estimated arrival. Guaranteed carrier commitments, where any exist, are subject to carrier terms.
- Prefer tracked and insured services for irreplaceable paper; the Canada Post legacy connector omits untracked Small Packet options by design. Coverage, declared values and signature services require separate owner approval and are **not** silently added to the rate request.
- Your chosen Stripe shipping amount is a quote for a specific destination. **Stripe's hosted Checkout does not automatically recalculate it after the customer edits their address** with this architecture. The webhook flags mismatches and holds fulfillment for review. A future enhancement could embed a dynamic address-change-aware shipping flow.
- In the absence of a carrier rate or confirmed packed size, checkout blocks for the affected order; the site does not invent a low fallback price.

### Privacy and operational notes

- The shipping quotes API sends the destination country, postal code, city/province and packed dimensions to the selected carriers from Cloudflare. Disclose this in the published privacy policy.
- Do not add personal names, apartment numbers or full street addresses to the shipping rate quote URL, store logs or HMAC quote token; Stripe is responsible for collecting full customer shipping addresses securely.
- Cloudflare Functions are not an authorized substitute for a carrier merchant agreement. Obtain credentials and test the carrier responses and rate taxes using your own account before going live.

## 9. Shipping review resolution (migration 004)

After migrations 001, 002, and 003, apply `supabase/migrations/004_shipping_review_resolution.sql`. This creates a restricted, auditable owner-only action to resolve address or shipping-price mismatches **only if** the payment is verified, the underlying physical items belong to that order, and the seller enters a specific verification note.

The dashboard blocks shipment until the owner reviews the selected carrier/service, Stripe payment, the buyer’s confirmed destination, and the actual cost of postage; obtain payment or refund consent if the shipment price changes. A true duplicate-sale inventory conflict **cannot** be cleared through this action and requires a separate refund/reconciliation procedure. No automatic refund or extra charge is taken.

### Easier packaging configuration

Use `SHIPPING_PACKAGE_MEASUREMENTS.csv` as a packing checklist. Measure the **fully protected and boxed** item, not the flat paper before packaging. When the seller has measured a shipment, change that row to `true` and fill in kilograms and centimetres. To safely convert the CSV to Cloudflare settings, run:

```bash
python scripts/build_shipping_packages.py SHIPPING_PACKAGE_MEASUREMENTS.csv > packages.json
```

The generated JSON belongs in the protected `SHIPPING_PACKAGES_JSON` Cloudflare setting (not public `config.js`). The helper refuses to produce fictitious measurements and only exports `verified=true` rows. For mixed-item carts, add a separate row with the sorted combined identifier, such as `CC-010+OH-003`, and measure the combined parcel.

### Carrier taxes and customs

Carrier quote totals may include carrier-level taxes and fees, whereas Stripe Tax can calculate separate retail sales taxes on the merchant's transactions. Review this with the seller's tax adviser to avoid double taxation or under-collection. International buyers may owe import duties, brokerage and import taxes not shown in the carrier quote. Do **not** describe a carrier transit estimate as a guaranteed arrival date.

### Canada Post developer platform

The new [Canada Post Developer Portal](https://developer-developpeur.canadapost-postescanada.ca/devportal-portaildesdeveloppeurs/) uses JSON/OAuth; new credentials cannot be inserted into `CANADA_POST_USERNAME`/`CANADA_POST_PASSWORD` (legacy XML adapter). Obtain its current Rating API OpenAPI YAML and create a verified JSON adapter before activating live Canada Post rates. The legacy API is deprecated but may still be available to merchants with verified legacy credentials during transition. FedEx can be enabled independently.

## Appearance settings (light/dark)

Three new public files are included in this edition: `theme-init.js`, `theme-controls.js` and `accessibility-theme.css`. Do not remove them from the Cloudflare `public/` output directory. The theme switch requires no credentials; preference is stored only in the visitor's own browser. It follows the device theme until changed. The mode does not alter vintage product photographs or payment configuration.

For a safe shareable demonstration of the themes and example carrier choices, use the separate **Burton & Found ADHD Netlify Sharing Preview ZIP**, not the production code archive. The Netlify preview shows fictional rates and takes no payments. The live Cloudflare storefront still requires carrier credentials, product package measurements, Supabase setup and Stripe test verification.

### GitHub and Cloudflare production-ready preflight (latest)

Read `DEPLOY_GITHUB_CLOUDFLARE_STRIPE.md`. Cloudflare must publish only `public/` and deploy root-level `functions/`. Run `npm run check:deploy && npm test` (also configured in `.github/workflows/validate.yml`). Set `CARRIER_QUOTES_ENABLED=true` **only** after carrier credentials and real packaging are validated. In preview branch environment variables keep **both** `LIVE_CHECKOUT_ENABLED=false` and `CARRIER_QUOTES_ENABLED=false`.
