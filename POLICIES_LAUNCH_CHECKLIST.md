# Burton & Found — Ontario / Canadian website policy release checklist
**Drafted:** 20 November 2026. **Status:** Public-facing policy language implemented, operational facts must be confirmed before enabling purchase processing or marketing email.

## Policy pages published
- `/policies/privacy.html`: PIPEDA-style transparency, account and guest data, Cloudflare/Supabase, marketing, cross-border processing, access/correction, incident response.
- `/policies/terms.html`: website rules, collectible descriptions, historical trademarks, independent-seller disclaimer, account access, mandatory rights.
- `/policies/shipping-returns.html`: preview-only status, shipping and sale disclosure, actual carrier terms to be confirmed, statutory remedies preserved.
- `/policies/cookies.html`: guest browser storage, account sessions, security logs, optional advertising consent if tools added.
- `/policies/accessibility.html`: Ontario accessibility service and alternate-format requests.

Each footer link has a directly accessible URL and progressive-enhancement native HTML `<dialog>` viewer with close controls. Products, collections and guides are given the same links at build time. The policy text is written for the current preview mode and must be reviewed when the business starts taking orders.

## Owner confirmations required BEFORE taking orders
1. **Legal merchant identity and correspondence.** Verify the exact legal entity or sole proprietor/trade name, legally usable public address, and whether 356 Queen St. E., Sault Ste. Marie, ON P6A 1Z1 is an authorized business correspondence address for this shop.
2. **Working monitored support/privacy email.** `public/config.js` presently has an empty `sellerEmail`. Set a real monitored email; display it in footer and all policies with a tested support workflow. Direct account/privacy, cancellation and accessibility requests to this contact. Avoid publishing a made-up email.
3. **Actual shipping disclosures.** Confirm Canada-only versus international coverage, parcel size/weight and carrier options, handling/dispatch times, shipping charges and tax treatment, transit damage process and, if international shipping is offered, customs/duties responsibility. The code currently has `SHIPPING_ALLOWED_COUNTRIES=CA` and carrier quotes OFF. Disclose specific delivery promises only when operationally supported.
4. **Return terms.** Decide whether to offer a voluntary change-of-mind return/exchange period, its conditions, deadlines and return shipping payer. The current policy explicitly says no voluntary return program has been established yet; do not advertise “final sale/no refunds” as a waiver of mandatory consumer rights.
5. **Ontario internet agreement workflow.** Before accepting paid online consumer agreements, audit O. Reg. 17/05 s. 32-33 and CPA 2002 ss. 37-40: prescribed seller identity/contact, item and price/tax/shipping data, delivery date and other material terms, error correction, explicit accept/decline, agreement copy within prescribed period, cancellations/refunds.
6. **Stripe/Supabase actual processing.** Confirm data flows, privacy access controls, providers' retention/cross-border policies, user deletion handling, whether fulfilment sends personal details to carriers, required records, and the effective breach response process. Implement a documented privacy contact and internal retention schedule.
7. **Marketing consent.** Collector account registration is not marketing permission; before sending commercial email, verify separate meaningful consent, audit records, identity and working unsubscribe mechanisms. Do not import lists without a lawful basis.
8. **Accessibility.** Audit actual site interactions, mobile/keyboard focus, contact channel and alternate-format fulfillment. Do not make unsupported WCAG conformance claims.
9. **Final owner acceptance and publication.** Recheck the business contact details, policy accuracy and dates, and test dialogs as keyboard and touch users before opening payment collection. Recheck all source links and statutory changes at launch.

## Official legal source references
- Ontario Consumer Protection Act, 2002: https://www.ontario.ca/laws/statute/02c30
- Ontario Regulation 17/05 (General): https://www.ontario.ca/laws/regulation/050017
- Ontario Consumer Protection Act, 2023 (not yet in force according to Ontario e-Laws as at 20 November 2026): https://www.ontario.ca/laws/statute/23c23
- Ontario returns and warranties: https://www.ontario.ca/page/returns-exchanges-and-warranties-ontario
- PIPEDA: https://laws-lois.justice.gc.ca/eng/acts/P-8.6/
- Office of the Privacy Commissioner of Canada business guide: https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/pipeda-compliance-help/guide_org/
- CRTC CASL guidance: https://crtc.gc.ca/eng/com500/guide.htm
- Ontario accessibility rules: https://www.ontario.ca/page/accessibility-rules-businesses-and-non-profits

## Deployment and ongoing duties
- Code deploy does not activate checkout, Search indexing or carrier quotes.
- Validate with `npm run check:deploy && npm test`; check public policy routes and HTML dialog interaction after Cloudflare deployment.
- Revisit policies whenever adding analytics, Meta Pixel, Google Ads conversions, mailing list service, new carrier destinations, new product categories, photo uploads or online payments.
