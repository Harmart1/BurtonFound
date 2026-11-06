# Burton & Found — readable typography and appearance modes

This edition adds one visible **Light mode / Dark mode** control to every customer-facing page and the private shipping dashboard. The appearance setting is remembered in the visitor's browser. On a new visit with no prior choice, the site follows the operating system's light/dark preference. The setting also changes with the operating system until the visitor explicitly chooses a mode.

## Readability choices

- Core navigation, descriptions, forms, shipping choices and collector-account features use the familiar operating-system sans-serif font. Vintage-style serif typography is retained selectively for editorial collection headings and the brand.
- Larger default text, more generous line height and readable line widths improve scanning; labels have clear boundaries and buttons meet a minimum practical tap size.
- Coca-Cola and Old Hollywood remain visible as equal-priority collection shortcuts. Product-search and collection filters are unchanged, with less decorative treatment around controls.
- Dark mode uses a dark forest background and light text, with contrasting accents. The original product photographs are not recolored or filtered, so the paper condition can still be inspected.
- The shopping bag, including carrier-rate controls, scrolls on short mobile screens; selected options and checkout actions remain reachable.
- Visible keyboard focus outlines and a skip-to-main-content link support predictable, keyboard-friendly navigation. Animations respect `prefers-reduced-motion`.
- Phone layouts simplify the header and hide a redundant decorative top strip; account navigation remains available in the mobile menu.

## How the toggle works

- Files: `public/theme-init.js`, `public/theme-controls.js`, and `public/accessibility-theme.css`.
- `theme-init.js` executes before the stylesheets, preventing the wrong theme from flashing during page load.
- `theme-controls.js` updates the accessible button name, pressed state, icon, and visible label.
- No external font downloads, tracking scripts, account requirements or cookies are needed for the appearance setting.
- Setting key: `burton_found_theme` in local browser storage. This is a visual preference, not sensitive account information.

## Sources used

The design follows published guidance for cognitive usability, clarity and accessible interfaces. No single typeface or appearance is universally suitable for every person with ADHD; providing clear defaults and user choice is more robust.

- W3C WAI, Help Users Focus: https://www.w3.org/WAI/WCAG2/supplemental/objectives/o5-user-focus/
- W3C WAI, Help Users Understand What Things Are and How to Use Them: https://www.w3.org/WAI/WCAG2/supplemental/objectives/o1-understandable/
- W3C WAI, Help Users Find What They Need: https://www.w3.org/WAI/WCAG2/supplemental/objectives/o2-find/
- W3C WAI, Designing for Web Accessibility: https://www.w3.org/WAI/tips/designing/
- WCAG 2.2: https://www.w3.org/TR/WCAG22/

## Verification and outstanding work

- Both modes and basic cart interactions tested in Chromium at 320, 390, 768, and 1440 CSS pixels, with no horizontal document overflow.
- Account, Paper Trail Lab, books, collectibles, feedback, checkout status, and private shipping dashboard checked in both phone and desktop widths.
- 26 existing backend mock tests passed; live carrier quotes, Stripe payment, account registration and checkout verification still need owner credentials and real-world testing.
- The generated standalone interactive preview and Netlify demonstration use sample shipping rates and dates only and must not be used to accept payments.
- A manual accessibility audit with screen readers, keyboard-only navigation, 200%–400% browser zoom, colour contrast testing across all states, and participation by actual visitors with varied needs is recommended before launch. This code alone is **not** a WCAG certification.
