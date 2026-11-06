# Burton & Found — Shipping Operations Edition

This edition builds on the earlier Cloudflare + Stripe starter; no changes to the vintage storefront's product photography, catalogue pricing, featured Coca-Cola / Old Hollywood collections, books, collectibles or Paper Trail Lab.

## Functional improvements

- **Stripe test/live distinction:** `/api/health` returns `preview_only`, `test_mode`, or `live_mode`. The storefront shows an unmistakable test-payment banner and test checkout label when configured with Stripe test credentials.
- **Owner fulfillment workspace:** private `/admin/orders.html` shows status counts, order search and filters, printable packing slips, copyable addresses, manually prepared shipping emails and CSV exports.
- **Protected fulfillment history:** `supabase/migrations/002_fulfillment_workflow.sql` introduces audit events for owner-recorded status changes, and prevents dispatch without both carrier and tracking information.
- **Stock safety:** a product without linked physical inventory is unavailable; a checkout hold can be owner-reconciled **only after Stripe confirms expiration without payment**. Open and paid sessions cannot be released by this feature.
- **Order confirmation:** the bag is cleared after webhook-confirmed payment, rather than at the moment the visitor returns from Stripe.
- **Testing:** 11 automated unit/integration-mock tests; self-contained storefront and fictional-data shipping-dashboard demos checked in Chromium at desktop, tablet and phone widths.

## Important limitations

- **No live payment or database configured.** This is code and local demonstration, not a production payment launch.
- **No actual shipping labels, postage purchasing, carrier ETAs, tax calculations, live refunds or automatic email delivery.** Canada Post remains manually managed.
- Only Canada shipping addresses are currently accepted by Stripe Checkout; charges are owner-defined flat per-order values in Canadian cents.
- Photos, physical condition, completeness (particularly the assumed whole May 1933 magazine) and inventory quantities must be verified before making public offers.
- The customer-account system still requires Supabase authentication configuration; a mock dashboard preview is not a real login.
- Webhooks and database migrations have been tested with mocks/static checks, **not** against a connected live Stripe or Supabase project.

## Starting point

Read [OWNER_SETUP.md](OWNER_SETUP.md). If migration 001 is already installed, run migration 002 without rerunning the original inventory seed unnecessarily. Keep secrets only in Cloudflare encrypted settings.
