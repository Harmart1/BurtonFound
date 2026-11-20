# Burton & Found — Legal policies, customer notices and pre-launch sign-off

**Prepared:** 20 November 2026. **Jurisdiction:** Ontario, Canada, with federal Canadian law where applicable.

## Published customer-facing policies

The five accessible, standalone pages are:

- `/policies/privacy.html` — privacy and personal information handling
- `/policies/terms.html` — website Terms of Use
- `/policies/shipping-returns.html` — shipping, returns, cancellations and consumer rights
- `/policies/cookies.html` — cookies, functional browser storage and possible provider identifiers
- `/policies/accessibility.html` — accessibility and customer service

All primary static pages and the generated product, collection, guide and gift pages link to these policies in their footers. Clicking a policy link opens a responsive **native HTML dialog** that can be closed by button, backdrop click or Escape, with focus returned to the originating link. A standalone URL remains available without JavaScript. Do not hand-edit generated product pages; adjust `scripts/build-marketing.mjs` and regenerate.

## Pre-launch review required before accepting any purchase

1. **Identity and response contact:** verify the exact business legal name and any trade-name registration; confirm that the published 356 Queen St. E., Sault Ste. Marie, ON P6A 1Z1, Canada address is authorized for business correspondence, as already displayed in the site footer. Configure an actual monitored business email; `public/config.js` currently has `sellerEmail: ""` and no public support/privacy email is set. Publish an effective means to contact the business and meet required internet agreement seller-identification disclosures.
2. **Shipping:** decide exact shipping destinations, packaging, dispatch window, published delivery representation, carrier charges, taxes/duties, tracking/insurance options and what happens when a shipment is missing or damaged. Do not promise a real-time quote when carriers are disabled.
3. **Returns:** choose and publish an honest **optional** change-of-mind returns policy, including window, exceptions and shipping cost responsibility. This is separate from mandatory statutory cancellation and warranty/misrepresentation rights. Do not advertise a discretionary returns period until it can be fulfilled.
4. **Ontario internet agreements:** confirm compliant pre-contract disclosure, total payment/tax/shipping details, review-and-correction step, seller information, time to deliver a copy of the internet agreement, and cancellation procedures before enabling online checkout.
5. **Privacy governance:** appoint a privacy-contact person; confirm the actual account/data processors, hosting locations, retention/deletion periods, security and breach-response procedures. Verify if a consent manager or updated notice is required before deploying analytics/remarketing pixels.
6. **CASL:** do not market to collector-account signups by default. Verify opt-in collection, recordkeeping, sender identification and functional unsubscribe before sending promotional commercial electronic messages.
7. **Accessibility:** confirm keyboard and screen-reader testing on actual devices; keep alternative formats and customer-service feedback available. AODA website requirements depend on employee count, but reasonable accommodation under Ontario law should not be overlooked.
8. **Legal changes:** confirm Ontario's Consumer Protection Act, 2002 remains applicable before launch. The Consumer Protection Act, 2023 has been enacted but **was not yet in force** as verified on 20 November 2026.
9. **Payments:** keep Cloudflare Worker flags `LIVE_CHECKOUT_ENABLED`, `LIVE_PAYMENTS_APPROVED`, `TAX_CONFIGURATION_APPROVED` and `CARRIER_QUOTES_ENABLED` at `false` until owner review and comprehensive test transactions. New policy text alone is not authorization to collect money.
10. **Search indexing:** maintain `MARKETING_INDEXING_APPROVED=false` until the owner is satisfied with public seller disclosures, policies, catalogue provenance, and readiness for contact enquiries.

## Primary official references

- Ontario Consumer Protection Act, 2002: https://www.ontario.ca/laws/statute/02c30
- Ontario Regulation 17/05: https://www.ontario.ca/laws/regulation/050017
- Consumer Protection Act, 2023 (not yet in force as of 20 November 2026): https://www.ontario.ca/laws/statute/23c23
- Office of the Privacy Commissioner — PIPEDA business guide: https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/pipeda-compliance-help/guide_org/
- Canadian Anti-Spam Legislation: https://crtc.gc.ca/eng/com500/guide.htm
- Ontario accessibility requirements: https://www.ontario.ca/page/accessibility-rules-businesses-and-non-profits

**Scope and limits:** These are carefully worded public disclosures adapted to the site's currently visible implementation, with known missing business information expressly noted. They should be checked against actual operating procedures and the final merchant identity before public purchases begin. They are not a substitute for configuring compliant checkout or privacy operations.
