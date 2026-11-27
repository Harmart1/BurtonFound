import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const v={window:{},console};
for(const file of [
 'products.js','old-hollywood-item-data.js','old-hollywood-sets-data.js',
 'old-hollywood-products.js','coke-new-products.js','coke-archive-singles.js',
 'vintage-cars-data.js','vintage-cars-sets.js','vintage-cars-products.js'
])runInNewContext(read('public/'+file),v,{filename:file});
const vehicles=v.window.BURTON_DATA.inventory.filter(p=>p.collection==='automobiles');
const raw=new Map(v.window.BURTON_VINTAGE_CARS.map(p=>[p.sku,p]));
const sets=new Map(v.window.BURTON_VINTAGE_SETS.map(p=>[p.sku,p]));

test('Research-backed prices are posted as real CAD asking prices for all 98 vehicles/sets',()=>{
 assert.equal(vehicles.length,98);
 for(const p of vehicles){
   assert.equal(p.priceStatus,'asking_price',p.sku);
   assert.ok(p.price>0&&Number.isFinite(p.price),p.sku);
   assert.equal(p.price, p.type==='bundle'?sets.get(p.sku).suggestedSetPriceCAD:raw.get(p.sku).suggestedPriceCAD,p.sku);
   assert.match(p.priceQualifier,/CAD/);
   assert.doesNotMatch(p.priceQualifier,/indicative|suggested|verify/i);
   assert.ok(p.shortDescription.length>45,p.sku);
 }
});
test('Publication changes only customer messaging: unresolved automobile units remain excluded from payment',()=>{
 for(const p of vehicles){
   assert.equal(p.availableForCheckout,false,p.sku);
   assert.equal(p.requiresVerification,true,p.sku);
   assert.equal(p.stockState,'verification_required',p.sku);
   assert.equal(p.quantity,0,p.sku);
 }
 const store=read('public/store.js');
 assert.match(store,/const bagNeedsVerification=/);
 assert.match(store,/if\(checkoutReady&&!bagNeedsVerification\(\)\)/);
 assert.match(store,/if\(!p\|\|p\.cmsOnly\|\|needsVerification\(p\)\)continue/);
 const flags=JSON.parse(read('wrangler.jsonc')).vars;
 for(const key of ['LIVE_CHECKOUT_ENABLED','LIVE_PAYMENTS_APPROVED','TAX_CONFIGURATION_APPROVED','CARRIER_QUOTES_ENABLED'])
   assert.equal(flags[key],'false',key);
});
test('Automobile storefront, gallery and preview remove price/status warnings but retain accurate prices and Add to Bag',()=>{
 const gallery=read('public/vintage-cars.html');
 assert.doesNotMatch(gallery,/indicative|suggested asking|stock confirmation|stock to verify|stock must|physical stock/i);
 assert.match(gallery,/CAD asking prices|CAD price/);
 assert.match(gallery,/Online card checkout is not enabled/);
 const rendered=read('public/vintage-cars-refined.js');
 for(const phrase of ['Indicative price','Suggested asking price','Stock to verify','physical pages and final availability'])
   assert.ok(!rendered.includes(phrase),phrase);
 assert.match(rendered,/Add to bag ↗/);
 assert.match(rendered,/Add set to bag ↗/);
 assert.match(rendered,/Price · CAD/);
 for(const path of ['public/index.html','public/storefront.html']){
  const html=read(path);
  assert.doesNotMatch(html,/Automobile print stock requires confirmation|indicative CAD prices|physical collection is being verified/i);
  assert.match(html,/value="automobiles"/);
 }
 const preview=read('public/preview-launch.js');
 assert.doesNotMatch(preview,/Indicative |VERIFY STOCK|stock must be confirmed|stock unverified/i);
 assert.match(preview,/Automobile advertisements display CAD asking prices/);
 const store=read('public/store.js');
 for(const phrase of ['INDICATIVE PRICE · VERIFY STOCK','VINTAGE AUTOMOBILE · VERIFY STOCK','Physical stock to verify · enquiry only','INDICATIVE CAD · CONFIRM BEFORE PURCHASE'])
  assert.ok(!store.includes(phrase),phrase);
 assert.match(store,/CAD · ASKING PRICE/);
 assert.match(store,/b\.innerHTML='Prepare purchase enquiry'/);assert.match(store,/BURTON_ENQUIRY\?\.open\(selection,C\.sellerEmail\)/);
 assert.doesNotMatch(read('public/preview.html'),/indicative automobile entries|physical stock and final prices require confirmation/i);
});
