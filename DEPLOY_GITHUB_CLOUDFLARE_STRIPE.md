# Burton & Found: GitHub → Cloudflare Pages → Stripe

## Hosting decision

Use **GitHub** for source control and **Cloudflare Pages** for the public store. Do **not** publish the shop with GitHub Pages. The static website resides in `/public`, private Cloudflare Functions are in `/functions`, and database migrations are in `/supabase`. The repository root deliberately has **no index.html**.

## Automated checks before publishing

Run `npm run check:deploy` and `npm test` at repository root. A GitHub Actions workflow (`.github/workflows/validate.yml`) runs the checks for each push and pull request, without needing secrets. A passing GitHub check does **not** prove real Stripe payments or carrier rates work until you have a connected test environment.

## Connect Cloudflare Pages

1. Create a GitHub repository and upload **the contents of this ZIP**. Do not upload the ZIP as a single repository file.
2. Visit Cloudflare dashboard → Workers & Pages → Create a Pages project → Connect to Git → select this repository.
3. Use **Framework preset: None**, **Root directory: repository root**, **Build command: empty** (or `exit 0` if the UI requires a value), **Build output directory: `public`**.
4. The `functions/` directory must stay at repository root. Cloudflare Pages automatically deploys its routes; `public/_routes.json` ensures Functions serve **only `/api/*`** and static photos/pages do not consume Function invocations.
5. In Cloudflare project **Preview** environment settings, explicitly set `LIVE_CHECKOUT_ENABLED=false` and `CARRIER_QUOTES_ENABLED=false`. Do not reuse production payment and carrier secrets in preview branches. GitHub pull requests may create shareable preview deployments; they must not collect money.
6. Verify a site URL exists with `/api/health` showing `checkout: preview_only` while no service settings are supplied. The store should still show all 22 listings.
7. The website may be previewed before services are configured, but do not advertise it as taking payments until the integration tests and tax/shipping decisions below are complete.

**Note:** A Netlify Drop demo ZIP does not include the necessary Cloudflare Functions and is **not** a production deployment. Do not use Cloudflare Pages dashboard Direct Upload as a substitute for Git integration without independently building and deploying the Functions.

## Stripe setup and keys

1. Create/verify your Stripe account and bank payout information, then start in **test mode**.
2. Connect a Supabase project, run database migrations **001, 002, 003, 004 in that order**, then `supabase/seed.sql` to register 22 listings and 40 unique physical pieces.
3. In Cloudflare Pages → project → Settings → Variables and Secrets, create these settings:

| Key | Location | Before launch |
|---|---|---|
| `SUPABASE_URL` | Cloudflare plain variable | Supabase HTTPS URL |
| `SUPABASE_PUBLISHABLE_KEY` | Cloudflare variable + *public* `/public/config.js` | Public key only |
| `SUPABASE_SECRET_KEY` | **Cloudflare encrypted secret** | **Never** browser/GitHub |
| `STRIPE_SECRET_KEY` | **Cloudflare encrypted secret** | `sk_test_...` initially |
| `STRIPE_WEBHOOK_SECRET` | **Cloudflare encrypted secret** | Matching `whsec_...` |
| `TAX_CONFIGURATION_APPROVED` | Cloudflare variable | Keep `false` until tax review |
| `LIVE_CHECKOUT_ENABLED` | Cloudflare variable | Keep `false` until test checkout works |
| `SHIPPING_MODE` | Cloudflare variable | Use `flat_rate` or `live_carrier` |
| `CARRIER_QUOTES_ENABLED` | Cloudflare variable | Keep `false` until carrier setup is verified |
| `SHIPPING_QUOTE_SECRET` | **Cloudflare encrypted secret** | Random 32+ character value |
| `SHIPPING_PACKAGES_JSON` | **Cloudflare encrypted secret/variable** | Actual measured, verified package profiles |

4. Set Stripe's webhook destination to **`https://YOURDOMAIN/api/stripe-webhook`**, listening for Checkout completed, expired, async payment succeeded and async payment failed events.
5. For `SHIPPING_MODE=flat_rate`, configure real shipping charges in CAD cents (no fabricated amounts). For `live_carrier`, connect verified package measurements and genuine carrier credentials. **The Canada Post integration in this package uses deprecated legacy XML; it is NOT compatible with the current JSON/OAuth API without a separate implementation.**
6. Configure the store's shipping/returns/privacy/terms policies, confirm tax registration and rates, and test all US/international options before enabling destinations other than Canada.
7. After test orders succeed, deliberately switch to matching **live** Stripe secret + webhook signing secret, review tax/shipping conditions, then enable real checkout. A running site with unconfigured keys must continue to show a preview-only state.

## Checkout safety expectations

- Never trust customer-supplied amounts: `/api/checkout` reads authoritative prices/physical stock from Supabase, then creates the Stripe Checkout Session on the server.
- Payment fulfillment is triggered by **signature-verified Stripe webhooks**, not by a browser success page.
- Shipping quotes are signed with short expiries and bound to destination, cart and verified parcel. Address changes in Stripe are flagged for manual review before shipping.
- The owner dashboard requires server-verified Supabase authorization. Automatic carrier labels, shipping notices and refunds **are not implemented**.
- Update the repository only after completing checkout, concurrent-order, webhook, account-isolation and refund workflows in a test project. The included test suite uses mocks and does not replace live provider testing.

Official documentation: [Cloudflare Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/), [Cloudflare Functions routing](https://developers.cloudflare.com/pages/functions/routing/), [Stripe webhook processing](https://docs.stripe.com/payments/checkout/fulfillment).

## Where the latest easy preview lives

The separate `Burton_And_Found_GitHub_Cloudflare_Review_Preview.html` file supplied alongside the ZIP is an **offline demo** with sample shipping choices. It is **not in this production Git repository**. It should not be uploaded as the live payment site.
