# Current Cloudflare Workers deployment (November 6, 2026)

The supplied live hostname is **https://burtonfound.timharmar.workers.dev** (Cloudflare Workers, not Cloudflare Pages). A read-only GitHub runner probe confirmed the storefront HTTP 200 but `/api/health` HTTP 404: the currently deployed Worker has static assets but not the expected API.

The repository now supports **both** Cloudflare Pages Functions (`functions/`) and Cloudflare Workers with static assets (`src/worker.js` + `wrangler.jsonc`). The Worker entry point reuses the same API handlers; changes in GitHub do **not** publish themselves to the current Worker.

## Deploy the Worker safely

1. In GitHub repository **Settings → Secrets and variables → Actions**, create repository secrets `CLOUDFLARE_API_TOKEN` (limited to editing Workers) and `CLOUDFLARE_ACCOUNT_ID`. Do not paste these credentials into source code or a chat.
2. Run the **Deploy Burton & Found Worker (manual, test-safe)** workflow from the **Actions** tab. It validates the repository and deploys `wrangler.jsonc` to the existing `burtonfound` Worker. Automatic deployments are intentionally **not enabled** until the live deployment is verified.
3. The Worker configuration ships with `LIVE_CHECKOUT_ENABLED=false`, `LIVE_PAYMENTS_APPROVED=false`, `TAX_CONFIGURATION_APPROVED=false`, and `CARRIER_QUOTES_ENABLED=false`. These values keep payment collection and carrier quotes disabled even after deployment.
4. Verify `https://burtonfound.timharmar.workers.dev/api/health` returns `{"service":"Burton & Found","checkout":"preview_only",...}` and `/api/public-account-config` returns `{"configured":false}` before enabling accounts.
5. Configure the **correct Burton & Found Supabase project** and a **Stripe sandbox for the correct merchant** first. Use Cloudflare Worker **Variables and Secrets** for `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (nonsecret), `SUPABASE_SECRET_KEY` (secret), `STRIPE_SECRET_KEY` (`sk_test_...`, secret), and `STRIPE_WEBHOOK_SECRET` (test webhook `whsec_...`, secret). Do not enable payment collection until test orders and owner tax/shipping checks pass. Never use an `sk_live_` key during this phase.

The existing Cloudflare Pages instructions below remain valid if you choose to migrate to a separate Pages project later, but they **do not** deploy the `.workers.dev` hostname.

---

# IMPORTANT — production hosting

**GitHub stores the repository; Cloudflare Pages hosts the ecommerce site.** Do not use GitHub Pages as the payment storefront. In Cloudflare connect this repository through **Git integration**, use repository root `/`, no framework, **no build command**, output directory **`public`**. The server-side `functions/` directory must be retained at repository root and Cloudflare encryption must hold Stripe/Supabase/carrier private credentials.

**This repository is preview-only by default.** Checkout and carrier quotes have separate explicit enable switches. Nothing has been deployed or activated for payments.

Run `npm run check:deploy && npm test` before pushing; GitHub Actions runs these checks on push and pull requests. All static website pages live **only** under `public/` (not duplicated at root), to prevent accidental GitHub Pages deployment confusion.

# Burton & Found — Stripe + Cloudflare Pages Edition

A collector-first storefront for Coca-Cola advertising, Old Hollywood ephemera, books and collectibles, preserving the existing Burton & Found design and Paper Trail Lab.

**Start here:** [OWNER_SETUP.md](OWNER_SETUP.md)

This package is *code complete for local preview and initial integration testing*, not a live payment launch. Stripe and Supabase owners must supply their own service keys, run the migrations/seed, approve tax rules and configure shipping fees before enabling checkout. A payment can never be taken in the default unconfigured build.

## Layout

- `public/` — site deployed to visitors; opens at `public/index.html`
- `functions/api/` — Cloudflare Pages Functions for Checkout, webhook, inventory availability, private orders and manual fulfillment
- `functions/_lib/` — private server helpers, including signature verification
- `supabase/migrations/001_accounts_and_commerce.sql` — DB schema, reservations, RLS and transactional payment functions
- `supabase/migrations/004_shipping_review_resolution.sql` — controlled address-mismatch resolution after verified payment (install after 003)
- `supabase/migrations/002_fulfillment_workflow.sql` — shipping audit log, guarded updates, missing-inventory protection
- `supabase/seed.sql` — canonical prices of the 22 live listings and 40 physical collectibles
- `tests/` — Node.js integration and safety tests (`npm test`, no dependencies required)
- `OWNER_SETUP.md` — nontechnical configuration and launch checklist

## Run automated tests

```bash
npm test
```

For local static preview without backend:

```bash
python -m http.server 8000 --directory public
```

Visit `http://localhost:8000/`. In this mode, the page works as a *browse-only* preview, because `/api/*` requires Cloudflare Pages Functions. For real local Functions development use `npx wrangler pages dev public` with a `.dev.vars` file **outside Git**.

## Safety

Payment collection is gated by the `LIVE_CHECKOUT_ENABLED` and `TAX_CONFIGURATION_APPROVED` settings and required private secrets. Stripe card data is never captured by this repository. The server trusts prices only from PostgreSQL, not browser JavaScript.

