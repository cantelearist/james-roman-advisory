# Use provider-confirmed supplemental billing

The Private Office uses Stripe-hosted Checkout Sessions for invoice payment and treats signed webhook events as the authoritative payment record. A successful browser redirect is never sufficient to mark an Invoice paid.

Issued Invoices and accepted contracts are immutable source records. A Change Order is separately numbered and accepted; when it changes the fee, acceptance creates a supplemental Invoice instead of modifying the original amount. This preserves a reconstructable commercial record and makes webhook processing idempotent.
