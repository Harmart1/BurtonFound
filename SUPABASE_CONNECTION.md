# Burton & Found — Supabase integration

## Verified current state (9 November 2026)

- **Project:** Burton and Found Site (`nyvdrgpcwfasajyncnhi`), active, PostgreSQL 17.
- **HTTPS API:** `https://nyvdrgpcwfasajyncnhi.supabase.co`.
- **Database migrations:** All four checked-in SQL migrations (`001` through `004`) applied successfully via the authorized Supabase connector and recorded in migration history.
- **Seed:** `supabase/seed.sql` applied. Verified **22 product listings, 40 physical inventory units, 40 product-to-unit mappings**, zero orders, and zero administrators.
- **Security:** All 13 public application tables have RLS enabled. Privileged `bf_*` database routines can be invoked only by the service role. Supabase security advisor reported informational notices for seven intentionally server-only tables with no visitor policies and a warning about the intentional authenticated `delete_my_account()` SECURITY DEFINER routine. Review account deletion semantics and privileges before production launch.
- **Public publishable key:** Retrieved securely from Supabase and configured in `wrangler.jsonc` as `SUPABASE_PUBLISHABLE_KEY`. This key is designed for browser use. Never put `sb_secret_...`, the database password, or a PostgreSQL URI in GitHub source.
- **Stripe:** Burton & Found sandbox test credentials installed separately in the Cloudflare Worker. All payment/checkout flags remain disabled.
- **Private Supabase key:** **Not installed yet** (requires owner to store it securely).

## One remaining credential (owner action)

1. In the [Supabase API Keys dashboard](https://supabase.com/dashboard/project/nyvdrgpcwfasajyncnhi/settings/api-keys), get a **secret** API key beginning `sb_secret_`. It has privileged database access; never share it in chat or commit it in a file.
2. Open [GitHub repository Actions Secrets](https://github.com/Harmart1/BurtonFound/settings/secrets/actions), select **New repository secret**, and save:
   - **Name:** `BF_SUPABASE_SECRET_KEY`
   - **Value:** the secret API key for project `nyvdrgpcwfasajyncnhi`.
3. Reply **"Supabase secret added"**. The assistant can trigger the prebuilt workflow `.github/workflows/install-supabase-credentials.yml` by updating `.github/supabase-install-trigger.txt`. Do not rerun the SQL migrations or seed.

The workflow checks that the intended project matches `wrangler.jsonc`, validates the public key already present there and the newly stored secret key using the project's HTTPS API, uses existing authorized Cloudflare deployment credentials, installs the secret as a Cloudflare Worker encrypted secret, redeploys to `burtonfound`, then verifies the public account config and `checkout=preview_only`. The Stripe test keys remain independent.

## Authentication settings to configure in Supabase dashboard

In [Authentication → URL Configuration](https://supabase.com/dashboard/project/nyvdrgpcwfasajyncnhi/auth/url-configuration):

- Site URL: `https://burtonfound.timharmar.workers.dev`
- Redirect URL: `https://burtonfound.timharmar.workers.dev/account.html`
- If needed for password-reset email flow, also permit `https://burtonfound.timharmar.workers.dev/account.html#security`.

Review signup confirmation email, rate limits, SMTP email delivery, password reset, and owner account registration. The account admin role must be granted **only after the owner signs up**, using an administrator-authorized database statement to add the owner's `auth.users.id` to `public.bf_admin_users`. Do not grant admin permissions based on browser input or user-controlled metadata.

## Checkout launch boundary

The following flags in `wrangler.jsonc` must remain `false` while performing this setup: `LIVE_CHECKOUT_ENABLED`, `LIVE_PAYMENTS_APPROVED`, `TAX_CONFIGURATION_APPROVED`, and `CARRIER_QUOTES_ENABLED`.

Do not activate live payments or test checkout until Supabase secret installation, authentication security checks, inventory/checkout integration tests, verified shipping, and approved tax configuration are completed. Keep all live Stripe keys out of this store until separately authorized.
