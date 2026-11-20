import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {runInNewContext} from 'node:vm';
import {execFileSync} from 'node:child_process';

const root=process.cwd(),read=p=>readFileSync(join(root,p),'utf8');
const ctx={window:{},console,Intl};
const files=['products.js','old-hollywood-item-data.js','old-hollywood-sets-data.js',
 'old-hollywood-products.js','coke-new-products.js','coke-archive-singles.js',
 'vintage-cars-data.js','vintage-cars-sets.js','vintage-cars-products.js'];
for(const f of files)runInNewContext(read('public/'+f),ctx,{filename:f,timeout:2500});
const originals=ctx.window.BURTON_VINTAGE_CARS;
const sets=ctx.window.BURTON_VINTAGE_SETS;
const all=ctx.window.BURTON_DATA.inventory;
const cars=all.filter(p=>p.collection==='automobiles');

test('Automobile integration lists all 80 unique photographed designs plus 18 proposed priced sets',()=>{
 assert.equal(originals.length,80);
 assert.equal(sets.length,18);
 assert.equal(cars.length,98);
 assert.equal(all.length,229);
 assert.equal(new Set(all.map(p=>p.sku)).size,229);
 assert.equal(cars.filter(p=>p.type==='original').length,80);
 assert.equal(cars.filter(p=>p.type==='bundle').length,18);
 assert.equal(ctx.window.BURTON_AUTOMOBILE_INTEGRATION.checkoutEligible,0);
 for(const p of cars){
  assert.ok(Number.isFinite(p.price)&&p.price>0,'Indicative CAD price '+p.sku);
  assert.ok(p.title&&p.shortDescription&&p.image,'Title, description and image '+p.sku);
  assert.ok(existsSync(join(root,'public',p.image)),'Photographed asset '+p.sku);
  assert.equal(p.requiresVerification,true,'Physical verification must remain visible');
  assert.equal(p.availableForCheckout,false,'No unverified car print may be sent to Stripe');
  assert.equal(p.stockState,'verification_required');
  assert.equal(p.priceStatus,'indicative');
  assert.notEqual(p.cmsOnly,true,'Item can be added to enquiry bag');
  assert.ok(Array.isArray(p.catalogIds)&&p.catalogIds.length);
 }
});
test('Curated automobile sets point to unique individual paper design IDs without duplicating units',()=>{
 const bySku=new Map(cars.map(p=>[p.sku,p]));
 for(const p of cars.filter(x=>x.type==='bundle')){
  assert.ok(p.catalogIds.length>=2,p.sku);
  assert.equal(new Set(p.catalogIds).size,p.catalogIds.length);
  assert.equal(p.catalogIds.length,p.memberDetails.length);
  assert.ok(p.catalogIds.every(id=>bySku.get(id)?.type==='original'),'Members refer to single pages');
  assert.equal(p.images.length,p.catalogIds.length-1,'Each member has a thumbnail');
  assert.ok(p.price<p.catalogIds.reduce((n,id)=>n+bySku.get(id).price,0),'Proposed set price below separate indicative prices');
 }
});
test('Automobile collection is a visible shop filter with actual Add to Bag and details navigation',()=>{
 for(const page of ['index','storefront']){
  const html=read('public/'+page+'.html');
  assert.match(html,/value="automobiles">Vintage automobile advertising/);
  assert.match(html,/data-collection-select="automobiles"/);
  assert.match(html,/data-shop-automobiles/);
  assert.match(html,/src="vintage-cars-data\.js"/);
  assert.match(html,/src="vintage-cars-sets\.js"/);
  assert.match(html,/src="vintage-cars-products\.js"/);
  assert.doesNotMatch(html,/MOTORING ARCHIVE · COMING SOON/);
 }
 const main=read('public/store.js');
 assert.match(main,/requested\)/);
 assert.match(main,/params\.get\('add'\)/);
 assert.match(main,/selectCollection\('automobiles'\)/);
 assert.match(main,/function addItem\(sku\)/);
 assert.match(main,/bag\.push\(sku\)/);
 assert.match(main,/bagNeedsVerification\(\)/);
 assert.match(main,/if\(checkoutReady&&!bagNeedsVerification\(\)\)/);
 assert.match(main,/physical inventory|physical stock|Physical stock/i);
 const archive=read('public/vintage-cars-refined.js');
 assert.match(archive,/index\.html\?add=/);
 assert.match(archive,/index\.html\?item=/);
 assert.match(archive,/Add to bag for enquiry/);
 assert.match(archive,/Add set to bag for enquiry/);
 assert.match(read('public/vintage-cars.html'),/Enquiry bag now available|enquiry bag now available/);
 assert.match(read('public/vintage-cars.html'),/src="vintage-cars-refined\.js"/);
 assert.match(read('public/vintage-cars.html'),/vintage-cars-shop\.css/);
});
test('Accounts support the same SKUs and existing checkout/indexing safeguards remain off',()=>{
 for(const page of ['account','preview'])assert.match(read('public/'+page+'.html'),/src="vintage-cars-products\.js"/);
 const vars=JSON.parse(read('wrangler.jsonc')).vars;
 for(const flag of ['LIVE_CHECKOUT_ENABLED','LIVE_PAYMENTS_APPROVED','TAX_CONFIGURATION_APPROVED','CARRIER_QUOTES_ENABLED','MARKETING_INDEXING_APPROVED'])
  assert.equal(vars[flag],'false',flag+' must stay off');
 for(const file of [...files.slice(-3),'store.js','vintage-cars-refined.js','storefront-first.js']){
  execFileSync(process.execPath,['--check',join(root,'public',file)]);
 }
});
