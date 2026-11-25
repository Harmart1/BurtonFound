# Burton & Found — Carrier integration status (25 November 2026)

**Deployment: safely prepared; customer payments and public carrier quotes remain disabled.** Full setup: [CARRIER_LAUNCH_CA_US.md](CARRIER_LAUNCH_CA_US.md).

| Component | Status |
|---|---|
| Destination selector (Canada and United States only) | Implemented; public choices scoped |
| Canada Post Developer Portal Rating v4 JSON/OAuth | **Implemented against official 2026 OpenAPI**; requires merchant app credentials and actual sandbox/production checks |
| Legacy Canada Post XML v4 | Kept only as explicit `CANADA_POST_API_MODE=legacy` fallback, not the default |
| FedEx OAuth Rates & Transit Times API | Existing implementation retained; production credentials and real quote comparison outstanding |
| Signed 10-minute rate/parcel/country/price quote | Implemented with HMAC and alteration/expiry checks |
| Untracked Canada Post services | Excluded |
| Test-app / sandbox quote suppression | Public quote API does **not** offer carrier stub/sample prices |
| Canada and U.S. destination validation | Enforced server side; no other countries |
| U.S. cross-border checkout | Blocked pending `US_SHIPPING_APPROVED` owner approval |
| Canada Post U.S. duty declarations | Blocked pending `CANADA_POST_US_DUTIES_APPROVED` owner approval and Zonos/Declaration ID process |
| Live Stripe checkout | **OFF**, all payment and tax gates unchanged |
| Parcel measurement worksheet | 229-SKU generator; no dimensions or weights fabricated |
| Verified packed parcel measurements | **Not yet supplied by owner** |
| Carrier API production tests | **Not performed**; no merchant secrets available |
| Labels, tracked events and customs declarations | Manual fulfillment remains; no claim of carrier billing or label purchase automation |

**Note:** Customer postcode/city/state is re-entered in Stripe. Shipping mismatches are flagged *after payment* for manual review. This risk must be addressed before enabling live money for cross-border orders. Postal postage excludes U.S. customs duties/taxes/brokerage.
