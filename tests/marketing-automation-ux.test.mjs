import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {runInNewContext} from 'node:vm';
import {execFileSync} from 'node:child_process';
const root=process.cwd(),read=p=>readFileSync(join(root,p),'utf8');
test('Product zoom uses concise wording and provenance disclaimer is not displayed in shop',()=>{
 const shop=read('public/store.js');
 assert.ok(shop.includes('⤢ View larger photo'));
 assert.ok(!shop.includes('View the actual photograph larger'));
 assert.ok(!shop.includes('provenance-panel'));
 assert.ok(!shop.includes('card-provenance'));
 assert.ok(shop.includes('CONDITION DETAILS.'));
 assert.ok(shop.includes('detail-product-link'));
 for(const p of ['public/index.html','public/storefront.html']){
   const html=read(p);
   assert.ok(!html.includes('provenance and condition uncertainties'),p);
   assert.ok(html.includes('src="product-links.js"'),p);
 }
 execFileSync(process.execPath,['--check',join(root,'public/store.js')]);
});
test('Automated marketing includes SEO product links, rotating calendar, safe feed and UTM attribution',()=>{
 const generated=read('public/product-links.js');
 const context={window:{}};
 runInNewContext(generated,context,{timeout:1500});
 const links=context.window.BURTON_PRODUCT_LINKS;
 assert.equal(Object.keys(links).length,131);
 assert.ok(links['CC-NEW-001'].startsWith('/products/'));
 assert.ok(links['OHS-003'].endsWith('.html'));
 assert.equal(new Set(Object.values(links)).size,131);
 const feed=JSON.parse(read('public/feeds/collectibles.json'));
 assert.equal(feed.version,'https://jsonfeed.org/version/1.1');
 assert.ok(feed.items.length>=100);
 assert.equal(new Set(feed.items.map(x=>x.id)).size,feed.items.length);
 assert.ok(feed.items.every(x=>x.image?.startsWith('https://')));
 for(const p of ['public/marketing-stock.js','scripts/build-marketing.mjs'])
    execFileSync(process.execPath,['--check',join(root,p)]);
 const csv=read('marketing-output/weekly-social-queue.csv');
 assert.equal(csv.trim().split('\n').length,15,'Header plus fourteen scheduled draft suggestions');
 assert.ok(csv.includes('utm_source=pinterest'),'Campaign attribution should be exportable');
 const track=read('marketing-output/marketing-utm-links.csv');
 assert.equal(track.trim().split('\n').length,132);
 assert.ok(track.includes('utm_source=facebook'));
 assert.ok(track.includes('utm_source=instagram'));
 const report=JSON.parse(read('marketing-output/marketing-readiness.json'));
 assert.equal(report.weeklyDraftItems.length,14);
 assert.equal(new Set(report.weeklyDraftItems).size,14);
 assert.ok(Number.isInteger(report.weeklyRotation));
 assert.equal(report.productPages,131);
 assert.equal(report.socialPostsPublished,false);
 assert.equal(report.newsletterSent,false);
 assert.equal(report.checkoutApproved,false);
 assert.equal(report.indexable,false);
});
test('Each product detail uses live stock progressive enhancement without promise of payment',()=>{
 const files=Object.values((()=>{const ctx={window:{}};runInNewContext(read('public/product-links.js'),ctx);return ctx.window.BURTON_PRODUCT_LINKS})());
 for(const u of files.slice(0,15)){
   const path='public'+u;
   assert.ok(existsSync(join(root,path)),u);
   const html=read(path);
   assert.ok(html.includes('data-bf-stock-sku'),u);
   assert.ok(html.includes('data-bf-availability'),u);
   assert.ok(html.includes('data-bf-price'),u);
   assert.ok(html.includes('data-bf-shop-link'),u);
   assert.ok(html.includes('src="/marketing-stock.js"'),u);
   assert.ok(html.includes('noindex,follow'),u);
   assert.ok(!html.includes('"@type":"Offer"'),u);
 }
 const stock=read('public/marketing-stock.js');
 assert.ok(stock.includes("fetch('/api/catalog'"));
 assert.ok(stock.includes("record.available"));
 assert.ok(!stock.includes('SUPABASE_SECRET_KEY'));
});
