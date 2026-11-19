import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
const at=p=>join(process.cwd(),p);
const read=p=>readFileSync(at(p),'utf8');

test('root index is the real visitor homepage, with prominent accurate collection choices',()=>{
 const html=read('public/index.html');
 assert.ok(html.includes('<section aria-labelledby="marketTitle" class="market-hero collection-lead" id="top">'));
 assert.ok(html.includes('<h1 id="marketTitle">Find history'));
 assert.ok(html.includes('href="#shop">Browse the collection <span'));
 assert.ok(!html.includes('Browse 22 catalogue listings'),'homepage primary CTA must never show outdated item counts');
 assert.ok(!html.includes('Browse 104 catalogue listings'),'primary CTA has no catalogue number');
 const main=html.slice(html.indexOf('<section aria-labelledby="marketTitle"'),html.indexOf('</section>',html.indexOf('<section aria-labelledby="marketTitle"')));
 assert.equal((main.match(/class="spotlight spotlight-/g)||[]).length,4);
 for(const name of ['Coca-Cola','Old Hollywood','Curated sets','Vintage automobiles'])
  assert.ok(main.includes('<h2>'+name+'</h2>'),'missing category '+name);
 assert.ok(main.includes('data-shop-coke="" href="#shop"'));
 assert.ok(main.includes('data-shop-hollywood="" href="#shop"'));
 assert.ok(main.includes('data-shop-hollywood-sets="" href="#shop"'));
 assert.ok(main.includes('href="vintage-cars.html"'));
 assert.ok(main.includes('Archive viewing only'),'automobiles must remain distinguished from sale products');
 assert.ok(main.includes('Coming next'));
 assert.ok(main.includes('href="books.html"'));
 assert.ok(main.includes('href="collectibles.html"'));
 assert.ok(main.includes('Actual item photographs'));
 assert.ok(main.includes('Prices in CAD'));
 assert.ok(main.includes('Collector-focused details'));
 const imgPaths=[...main.matchAll(/<img[^>]*src="([^"]+)"/g)].map(x=>x[1]);
 assert.equal(imgPaths.length,4);
 for(const image of imgPaths)assert.ok(existsSync(at('public/'+image)),'category photo must exist: '+image);
});

test('homepage collection cards are fully touch-friendly, two across on mobile and accessible with dark mode',()=>{
 const css=read('public/homepage-collections.css');
 assert.ok(css.includes('.market-hero.collection-lead'));
 assert.ok(css.includes('grid-template-columns:repeat(4,minmax(0,1fr))'));
 assert.ok(css.includes('@media(max-width:590px)'));
 assert.ok(css.includes('height:142px!important'),'mobile category photos should leave room for category headings');
 assert.ok(css.includes('grid-template-columns:repeat(2,minmax(0,1fr))'));
 assert.ok(css.includes('.collection-lead .spotlight:focus-visible'));
 assert.ok(css.includes('html[data-theme="dark"]'));
 assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'));
 const html=read('public/index.html');
 assert.ok(html.includes('href="homepage-collections.css"'));
 assert.ok(html.indexOf('href="homepage-collections.css"')>html.indexOf('href="editorial-refresh.css"'),
   'homepage overrides must come after legacy styles');
 for(const image of [...html.slice(html.indexOf('class="spotlight-grid"'),html.indexOf('class="home-upcoming"')).matchAll(/<img\b[^>]+>/g)].map(x=>x[0])){
   assert.ok(image.includes('alt="'),'photo alt text required');
   assert.ok(image.includes('decoding="async"'));
 }
});

test('homepage links open correct shop collections without changing payments, pricing, or original SKU data',()=>{
 const js=read('public/store.js');
 assert.ok(js.includes("document.querySelectorAll('[data-shop-hollywood-sets]')"));
 assert.ok(js.includes("selectCollection('hollywood','bundle')"));
 assert.ok(js.includes("selectCollection('coca-cola')"));
 assert.ok(js.includes("selectCollection('hollywood')"));
 execFileSync(process.execPath,['--check',at('public/store.js')]);
 const storefront=read('public/storefront.html');
 assert.ok(storefront.includes('href="homepage-collections.css"'));
 assert.ok(storefront.includes('data-shop-hollywood-sets=""'));
 const vars=JSON.parse(read('wrangler.jsonc')).vars;
 for(const key of ['LIVE_CHECKOUT_ENABLED','LIVE_PAYMENTS_APPROVED','TAX_CONFIGURATION_APPROVED','CARRIER_QUOTES_ENABLED'])
   assert.equal(vars[key],'false',key+' must not be activated during homepage redesign');
 const base=JSON.parse(read('public/products.js').split('window.BURTON_DATA = ')[1].trim().replace(/;$/,''));
 assert.equal(base.inventory.length,22);
 const main=read('public/index.html');
 assert.ok(main.includes('Card checkout is currently unavailable'));
});
