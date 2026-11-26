# Burton & Found — Automated pre-launch inventory review

The storefront displays **229 merchandise listings**, but some products (especially vintage automobile designs) have not been physically verified and are not yet represented as sellable database inventory. Customer payments must remain disabled until approved.

### Run the new launch review

- Go to [Actions → Burton & Found weekly launch inventory review](https://github.com/Harmart1/BurtonFound/actions/workflows/launch-inventory-audit.yml).
- Choose **Run workflow** for an immediate fresh audit.
- Download the GitHub artifact `burtonfound-launch-inventory-review`. It contains:
  - `launch-inventory-review.csv`: every published SKU with its displayed asking price, the corresponding public database price/availability if available, checkout flag, physical-verification status, shared physical-unit IDs, and blank **owner inspection, approval and notes** columns.
  - `launch-inventory-reconciliation.md`: grouped counts for missing database SKUs, backend-only records, price mismatches, and launch configuration checks.
- The report is also shown in GitHub Actions' run summary.

A new weekly Monday read-only run checks whether any of these counts change, with no database credentials or merchant keys. No record is added, removed, marked in stock or sold by this workflow.

### How the owner should use the CSV

1. Filter **Review priority** for `PRICE MISMATCH` and `CRITICAL` first.
2. For every SKU you actually own, inspect the **physical original**, confirm date/size, condition, reverse side, preservation/presentation, and capture actual packed dimensions.
3. Confirm intended CAD selling price and how the physical unit overlaps any curated bundle.
4. Enter owner notes, inspected and approved fields in the downloaded local worksheet. Those fields are **not automatically imported** into Supabase.
5. Only once the records are approved, reconcile stock with the current `bf_products`, `bf_units`, and `bf_product_units` data using a reviewed migration that preserves sold/reserved status.
6. Rerun the audit and compare missing/price-mismatch counts. Avoid treating published photographs as proof an original is available.
7. Continue test-mode Stripe webhooks and checkout verification when the business's test key has been validated. Live payments remain off.

### Technical usage

- `node scripts/audit-launch-inventory.mjs` — uses current public `/api/catalog` endpoint.
- `node scripts/audit-launch-inventory.mjs --offline` — generates the full owner review worksheet without external requests; database status is **Unknown**, never fabricated.
- Unit tests use an explicit local JSON fixture for deterministic missing-SKU and price-mismatch checks.

**Safety:** The workflow is read-only and does not require Supabase service-role access. If the live stock API is unreachable, it reports database fields as **Not checked**, rather than incorrectly claiming 229 missing records.

### What this does not settle

The new report does not certify actual physical inventory, tell you whether you must collect GST/HST, validate Stripe payouts or carrier credentials, register a domain, or enable public search indexing. Business email (`sellerEmail` in `public/config.js`) is still unconfigured; the owner must provide and verify a suitable address. See [Stripe payment launch runbook](STRIPE_PAYMENT_LAUNCH_2026.md) and [Canada/U.S. shipping runbook](CARRIER_LAUNCH_CA_US.md).
