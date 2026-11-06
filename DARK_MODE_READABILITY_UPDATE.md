# Burton & Found — Dark theme readability repair

This revision changes dark-mode text and surface colours without changing the vintage product photography, the light theme, inventory, customer-account behaviour, Stripe Checkout, Cloudflare Functions or carrier-code integration.

## Changes

- Corrected **Create Account** and other cream/pale buttons to use dark, readable lettering.
- Corrected product-photo overlay badges, view controls, and bag quantity badges to use dark lettering on cream backgrounds.
- Fixed editorial sections where light text had been placed over original light backgrounds (Paper Trail teaser, decade guide, About section).
- Matched card/label backgrounds and text in Paper Trail Lab, including input forms, decade choices, photo intake, status messages, and research cards.
- Fixed feedback/review form labels, buttons and selection chips, plus books and collectibles pages.
- Improved empty-bag text, checkout instructions, shipping destination form fields and carrier choices.
- Retained system sans-serif for interface text, visible keyboard focus outlines, reduced-motion support and the existing dark/light mode switch.

## Validation performed

- Computed-colour contrast check on **visible text nodes** in 6 page templates (`index.html`, `account.html`, `papertrail.html`, `books.html`, `collectibles.html`, `review.html`) after allowing CSS transitions to finish. For the text/surfaces covered by the script, no samples fell below **4.5:1** in dark mode.
- Browser preview tested at 320px, 390px, 768px and 1440px with **22 catalogue listings** and no horizontal overflow or JavaScript page errors.
- Theme switching, menu open and close, shopping-bag opening, account page and catalogue filters passed.
- Sample carrier choices displayed correctly in the dark shopping bag. Examples are **fictional** and payments are disabled in the review preview.
- Existing Node.js tests: **34 passed**; Cloudflare deployment check passed.

This is **not** a formal WCAG certification: the contrast script doesn't validate images with embedded text, gradients, transparency, animations, all interaction states, or assistive-technology behaviour.

## Deployment

- `public/dark-contrast-fixes.css` is appended as the **last stylesheet** to all affected public HTML templates, so it overrides conflicting legacy colours without rewriting vintage art styles.
- Upload the contents of the **Hosting ZIP** into GitHub, then deploy with Cloudflare Pages (project root = repository root, build output directory = `public`, leave build command blank).
- The **Review ZIP** is an offline demonstration with the storefront and account preview and is **not** a live payment or account backend. You may use Netlify Drop for sharing the demo.
