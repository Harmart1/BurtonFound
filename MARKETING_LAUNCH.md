# Burton & Found — organic marketing automation and launch checklist

Updated 19 November 2026.

## Built into the site

- Every deployment builds 131 standalone, search-friendly product pages from the existing product catalogue. Pages include product-specific titles/descriptions, original product photos, share images, canonical URLs, Product structured data, internal links, condition disclaimers and a direct path back to the working shop.
- Three collection landing pages: /collections/coca-cola.html, /collections/hollywood.html and /collections/sets.html.
- Three collector articles: /guides/collecting-vintage-ads.html, /guides/caring-for-vintage-paper.html and /guides/old-hollywood-printed-paper.html.
- /sitemap.xml, /robots.txt and SEO-friendly internal discovery links from the homepage.
- The inventory-based marketing script generates marketing-output/pinterest-and-social-catalog.csv, 14-day-social-calendar.md, collector-newsletter-draft.md and marketing-readiness.json.
- The GitHub Actions workflow "Prepare Burton & Found weekly marketing kit" generates the marketing drafts every Monday at 13:00 UTC and stores them as a downloadable artifact for 30 days. It does **not** post to social media or send email.
- Code, URLs, image references and asking prices are automatically refreshed when the source inventory is updated and the site is redeployed. Generated pages should not be hand-edited.

## Important: indexing is deliberately still OFF

The homepage remains noindex and generated pages default to noindex,follow. Owner review of seller contact, physical-stock condition, tax/shipping and sales policies is still required. Once approved, change MARKETING_INDEXING_APPROVED from false to true in wrangler.jsonc and redeploy; this regenerates indexable product, collection and guide pages and removes noindex from the main homepage. This is distinct from the checkout approval flags.

Set MARKETING_SITE_URL to the final preferred HTTPS origin if a custom domain replaces the Workers hostname, then redeploy. That updates canonical URLs, sitemap and marketing exports together.

After indexing is enabled, verify the site in Google Search Console and submit /sitemap.xml. A Google account, domain/DNS access and owner authorization are needed. Search engines determine if and when pages are indexed.

## Organic Pinterest and collector communities

The CSV provides one factual product-specific description, actual image URL, and link for each currently listed product. Review provenance claims and source photographs before using. A reasonable initial target is 5 to 10 original organic Pins a week, alongside useful collector-group participation where rules permit promotional links. Posting or scheduling requires connecting accounts and approving a provider; this repository does not post without authorization.

## Newsletter and Canadian anti-spam compliance

The newsletter is a DRAFT, not a sent email or live signup form. Customer registration and watchlists must not imply permission for marketing emails. Before collecting a marketing list, choose a consent-managed email platform and publish accurate seller contact and privacy information. Record consent and include mandatory sender identification and functional unsubscribe controls in any commercial emails. Do not import existing customer email addresses without an appropriate basis.

## Free shopping feeds

No Google Merchant Center or Pinterest shopping feed is published while the Stripe, shipping and tax readiness gates remain disabled. Product structured data omits price Offer markup until checkout is approved. Once transactions, inventory stock, returns and delivery charges are confirmed, the merchant can apply for free product placements and use an accurate inventory-aware feed.

## Tests and setup

From the repository root using Node 22:

    npm run build:marketing
    npm run check:deploy
    npm test

Marketing output in marketing-output/ is deliberately private to GitHub Actions artifacts and is not sent to the publicly hosted site. The production Cloudflare Worker serves the generated HTML/CSS from public/.

## Owner-dependent steps

1. Approve product/provenance, shipping, return and seller-contact claims.
2. Confirm live Stripe, tax and shipping before enabling payments.
3. Approve search indexing and set the preferred domain.
4. Connect Google Search Console and Pinterest.
5. Connect an email platform for compliant signups and opt-in sending.
6. Validate marketplace eligibility and real-time stock before activating shopping feeds.
