# Burton & Found — Vintage Automobiles photo import

This folder is an **upload intake**, not a public product catalogue. The importer and its GitHub Actions workflow have already been installed.

## One-time upload

1. Download the file named **`BurtonFound-Vintage-Cars-Site-Upload.zip`** from the ChatGPT conversation. It is approximately 11.6 MB and contains exactly **93 WebP page scans** and four non-purchasable collection files.
2. Open [the repository imports folder](https://github.com/Harmart1/BurtonFound/tree/main/imports), choose **Add file → Upload files** (or use [the GitHub uploader](https://github.com/Harmart1/BurtonFound/upload/main/imports)).
3. Upload **the ZIP without unpacking it** and commit it to `main` under the exact path:
   `imports/BurtonFound-Vintage-Cars-Site-Upload.zip`

**Do not upload the larger original `BurtonFound-Vintage-Cars-Import.zip` package.** The site-upload ZIP is specifically sanitized: it excludes private Google Drive links and private review files.

## What happens automatically after upload

The GitHub workflow `.github/workflows/import-vintage-cars.yml` will:

- Validate that the archive contains exactly 93 real WebP image files and four gallery files.
- Check that every draft SKU is unique, the images match the titles, and **no new product is saleable**.
- Copy the images into `public/assets/images/vintage-cars/` and create `public/vintage-cars.html`.
- Add **Vintage Automobiles** to the existing desktop/mobile navigation and collection rail, plus a browse-only homepage feature.
- Run the deployment checks and automated tests.
- Commit the image files and updated navigation, remove the temporary ZIP upload from the latest repository tree, and request the existing **test-safe** Cloudflare Worker deployment.

The public gallery is **coming soon / under review**. It does **not** enter `public/products.js`, `public/bf_products`, `bf_units`, the shopping bag, or Stripe Checkout. The existing 22 sale listings remain intact.

The first 93 entries are **scanned page images**, not proof of 93 distinct physical items. Duplicate groups and condition, inventory ownership and prices require review before any sale listing is created.

## After importing

- Follow the GitHub **Actions** run: [Vintage Automobiles import](https://github.com/Harmart1/BurtonFound/actions/workflows/import-vintage-cars.yml).
- When deployment finishes, browse the collection at `https://burtonfound.timharmar.workers.dev/vintage-cars.html`.
- Cross-check the 93-page review spreadsheet and mark duplicates and condition before authorizing any individual paid listing.

**Do not enable live payment controls** as part of this import. Verify commercial rights to publish the source photographs if they were created by someone else.
