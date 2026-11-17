# Burton & Found — Staff Content Studio

**Private dashboard:** https://burtonfound.timharmar.workers.dev/admin/studio.html

This is a **CMS (Content Management System)** for editing the website; the existing customer-account and order-management tools are separate CRM/commerce functions. It reuses existing Supabase Auth and Cloudflare Worker infrastructure, with no extra paid SaaS subscription.

## Owner activation — required only once

A customer's sign-up never grants admin access. The owner must first have a **verified Burton & Found store account**. The original owner's \`bf_admin_users\` table intentionally starts empty.

1. Open the storefront [Account page](https://burtonfound.timharmar.workers.dev/account.html), sign up with the owner's personal email and verify the confirmation email.
2. In GitHub, go to [Repository Actions secrets](https://github.com/Harmart1/BurtonFound/settings/secrets/actions) → **New repository secret**, name it \`BF_OWNER_EMAIL\` and enter **exactly the verified account email**. Never put a password or API secret in this field.
3. Run [Securely authorize Burton & Found verified owner](https://github.com/Harmart1/BurtonFound/actions/workflows/grant-owner-admin.yml) with the confirmation checkbox selected. The existing workflow validates the email against a confirmed Supabase Auth account and grants only that exact account owner access.
4. Sign in using the owner's own account, then open the [Content Studio](https://burtonfound.timharmar.workers.dev/admin/studio.html).

**The owner workflow does not activate checkout, payments, tax or shipping.** If \`BF_OWNER_EMAIL\` is already configured, just confirm the correct account and rerun the secure workflow.

## Add a collaborator

1. Ask the person to sign up through the normal Burton & Found [Account page](https://burtonfound.timharmar.workers.dev/account.html) and confirm their email.
2. Owner opens **Content Studio → Your team**, enters their **exact confirmed email**, and selects **Editor** or **Manager**.
3. **Editor:** can add products, upload photos, create and edit catalogue and page copy, and save private drafts. Cannot publish or change another person's access.
4. **Manager:** can edit drafts and publish/unpublish website editorial changes. For existing products, publishing a CAD price edit updates the matching authoritative \`bf_products.price_cents\` in the same database transaction; the site still cannot accept payments until the owner separately approves launch settings.
5. **Owner:** all manager permissions plus grant/revoke staff members. Owner authentication is secured by the existing \`bf_admin_users\` allowlist. Editors/managers do not gain order fulfilment access.

Staff can be revoked by exact email through **Your team → Revoke by email**. No one needs GitHub collaborator access, database passwords or Stripe keys.

## Supported changes

- Existing **Coca-Cola and Old Hollywood** listings: title, short/long descriptions, CAD price (under controlled manager publication), condition, photo and publication metadata.
- Existing **Vintage Automobiles**: title, make, era, specific description, new image and suggested CAD price; all remain **not for sale**.
- Proposed **curated sets**: title, included SKUs, theme, descriptions, suggested CAD set price; this never allocates physical stock.
- New product listings: create a unique \`CMS-...\` SKU, add a photo and description, save draft, and let a manager publish it. Newly created products are always **preview-only**; physically verified stock must be imported through the separate inventory process before any sale.
- Website text: homepage introduction, automobile archive introduction, and a store announcement.
- Image uploads: real JPEG/PNG/WebP files up to 5 MB. Uploads are inspected for actual image file signatures and stored under random names in the dedicated Supabase Storage \`bf-cms-media\` bucket. **Public media URLs must contain product photographs only**—not private customer information. Source archive image files are preserved.

The published catalogue is served by \`/api/cms/published\` and read by the existing storefront and vintage gallery. No GitHub commit or manual Cloudflare deployment is needed after each manager's publish click.

## Security and workflow

- Passwords and email verification are managed by Supabase Auth.
- Cloudflare validates current signed-in sessions, confirmed emails and per-user role records for **each private operation**.
- Browser code receives only a public Supabase key. All secret database, user management and image-upload operations happen on the Cloudflare server.
- The three CMS tables have RLS enabled and **no direct \`anon\` or \`authenticated\` data privileges**; only the server-side service role can read/write them.
- Private drafts never appear on the storefront. Each edit is audited with a user ID, timestamp, revision and previous/new data. Optimistic revision checking prevents overwriting another editor's changes.
- Product prices published by managers are synced with the authoritative existing products table. The manager cannot change quantities, order status, stock allocations or checkout flags.
- Original 22 store listings, 80 curated automotive designs and 18 sets remain intact. Commerce approval flags remain \`false\`.
- New CMS-only product previews display **COMING SOON · PREVIEW** and cannot be added to the checkout bag.
- The CMS supports text and photo updates, not arbitrary HTML, JavaScript, custom page layouts, payment configuration or external product links.

## Technical maintenance

Files:
- \`public/admin/studio.html\`, \`studio.css\`, \`studio.js\`
- \`functions/_lib/cms.js\`, \`functions/api/cms/\`
- \`src/worker.js\` API routing
- \`supabase/migrations/005_delegated_cms.sql\`
- \`tests/cms-studio.test.mjs\`

Owner-facing order dashboard: https://burtonfound.timharmar.workers.dev/admin/orders.html

The website and editor run on the same Cloudflare Worker. A staff member can use the editor on a phone, tablet or desktop.

**Outstanding owner decision:** name the colleague by email once their verified account exists, and choose Editor or Manager. No staff account has been granted access automatically.
