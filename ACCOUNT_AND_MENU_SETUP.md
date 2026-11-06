# Burton & Found — Accounts and navigation

## Closing the site menu

Every page with a hamburger menu now uses one controller. Click **Close ×**, the menu button again, the darkened area outside, a navigation link, or press Escape. The controller restores keyboard focus and keeps `aria-expanded` accurate.

## Sign in and Create Account

- Desktop header: separate **Sign In** and **Create account** actions
- Mobile/tablet: both actions appear at the very top of the menu
- Existing customer: `/account.html#signin`
- New customer: `/account.html#signup`
- Forgot password: on the sign-in form
- Signed-in customers may manage watchlists, saved bags, addresses and order history.

### Activate real accounts

1. Create a Supabase project. Enable Email provider under **Authentication → Providers**.
2. In SQL Editor run `supabase/migrations/001_accounts_and_commerce.sql`, then `002`, `003`, `004` in order; run `supabase/seed.sql` to register inventory only when ready. Do not re-seed a live inventory unnecessarily.
3. In Cloudflare Pages project Settings → Variables and Secrets, add **`SUPABASE_URL`** = your actual `https://<project>.supabase.co` URL and **`SUPABASE_PUBLISHABLE_KEY`** = your `sb_publishable_...` public key. The new `/api/public-account-config` safely serves ONLY these publishable settings to browsers. **Never** expose `SUPABASE_SECRET_KEY` to browsers.
4. In Supabase Auth URL Configuration set **Site URL** to your deployed HTTPS domain and add `https://YOURDOMAIN/account.html` and `https://YOURDOMAIN/account.html#security` as allowed redirects. Configure email templates and reliable email sending for confirmations/password reset.
5. Test one real registration with an email you control; verify confirmation, login, logout, password reset, and access to account features.
6. Check account policies in the original migration before accepting customer data. Keep Stripe test mode and carrier quotes disabled until verified.

**Without a Supabase project/keys, the UI cannot create real user accounts**. No credentials or personal details should be entered into an offline preview or a published demo before the backend and privacy policy are configured.
