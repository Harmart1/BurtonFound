# Burton & Found — selected Supabase project (November 2026)

**Project reference:** `nyvdrgpcwfasajyncnhi`  
**Project HTTPS API:** `https://nyvdrgpcwfasajyncnhi.supabase.co`  
**Cloudflare website:** `https://burtonfound.timharmar.workers.dev`

The project reference comes from the owner's PostgreSQL connection-string hostname. **That string is not an app connection URL. Never put a PostgreSQL password, `postgresql://...` string, Supabase secret key, or Stripe secret into GitHub or `public/`.**

## Current state

- `wrangler.jsonc` includes the new **public project API URL** and keeps all checkout, payment approval and carrier quotation flags `false`.
- The new project is **not accessible through the currently connected Supabase account in ChatGPT**. No database migrations or seed data have been applied by this automation.
- Customer sign-up is **not verified** and payments are **disabled**. Do not treat the API's public account-config route alone as proof that login works.

## Finish database setup

1. Open the project in the [Supabase Dashboard](https://supabase.com/dashboard/project/nyvdrgpcwfasajyncnhi). Make sure the project is active and owned by the account you intend.
2. To let ChatGPT continue with database migrations, connect/reconnect the Supabase plugin with the Supabase identity that owns this project. Merely changing GitHub repository accounts does not change Supabase access.
3. Check for existing tables/migrations. For a clean empty project apply the files under `supabase/migrations/` in order (001 to 004), then `supabase/seed.sql`. Do not rerun migration 001 without reviewing its already-created constraints and policies. Verify RLS and check the expected 22 product listings / 40 physical items.
4. Supabase Dashboard → Authentication → URL Configuration: set Site URL to `https://burtonfound.timharmar.workers.dev`; add allowed redirect URLs `https://burtonfound.timharmar.workers.dev/account.html` and `https://burtonfound.timharmar.workers.dev/account.html#security` if needed for account email flows.
5. Supabase Dashboard → Project Settings → API Keys: copy the project's **publishable** (`sb_publishable_...`) key and **secret** (`sb_secret_...`) key. **Do not share the secret in chat or GitHub source.**
6. Cloudflare Dashboard → Workers & Pages → `burtonfound` → Settings → Variables and Secrets: configure `SUPABASE_PUBLISHABLE_KEY` (the client-safe key, which is returned by the public account-config API) and `SUPABASE_SECRET_KEY` as an encrypted **Secret**. `SUPABASE_URL` is already in `wrangler.jsonc`. Store keys on the Worker and retain them for subsequent Wrangler deployments; do not add them to public source or to the deployment workflow.
7. Test account creation, email confirmation, sign in/out, password reset, signed-in customer isolation, admin access and server inventory endpoints. Review authentication email deliverability.

## Payment boundary

Keep `LIVE_CHECKOUT_ENABLED=false`, `LIVE_PAYMENTS_APPROVED=false`, `TAX_CONFIGURATION_APPROVED=false`, and `CARRIER_QUOTES_ENABLED=false` throughout database and authentication setup. For Stripe testing, use a **Burton & Found** test-mode merchant account (not an unrelated connected business sandbox) and `sk_test_...` credentials only. Do **not** activate live payments.

## Automated Cloudflare credential installation (prepared)

A dedicated, preview-only GitHub Actions workflow is now available:

`.github/workflows/install-supabase-credentials.yml`

**Do not upload your PostgreSQL connection string or password.** There is no GitHub/Supabase repository ownership requirement: this site uses the project's HTTPS API.

### One-time owner action

1. Reconnect the Supabase plugin in ChatGPT using the identity that actually owns project `nyvdrgpcwfasajyncnhi`. The current connection lists only an unrelated inactive project and has no permission for this project; until reconnected the assistant cannot safely apply migrations or verify the target database.
2. In the [project API Keys page](https://supabase.com/dashboard/project/nyvdrgpcwfasajyncnhi/settings/api-keys), find the **publishable** (`sb_publishable_...`) and **secret** (`sb_secret_...`) keys. The secret key has privileged database access: **never send it through chat, commit it, or put it in browser code**.
3. In [BurtonFound GitHub Actions Secrets](https://github.com/Harmart1/BurtonFound/settings/secrets/actions), add:
   - `BF_SUPABASE_PUBLISHABLE_KEY` = the publishable key.
   - `BF_SUPABASE_SECRET_KEY` = the secret key, as a repository secret.
4. Tell the assistant **"Supabase connected and both GitHub secrets added"**. It can apply the migrations/seed via the Supabase connector after verifying the correct project, and then trigger the GitHub-to-Cloudflare installation without requiring you to run Actions manually.

The automated installation verifies both keys against the HTTPS API of `nyvdrgpcwfasajyncnhi`, validates the existing Cloudflare account, uploads them as Worker encrypted secrets, deploys only to `burtonfound`, and checks the public account configuration. It enforces `checkout: preview_only` throughout.

### Order matters

The GitHub workflow installs credentials; **it does not apply database migrations**. Use the Supabase connector to inspect the selected project's existing schema first, apply migrations `001`–`004` and `supabase/seed.sql` with verified RLS, and run security advisors. Only then install keys and test customer accounts. Stripe sandbox keys already installed in Cloudflare are independent; this workflow is not intended to replace them.

The Supabase project's **Auth → URL Configuration** must allow `https://burtonfound.timharmar.workers.dev` as Site URL and `/account.html` and `/account.html#security` as redirect targets. Those settings should be checked in the Supabase Dashboard.
