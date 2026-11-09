# Burton & Found — Supabase, customer accounts and owner access

## Completed and verified — 9 November 2026

- Connected project: **Burton and Found Site**, reference `nyvdrgpcwfasajyncnhi` (healthy PostgreSQL 17 instance).
- Applied four schema migrations and the inventory seed: **22 listings, 40 physical items, 40 mappings**.
- Private `BF_SUPABASE_SECRET_KEY` was added by the owner to GitHub Actions secrets and successfully installed as encrypted `SUPABASE_SECRET_KEY` in Cloudflare Worker `burtonfound`. The separate publishable key is in `wrangler.jsonc`; it is intended for browser use.
- Stripe **sandbox-only** secret key and signature key were installed separately; production charging remains disabled.
- Live site returns all 22 products from the private server-to-Supabase inventory API.
- Live Auth configuration reports email sign-in **enabled** and email confirmation **required**. The project currently has **one confirmed account** but **no administrator assignment**. Do not grant administrator permission merely because an account happens to be first.
- Live security audit verifies unauthorized customer/order/owner API requests are rejected, anonymous REST access to private Supabase tables is blocked, invalid Stripe webhook signatures are rejected, and checkout stays `preview_only`.
- Tests: **46 passed, 0 failed**.
- Cloudflare deployment and security audit: [deployment](https://github.com/Harmart1/BurtonFound/actions/runs/42570733929), [audit](https://github.com/Harmart1/BurtonFound/actions/runs/42570931443).

## Next: safely authorize a verified owner

The owner-only admin interface is at [`/admin/orders.html`](https://burtonfound.timharmar.workers.dev/admin/orders.html). A link appears on a signed-in collector account's dashboard once the server confirms that account is an administrator.

The GitHub workflow [`grant-owner-admin.yml`](.github/workflows/grant-owner-admin.yml) is **prepared but NOT executed**. It requires the exact email of a registered, email-confirmed account to be stored in an encrypted GitHub secret. It checks Supabase Auth for exactly one verified matching account before adding its user ID to `public.bf_admin_users`. It does not print account information or enable payments.

1. If your own collector account is not the existing verified account, [create it](https://burtonfound.timharmar.workers.dev/account.html#signup), confirm its email, and sign in.
2. In [GitHub Actions Repository Secrets](https://github.com/Harmart1/BurtonFound/settings/secrets/actions) add **`BF_OWNER_EMAIL`**, containing your exact registered and verified owner-account email address. **Do not commit or paste your email into repository files** for this step.
3. Tell the assistant **"Owner email secret added"**. It can deliberately update `.github/owner-admin-trigger.txt`, invoking the workflow automatically. The workflow uses the already-installed `BF_SUPABASE_SECRET_KEY` GitHub secret, so you do not need to resupply any API keys.
4. Sign in at [`account.html`](https://burtonfound.timharmar.workers.dev/account.html), and open the new **Owner orders & shipping** link.

## Supabase Auth Dashboard settings to verify before customer launch

The connected Supabase MCP tools do not expose the project Authentication URL / SMTP configuration fields, so these settings cannot be confirmed or modified automatically through the current connection:

- [Authentication → URL Configuration](https://supabase.com/dashboard/project/nyvdrgpcwfasajyncnhi/auth/url-configuration): set **Site URL** to `https://burtonfound.timharmar.workers.dev`; add `https://burtonfound.timharmar.workers.dev/account.html` as allowed redirect. For the existing password reset route, also add `https://burtonfound.timharmar.workers.dev/account.html#security` if supported.
- [Authentication → Email / SMTP](https://supabase.com/dashboard/project/nyvdrgpcwfasajyncnhi/auth/providers): verify confirmation emails arrive and password reset links return to this site. **Before admitting public customers**, configure a production-grade custom SMTP sender with a verified domain and appropriate SPF/DKIM/DMARC. Supabase's default sender is limited and may send only to authorized project team addresses; an API settings check alone does *not* prove deliverability.
- [Authentication → Security](https://supabase.com/dashboard/project/nyvdrgpcwfasajyncnhi/auth): maintain email confirmation, appropriate rate limits and anti-abuse controls, and consider MFA for owner accounts.
- Supabase security advisor flagged seven intentionally server-only RLS tables without visitor policies (informational) and the intentionally signed-in-user callable `delete_my_account()` function (review before production use).

Supabase official guidance: [redirect URL configuration](https://supabase.com/docs/guides/auth/redirect-urls), [SMTP restrictions](https://supabase.com/docs/guides/auth/auth-smtp), [production security checklist](https://supabase.com/docs/guides/security/production-checklist).

## Payment safety boundary

`wrangler.jsonc` retains all four approval controls set to `false`: `LIVE_CHECKOUT_ENABLED`, `LIVE_PAYMENTS_APPROVED`, `TAX_CONFIGURATION_APPROVED`, `CARRIER_QUOTES_ENABLED`. Do **not** enable live payment processing without explicit owner approval, verified taxes, shipping pricing and end-to-end test coverage.

Never put `sb_secret_...` keys, Stripe keys, PostgreSQL passwords or connection strings into browser code, GitHub files or chat. Keep secrets in encrypted GitHub Actions secrets and Cloudflare Worker secrets only.
