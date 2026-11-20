# Vintage Automobiles — published CAD asking-price rationale

**Prepared:** November 20, 2026

**Decision:** Publish the existing research-supported prices as Burton & Found's **asking prices**, not as provisional or indicative estimates. This does not assert that physical inventory has been checked or authorize payment collection. The independent 98-product catalogue already had carefully differentiated price recommendations.

## Recommended published prices

- **80 individual catalogue designs:** CAD **$12.95–$24.95**, with an average of **$17.49**.
- **18 curated collector sets:** CAD **$32.95–$59.95**, priced below the sum of their constituent individual asking prices.
- Keep the existing SKU-specific amounts from `public/vintage-cars-data.js` and `public/vintage-cars-sets.js` as the canonical values. `public/vintage-cars-products.js` maps these to the main store's `price` and `priceStatus:'asking_price'`.
- Do not add an unsupported rarity premium based solely on the marque name or illustrated vehicle date. Actual sold prices can differ materially from current advertised listings.

## Comparable listings checked November 20, 2026

- Original 1930 Buick advertisement, approximately **CA$23.54** advertised: https://www.etsy.com/ca/listing/1712520853/vintage-1930-buick-original
- Original 1931 Buick magazine advertisement, approximately **CA$18.77** advertised: https://www.etsy.com/listing/1525378719/1931-buick-straight-eight-magazine-ad
- Vintage Cadillac advertisements in the Etsy Canada market, with many advertised between approximately **CA$11 and CA$29** and some higher: https://www.etsy.com/market/cadillac_vintage_ads
- Original 1957 Chevrolet Bel Air magazine advertisement listed at **US$21.50**, alongside other original automobile advertising: https://www.flashbacksusa.com/category/usa-car-ads
- Other prices are visible in the Etsy vintage car magazine advertising market: https://www.etsy.com/market/car_advertising_from_vintage_magazines

These are examples of **asking**, not verified realized sale, prices, and listings differ in condition, dimensions and historical publication details. Currency conversion is **not assumed** when USD examples are given.

## Display rules

Show each automobile item as a normal catalogue entry with photograph, description, **posted CAD price**, and Add to Bag. Remove the phrases “indicative price,” “suggested asking price,” “stock verification,” and “final price confirmation” from the customer-facing automobile catalogue, preview and bag. Do not assert “in stock” or “ready to ship” when that has not been established.

**Merchant safety:** `requiresVerification:true`, `availableForCheckout:false`, `quantity:0` and the checkout guard remain in the private product metadata. A shopping bag may contain automobile listings, but its button creates a purchase request rather than charging a card. This must remain enforced until the proprietor has done the necessary operational review. Existing store-wide payment, tax, shipping-quote and indexing flags remain disabled.
