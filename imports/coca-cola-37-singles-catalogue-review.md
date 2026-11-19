# Coca-Cola: 37 individually listed advertisements and six sets

**Burton & Found catalogue update — 19 November 2026**

The initial image archive had 34 distinct Coca-Cola advertising designs. A subsequent 8-page Coke.pdf intake contributed **three new designs**, resulting in **37 distinct paper-item inventory units**. Twenty-three originals were previously available only inside the five original bundles (SET-A through SET-E). Those exact 23 existing units now also have individually priced listings. All six sets are retained without creating additional physical stock.

**Customer-visible listings:** 37 single advertisements + 6 curated sets = **43 Coca-Cola purchase listings**. **Physical units:** 37, with the sets sharing the underlying inventory. The website catalogue contains 131 products overall, inclusive of other categories.

## Newly released individual advertisements

The 23 asking prices below use previously documented archive valuation ranges (all CAD). Prices are seller proposals, not independently verified completed-sale comparables. Original source descriptions, condition notes and photographs remain attached to each product.

| SKU | Ad title | Archive year | Archive indicative range CAD | Individual asking CAD | Set |
|---|---|---:|---:|---:|---|
| CC-002 | Its Taste Holds the Answer | 1939 | $10–$20 | **$16.95** | SET-A |
| CC-003 | Thirst Stops Here | 1940 | $12–$22 | **$18.95** | SET-A |
| CC-004 | You Taste Its Quality | 1942 | $12–$22 | **$18.95** | SET-A |
| CC-007 | You're Wonderful…Have a Coca-Cola | 1946 | $12–$22 | **$18.95** | SET-D |
| CC-009 | Work Refreshed | 1949 | $12–$25 | **$19.95** | SET-A |
| CC-012 | Serve Coke…With Good Things to Eat | 1951 | $12–$25 | **$19.95** | SET-B |
| CC-013 | …Enjoy Food | 1952 | $15–$30 | **$24.95** | SET-B |
| CC-014 | Situation Well in Hand | 1953 | $10–$20 | **$16.95** | SET-B |
| CC-015 | Busy People Pause for Coke | 1953 | $12–$22 | **$18.95** | SET-C |
| CC-016 | The Pause That Refreshes — Cowboy | 1953 | $7–$18 | **$14.95** | SET-C |
| CC-017 | There's This About Coke — It Sure Is Preferred | 1954 | $10–$22 | **$17.95** | SET-B |
| CC-019 | The Friendliest Drink on Earth | 1956 | $12–$25 | **$18.95** | SET-B |
| CC-021 | Sign of Good Taste — In Wyoming | 1958 | $12–$22 | **$18.95** | SET-C |
| CC-022 | Sign of Good Taste — Switzerland | 1958 | $10–$22 | **$17.95** | SET-C |
| CC-024 | Be Really Refreshed — Cold Crisp Coke | 1959 | $10–$22 | **$15.95** | SET-D |
| CC-025 | Be Really Refreshed — Drive-In for Coke | 1959 | $11–$22 | **$16.95** | SET-D |
| CC-026 | Be Really Refreshed — Bowl with Coke | 1960 | $10–$22 | **$16.95** | SET-D |
| CC-028 | Refreshing New Feeling — Zing Glass | 1962 | $10–$20 | **$16.95** | SET-E |
| CC-029 | Refreshing New Feeling — Swimming Pool | 1962 | $10–$20 | **$16.95** | SET-E |
| CC-030 | The Pause That Refreshes — Next Dance | 1963 | $12–$22 | **$18.95** | SET-D |
| CC-031 | Refreshing New Feeling — Three Coke Glasses | 1963 | $12–$22 | **$18.95** | SET-E |
| CC-032 | Refreshing New Feeling — Red Jackets | 1963 | $8–$18 | **$14.95** | SET-E |
| CC-033 | Things Go Better with Coke — Two Bottles | 1964 | $9–$18 | **$14.95** | SET-E |

## Preserved collector sets

| Set | Existing asking price CAD | Total individual asking prices CAD | Approximate saving | Shared originals |
|---|---:|---:|---:|---|
| SET-A · The Early Years | $49.95 | $74.80 | 33% | CC-002, CC-003, CC-004, CC-009 |
| SET-B · At the Table | $64.95 | $98.75 | 34% | CC-012, CC-013, CC-014, CC-017, CC-019 |
| SET-C · Away We Go | $49.95 | $70.80 | 29% | CC-015, CC-016, CC-021, CC-022 |
| SET-D · Good Times | $59.95 | $87.75 | 32% | CC-007, CC-024, CC-025, CC-026, CC-030 |
| SET-E · Bright & Bold | $59.95 | $82.75 | 28% | CC-028, CC-029, CC-031, CC-032, CC-033 |

## Stock and sales safeguards

- No newly minted `bf_units` rows: all 23 products link directly to their pre-existing `CC-002`, etc., physical inventory units, which are also linked to their original collector sets.
- A reversible checkout-hold test confirmed a single `CC-002` can be held, while a cart containing `CC-002` and its parent `SET-A` is rejected as overlapping. No holds were retained.
- The public shop displays standard product detail pages and CAD prices; seller payment acceptance remains gated until live Stripe, shipping and tax approvals are in place.
- Product images include the existing polished photograph plus the archive's original image variant; they are two views of the same paper, not two items.
- Publication year, printed source, dimensions and original-paper condition remain subject to the caveats attached to the underlying catalogue entries.

## Release review checks

- Total 131 unique catalogue product SKUs, 43 Coca-Cola listings, 37 individually priced Coca-Cola advertisements, six Coca-Cola sets
- 23 newly released originals, each with available original photograph and catalogue metadata
- Shared stock mapping maintained for all 23 previously set-only originals
- Homepage, alternate storefront, collector account and interactive preview load the expanded catalogue before rendering
