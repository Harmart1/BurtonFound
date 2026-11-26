# Commerce request protection

Preview checkout and public rate quoting remain off. The Worker now uses separate Cloudflare edge rate limiting bindings before invoking active checkout or carrier handlers: 8 checkout attempts and 24 rate requests per 60 seconds per Cloudflare-provided connecting address. This is a conservative initial guest-store policy, not a claim of perfect bot prevention. Shared networks can share a limit; distributed traffic and Cloudflare locations have separate approximate counters. The API returns HTTP 429 and Retry-After: 60 on denial; missing or failed bindings fail closed for enabled commerce routes.

The JSON reader independently caps actual streamed request bytes (8,192 for checkout and 4,500 for quotes), even without Content-Length. No new customer data store or external service is introduced. The Stripe webhook is not subject to these guest-route limits. Existing inventory holds, merchant identity, payment approval and signed quote protections remain in place.

Before commercial activation: confirm deployed bindings, review normal shopper retries and shared-network traffic in a controlled sandbox, and consider stronger bot challenges or global budget limits if abuse warrants them. Do not use real cards or enable rates to test preview-only deployment.

Cloudflare reference: https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
