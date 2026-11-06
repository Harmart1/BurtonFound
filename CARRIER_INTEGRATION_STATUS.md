# Burton & Found — Live Carrier Integration Status

| Component | Status |
|---|---|
| Customer destination and carrier service selector | Implemented |
| FedEx OAuth / Rates & Transit Times API | Implemented, not live-tested without credentials |
| Canada Post legacy XML v4 Rating API | Implemented; Canada Post deprecated legacy platform in 2026 |
| Canada Post new JSON/OAuth Rating API | **Not yet integrated**; obtain the current OpenAPI specification and credentials |
| International destination restrictions | Implemented through explicit country allowlist |
| Packed weight and dimension profiles | Template delivered, awaits physical measurements |
| Signed short-lived quote / Stripe shipping charge | Implemented, automated tests pass |
| Paid order country/postal/city/state mismatch review | Implemented, automated tests pass |
| Manual shipping dashboard | Implemented, needs live Supabase credentials |
| Shipping mismatch reviewed and unblocked by owner, with note and inventory checks | Implemented in migration 004, not live tested |
| Packaging CSV to verified JSON helper | Implemented; refuses missing measurements |
| Estimated dispatch dates in Ontario local time | Implemented; weekends excluded, holidays require manual review |
| Standalone shareable shipping preview | Implemented using **illustrative, not real** carrier charges |
| Automatic labels, carrier tracking events, customs filing | Not implemented; use Snap Ship / FedEx Ship Manager manually |
| Live-rate verification | Not possible until credentials and measured parcels available |

**Do not imply live shipping is already connected.**

Carrier credentials **do not activate quoting** by themselves: explicitly set `CARRIER_QUOTES_ENABLED=true` after validating allowed countries and measured packages. For real checkout, `LIVE_CHECKOUT_ENABLED=true` and the other payment/tax gates remain separately required. Carrier APIs are not public demos.
