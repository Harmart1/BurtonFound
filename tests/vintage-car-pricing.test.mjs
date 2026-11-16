import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const parse=path=>{const src=read(path);return JSON.parse(src.slice(src.indexOf('=')+1).trim().replace(/;\s*$/,''))};
test('All 93 vintage car scans have unique descriptions and researched CAD suggestions, never live sale prices',()=>{
 const cars=parse('public/vintage-cars-data.js');
 assert.equal(cars.length,93);
 assert.equal(new Set(cars.map(x=>x.sku)).size,93);
 const duplicates=new Map();
 for(const c of cars){
  assert.match(c.sku,/^VA-\d{3}$/);
  assert.equal(c.salesEnabled,false);
  assert.equal(c.physicalItemVerified,false);
  assert.equal(c.condition,'Not physically examined');
  assert.ok(!Object.hasOwn(c,'price'),'Unverified photo has a live sale price '+c.sku);
  assert.equal(typeof c.description,'string');
  assert.ok(c.description.length>155,'Description too short '+c.sku);
  assert.ok(c.description.includes('physical print')||c.description.includes('physical'),c.sku);
  assert.equal(typeof c.summary,'string');
  assert.ok(c.summary.length>70,c.sku);
  assert.ok(c.suggestedPriceCAD>=12.95&&c.suggestedPriceCAD<=34.95,'Outlying proposed price '+c.sku);
  assert.ok(Math.abs(c.suggestedPriceCAD*100-Math.round(c.suggestedPriceCAD*100))<.001);
  if(c.duplicateGroup){
   if(duplicates.has(c.duplicateGroup)) assert.equal(c.suggestedPriceCAD,duplicates.get(c.duplicateGroup),'Suspected duplicate pricing conflict '+c.sku);
   duplicates.set(c.duplicateGroup,c.suggestedPriceCAD);
  }
 }
 assert.equal(duplicates.size,13,'Expected 13 suspected duplicate groups');
});
test('All ten proposed sets use distinct recorded pages and an explicit discount without sale permissions',()=>{
 const cars=parse('public/vintage-cars-data.js'),bySku=new Map(cars.map(c=>[c.sku,c]));
 const sets=parse('public/vintage-cars-sets.js'),used=new Set();
 assert.equal(sets.length,10);
 assert.equal(new Set(sets.map(x=>x.sku)).size,10);
 for(const set of sets){
  assert.match(set.sku,/^BF-VA-SET\d{2}$/);
  assert.equal(set.salesEnabled,false);
  assert.equal(set.physicalItemsVerified,false);
  assert.ok(set.description.length>75,'Insufficient bundle description '+set.sku);
  assert.ok(set.curatorialRationale.length>40,'No bundle rationale '+set.sku);
  assert.equal(set.componentCount,set.componentSkus.length);
  assert.equal(set.previewImages.length,set.componentCount);
  assert.ok(set.componentCount>=2&&set.componentCount<=3);
  assert.ok(set.suggestedSetPriceCAD>=20&&set.suggestedSetPriceCAD<set.individualSuggestedTotalCAD);
  const members=set.componentSkus.map((sku,i)=>{
   assert.ok(bySku.has(sku),'Unknown item '+sku);
   assert.equal(set.previewImages[i],bySku.get(sku).image,'Image mismatch '+sku);
   assert.ok(!used.has(sku),'Repeat page used in multiple sets '+sku);
   used.add(sku);
   return bySku.get(sku);
  });
  const groups=members.map(x=>x.duplicateGroup).filter(Boolean);
  assert.equal(groups.length,new Set(groups).size,'Duplicate scans in same set '+set.sku);
  const sum=Math.round(members.reduce((n,x)=>n+x.suggestedPriceCAD,0)*100)/100;
  assert.equal(set.individualSuggestedTotalCAD,sum);
  assert.equal(set.potentialSavingsCAD,Math.round((sum-set.suggestedSetPriceCAD)*100)/100);
 }
 assert.equal(used.size,29);
});
test('Customer-facing page has bundle recommendations, pricing evidence and browse-only safeguards',()=>{
 const html=read('public/vintage-cars.html'),script=read('public/vintage-cars-refined.js');
 for(const term of ['vintage-cars-sets.js','vintage-cars-pricing.css','id="bundleGrid"','id="pricingMethod"','id="activeSetNote"','value="lowprice"','value="highprice"'])
  assert.ok(html.includes(term),'Missing '+term);
 assert.match(html,/not yet for sale/);
 assert.match(html,/noindex, nofollow/);
 assert.match(script,/suggestedPriceCAD/);
 assert.match(script,/renderCuratedSets/);
 assert.match(script,/archive-page-description/);
 assert.match(script,/Suggested asking price/);
 assert.ok(!script.includes('/api/checkout'),'Preview gallery must never submit a checkout');
 const result=spawnSync(process.execPath,['--check',new URL('../public/vintage-cars-refined.js',import.meta.url).pathname],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
});
test('Existing 22 sale listings and payment safety flags stay unchanged',()=>{
 const products=parse('public/products.js');
 assert.equal(products.inventory.length,22);
 assert.ok(products.inventory.every(x=>x.price>0&&x.shortDescription));
 assert.ok(!products.inventory.some(x=>x.sku.startsWith('VA-')||x.sku.startsWith('BF-VA-SET')));
 const wrangler=JSON.parse(read('wrangler.jsonc'));
 for(const flag of ['LIVE_CHECKOUT_ENABLED','LIVE_PAYMENTS_APPROVED','TAX_CONFIGURATION_APPROVED','CARRIER_QUOTES_ENABLED'])assert.equal(wrangler.vars[flag],'false');
 const css=read('public/vintage-cars-pricing.css');
 assert.match(css,/archive-bundle-card/);
 assert.match(css,/archive-page-price/);
 assert.match(css,/@media\(max-width:570px\)/);
});
