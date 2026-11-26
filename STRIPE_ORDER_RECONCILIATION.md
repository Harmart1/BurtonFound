# Stripe order reconciliation

The private owner bookkeeping workspace can compare a selected UTC period of up to 25 live or sandbox order records against the matching Stripe account and expanded Checkout/PaymentIntent/Charge/balance transaction. Uses GET only, verifies merchant identity, never sends customer PII or card data to the browser, and flags mismatched IDs, payment state, amount, shipping, refunds, disputes and original charge fees. Sandbox records remain visibly separate. CSV values are CAD and formula escaped by the existing CSV helper.

Only the original charge balance transaction is included, not payout or deposit matching. Charge refund amounts are provider-reported at the time of checking, not settled refund totals. Reconcile each refund, dispute, adjustment, tax and bank deposit separately; this is not a complete accounting ledger. No changes to orders, payments, refunds or payouts occur. If the matching Stripe key is missing, invalid or belongs to another merchant, the comparison fails closed. An empty period requires no Stripe API call. Tests use synthetic data; a real Stripe payment has not been processed.

Owner path: private orders dashboard, load a period in bookkeeping, click Verify against Stripe, review flags, download CSV. No live checkout approval is implied.