The shipping dashboard supports packing slips, shipping email drafts, CSV export, audit history and Stripe-verified expired-hold reconciliation, but does **not** automatically send email, buy labels, retrieve carrier ETAs or issue refunds. Always use the actual carrier and Stripe dashboard to reconcile before fulfilling paid orders.


## Live carrier shipping branch (November 2026)

The site now contains a browser destination/shipping service selector, server-only **FedEx OAuth Rate/Transit API connector**, server-only Canada Post **legacy XML v4 rating connector**, authenticated signed quotes valid for 10 minutes, exact packed parcel profiles, quoted-rate Stripe Checkout and address/amount mismatch reviews. Full detail is in `OWNER_SETUP.md` §8, `CARRIER_INTEGRATION_STATUS.md`, and `SHIPPING_PACKAGE_MEASUREMENTS.csv`.

**Do not claim current Canada Post Portal compatibility:** Canada Post deprecated the legacy XML platform in 2026. An adapter for the new JSON/OAuth portal needs its verified OpenAPI schema and account-specific testing. Without matching developer accounts/credentials, measured packages and test charges, carrier results cannot be verified and checkout remains disabled.

## Shipping and international orders — latest update

- Live-carrier quote endpoint accepts a verified packed parcel profile and an explicitly allowed destination country.
- **FedEx** adapter: OAuth Rates & Transit Times (requires working account credentials and tested request/response).
- **Canada Post** adapter: legacy XML v4 only. The new Canada Post Developer Portal JSON/OAuth Rating API is a different integration and is **not** activated by this version; the account owner must obtain the new schema and credentials before promising Canada Post service.
- `/api/shipping-quotes` returns available quotes and transit information from the configured carrier(s), and a signed 10-minute quote token. There are no hard-coded shipping charges in live-carrier mode.
- International shipping is OFF by default beyond `CA,US` and must be explicitly allowed/tested for each destination. Customs declarations/duties, insurance, regional carrier eligibility, and actual packed measurements remain seller responsibilities.
- `scripts/build_shipping_packages.py` converts measured rows in `SHIPPING_PACKAGE_MEASUREMENTS.csv` to a validated Cloudflare `SHIPPING_PACKAGES_JSON` value, refusing unverified entries.
- Paid address mismatches require manual resolution with a detailed owner note under migration 004; duplicate-sale inventory conflicts cannot be resolved via this workflow.

See `OWNER_SETUP.md` sections 8–9 and `CARRIER_INTEGRATION_STATUS.md` for limitations.

## Final payment confirmation safeguard

Migration 004 also updates the checkout status view so payments flagged for shipping or inventory review display a review warning to customers, rather than an unconditional completed-order message. For international shipping, the owner must verify customs documents, destination delivery restrictions, actual insured postage, customer consent and any tax/duty liability before dispatch.

## New — comfortable text and light/dark themes

The storefront now includes a persistent **Light mode / Dark mode** switch on the shop, account, Paper Trail Lab, books, collectibles, review and owner pages. It respects the device preference unless a visitor chooses a mode. The reading system uses system sans-serif for controls/body text, better spacing and contrast, focus outlines, reduced motion, and a scrollable mobile shipping bag. Product photographs are unchanged. For details, read `ACCESSIBILITY_UPGRADE.md`.

**Review links:** The production package is for GitHub → Cloudflare Pages with Functions; the separately supplied Netlify ZIP is only a non-payment review demonstration.

## Shareable offline review file (not production)

The separate 1.6 MB `Burton_And_Found_GitHub_Cloudflare_Stripe_Preview.html` supplied alongside the downloadable source ZIP is a **self-contained sample**; its prices and shipping estimates are examples and checkout is disabled. For regenerating a compressed offline review file from this repository, install Python's optional `Pillow` and `beautifulsoup4` packages, then run `python scripts/make_preview.py`. The result is saved as `Burton_And_Found_Review_Preview.html` at repo root and is git-ignored. **Never deploy the offline demo HTML in place of Cloudflare's `public/` and `functions/` production project.**

The GitHub Actions workflow is **validation only**. Cloudflare Pages performs deployment from the connected GitHub repository; no payment credentials belong in GitHub Actions.

## Mobile menu and user accounts

The `site-menu.js` / `site-menu.css` pair supplies an explicit **Close** button, outside-tap backdrop, Escape support, focus loop and expanded-state sync on the shop, Paper Trail Lab and account pages. **Sign In** and **Create Account** have direct links on desktop and in mobile navigation.

Customer registration/login uses **Supabase Auth**, not fake localStorage passwords. To activate it, run the database migrations listed in `OWNER_SETUP.md` and set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in Cloudflare Pages environment variables (the public site reads them from `/api/public-account-config`). Alternatively fill these public values in `public/config.js` if preferred. Never put your Supabase secret/service key in public code. With no Supabase project, buttons open the sign-in and registration forms, but will clearly report that live accounts are not yet enabled.

## Dark-mode readability update (November 2026)

The latest dark contrast repair is recorded in [DARK_MODE_READABILITY_UPDATE.md](DARK_MODE_READABILITY_UPDATE.md). It adds `public/dark-contrast-fixes.css` and preserves all backend integrations. The self-contained storefront and account previews can be regenerated using `python scripts/make_preview.py` and `python scripts/make_account_preview.py`.
