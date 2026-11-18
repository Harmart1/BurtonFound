# Old Hollywood archive — recommended draft pricing and release checklist

**Prepared:** 17 November 2026  **Currency:** CAD  **Scope:** 73 digitized page scans in 9 source groups.

## Pricing approach

Draft asking prices for individual paper ephemera were assigned from **CAD $14.95–$34.95**. This is a proposed Burton & Found retail starting point, **not a formal appraisal or a claim of realized-sale market value**. Portrait and magazine-page sellers have recent asking prices around US $15–$22 for identifiable original 1930s Hollywood paper; bulk auction prices can be much lower. A verified original studio silver-gelatin photograph, lobby card, complete magazine, autograph or poster is a distinct product class and must be priced from comparable sales for the exact format.

Examples checked:
- Etsy, AmericanCenturyShop: [Warren William portrait + biography, original magazine page, US $16 asking](https://www.etsy.com/listing/1365945033/vintage-1930s-warren-william-portrait)
- Etsy, UKPressClippings: [Fred Astaire original mini-poster/magazine clipping, US $15.20 asking](https://www.etsy.com/listing/4486881788/original-vintage-mini-poster-magazine)
- iCollector/Lion and Unicorn: [10 old-Hollywood studio publicity photographs, sold for US $30 to floor plus buyer premium, 20 June 2026](https://www.icollector.com/10pc-Black-and-White-Movie-Stars-Publicity-Photos-c-1930-1940_i60225022)
- Britannic Auctions: [148 original Hollywood publicity photos sold as a lot for US $1,500 in 2023](https://www.britannicauctions.com/sold/148-original-1930s-40s-hollywood-actresses-starlets-publicity-photos/)

These comparables are not a like-for-like appraisal of each scan. Item-level market value depends substantially on physical stock, condition, image rarity, original publication, trimming, restoration and any studio stamp or photographic process. No tax, carrier charge or shipping amount is included in the suggested price.

## Integrity of this import

- `public/old-hollywood-catalog.js` contains **73 item-level image records** with suggested CAD prices on **71** and **two withheld** for duplicate/overlap checks.
- `OHN-005-08` may overlap an Alice in Wonderland magazine page; `OHN-007-08` is an alternate scan of the same Back from Eternity ad. Do not treat either as additional saleable stock without physical confirmation.
- `OHN-008-09` shows a household appliance advertisement, not Old Hollywood, and should be moved to Vintage Advertising if confirmed to be a distinct physical page.
- Other images can also be front/back views, several views of the same page, or mixed magazine sheets. **The 73 scans are not proof of 73 separate pieces.**
- Advertisements should not be described as original movie posters, lobby cards or studio photos solely because those images appear in printed paper.
- The prior six purchasable Old Hollywood products and the existing Coca-Cola items are not modified.
- No new item is inserted into `bf_products`, `bf_units`, `public/products.js` or Stripe pricing; the 71 price suggestions are browse-only until verified.

## Required release checks for each approved sale item

1. Physically confirm the item is in stock, independently identifiable, and not already represented by another SKU.
2. Photograph the whole front and reverse (and any defects), confirm whether it is an original period magazine page, publicity photo, reprint or other format.
3. Record title/identity with certainty levels, publisher, issue/date if substantiated, dimensions, provenance and actual condition (including creases, marks and losses).
4. Check sale/image-publishing rights and any brand/copyright/advertising restrictions that may apply.
5. Approve an individual price based on the **verified actual physical item**, then set one-to-one inventory and safe availability in Supabase before checkout activation.
6. For packing and carrier quotes, measure the parcel and confirm shipping/insurance with the configured account.

**The browse-only archive can be published immediately. New live checkout offers should not be enabled by this file.**
