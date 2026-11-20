import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync,readdirSync,statSync} from 'node:fs';
import {join} from 'node:path';
const root=process.cwd(),pub=join(root,'public'),out=join(root,'marketing-output');
const read=p=>readFileSync(join(root,p),'utf8');
const names=()=>readdirSync(join(pub,'products')).filter(x=>x.endsWith('.html'));
test('marketing build creates real unique product URLs and SEO metadata without premature purchase offers',()=>{
 const items=names();
 assert.equal(items.length,131,'one static page per unique listed SKU');
 assert.equal(new Set(items).size,131);
 for(const file of items){
   const html=read('public/products/'+file);
   assert.ok(html.includes('<link rel="canonical" href="https://burtonfound.timharmar.workers.dev/products/'),file);
   assert.ok(html.includes('name="description"'),file);
   assert.ok(html.includes('property="og:image"'),file);
   assert.ok(html.includes('https://schema.org'),file);
   assert.ok(html.includes('"@type":"Product"'),file);
   assert.ok(html.includes('View in the shop / add to bag'),file);
   assert.ok(html.includes('name="robots" content="noindex,follow"'),file);
   assert.ok(!html.includes('"@type":"Offer"'),'Offers must be held back until owner checkout approval');
 }
 const example=items.find(x=>x.includes('cc-new-001'));
 assert.ok(example,'Unique Brussels World Fair page');
 assert.ok(read('public/products/'+example).includes('Brussels'));
});
test('human-readable category pages and collector guides are generated and linked to real product pages',()=>{
 const cats=['coca-cola','hollywood','sets'];
 for(const c of cats){
  const path='public/collections/'+c+'.html';
  assert.ok(existsSync(join(root,path)),path);
  const html=read(path);
  assert.ok(html.includes('mk-grid'),path);
  assert.ok(html.includes('/products/'),path);
  assert.ok(html.includes('name="description"'),path);
  assert.ok(html.includes('noindex,follow'),path);
 }
 const guide=['collecting-vintage-ads','caring-for-vintage-paper','old-hollywood-printed-paper'];
 for(const g of guide){
  const path='public/guides/'+g+'.html';
  assert.ok(existsSync(join(root,path)),path);
  const html=read(path);
  assert.ok(html.includes('"@type":"Article"'),path);
  assert.ok(html.includes('Collector guides'),path);
  assert.ok(html.includes('<h2>'),path);
  assert.ok(html.includes('noindex,follow'),path);
 }
});
test('sitemap is complete but public indexing remains disabled pending approval',()=>{
 const sitemap=read('public/sitemap.xml');
 const entries=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(x=>x[1]);
 assert.equal(entries.length,139,'Home, 131 products, 3 collections, 3 guides, 1 gift landing page');
 assert.equal(new Set(entries).size,entries.length);
 for(const url of entries)assert.ok(url.startsWith('https://burtonfound.timharmar.workers.dev/'),url);
 assert.ok(sitemap.includes('/products/'));
 const robots=read('public/robots.txt');
 assert.ok(robots.includes('Sitemap: https://burtonfound.timharmar.workers.dev/sitemap.xml'));
 assert.ok(robots.includes('Disallow: /api/'));
 assert.ok(robots.includes('Disallow: /account.html'));
 assert.ok(read('public/index.html').includes('name="robots"'));
 const cfg=JSON.parse(read('wrangler.jsonc'));
 assert.equal(cfg.vars.MARKETING_INDEXING_APPROVED,'false');
 assert.equal(cfg.vars.LIVE_CHECKOUT_ENABLED,'false');
});
test('automated marketing kit contains reusable product links and accurately discloses that nothing was published or sent',()=>{
 const csv=read('marketing-output/pinterest-and-social-catalog.csv');
 assert.equal(csv.trim().split('\n').length,132,'header + 131 products');
 assert.ok(csv.includes('CC-NEW-001'));
 assert.ok(csv.includes('OH-NEW-003-01'));
 assert.ok(csv.includes('product_url'));
 const calendar=read('marketing-output/14-day-social-calendar.md');
 assert.equal((calendar.match(/### Day /g)||[]).length,14);
 const email=read('marketing-output/collector-newsletter-draft.md');
 assert.ok(email.includes('DRAFT, not a sent email'));
 assert.ok(email.includes('consent'));
 const state=JSON.parse(read('marketing-output/marketing-readiness.json'));
 assert.equal(state.productPages,131);
 assert.equal(state.indexable,false);
 assert.equal(state.checkoutApproved,false);
 assert.equal(state.merchantFeedCreated,false);
 assert.equal(state.newsletterSent,false);
 assert.equal(state.socialPostsPublished,false);
 assert.ok(!existsSync(join(pub,'merchant-feed.xml')),'No Merchant Center feed while checkout disabled');
});
