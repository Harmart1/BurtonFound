# Automated account email setup

The account recovery code is deployed. The daily account email readiness workflow verifies public authentication settings and account UI assets without creating accounts or sending mail. It distinguishes public checks from management-only settings and delivery. The Python config tests exercise repair logic with fixtures.

## Preferred route: direct dashboard
For a one-time repair, the safest way is to avoid granting a broad personal token to GitHub. In [URL Configuration](https://supabase.com/dashboard/project/nyvdrgpcwfasajyncnhi/auth/url-configuration), set Site URL to https://burtonfound.timharmar.workers.dev and add https://burtonfound.timharmar.workers.dev/account (also keep https://burtonfound.timharmar.workers.dev/account.html for older links). Keep existing legitimate redirect URLs. In [SMTP settings](https://supabase.com/dashboard/project/nyvdrgpcwfasajyncnhi/auth/smtp), configure a verified transactional mail provider. Never disable email verification to bypass delivery failures.

## Automated alternative
The owner may run scripts/auth-config.py locally with a short-lived authorized Supabase management access token in BF_SUPABASE_MANAGEMENT_TOKEN (not sb_secret or publishable key). Audit: python scripts/auth-config.py. Repair: python scripts/auth-config.py --apply. SMTP: supply verified BF_SMTP_HOST, BF_SMTP_USER, BF_SMTP_PASSWORD, BF_SMTP_FROM, BF_SMTP_PORT (465 or 587) locally and run python scripts/auth-config.py --apply --smtp. Never paste tokens into chat, source code, command history, or logs. Revoke the token after use.

Alternatively save these values as encrypted repository Actions secrets and manually run **Burton & Found account email readiness** from main, choosing audit, repair, or repair-and-smtp. Only explicit manual dispatch reads management secrets. Remove those secrets and revoke the token after setup. The script refuses to overwrite a different existing custom domain, preserves redirect allow-list entries, enables registration, requires verified email and updates SMTP only on explicit selection with complete credentials. API bodies and credential values are not printed. The management API checks are not an email delivery test.

After configuration, use a new mailbox controlled by the owner (not a project team address), register, receive and follow the verification email, then sign in and request a fresh password reset. Verify the new password works. Existing users should reset rather than re-register. No actual email provider or account was created by this workflow.

Cloudflare redirects HTML filenames to extensionless routes. The canonical callback is /account, and the client accepts /account, /account/ and /account.html without forwarding them. This prevents an authentication redirect loop.
