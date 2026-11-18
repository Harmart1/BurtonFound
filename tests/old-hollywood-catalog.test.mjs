import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
const root=process.cwd();
const file=p=>join(root,p);

test('Old Hollywood gallery presents 73 scanned previews with 71 proposed prices and no checkout',()=>{
 const source=readFileSync(file('public/old-hollywood-item-data.js'),'utf8');
 const raw=source.split('window.BURTON_NEW_HOLLYWOOD_ITEMS = ')[1]?.trim().replace(/;$/,'');
 assert.ok(raw,'missing active gallery data');
 const entries=JSON.parse(raw);
 assert.equal(entries.length,73);
 assert.equal(new Set(entries.map(x=>x.sku)).size,73);
 assert.equal(new Set(entries.map(x=>x.sourceGroup)).size,9);
 assert.equal(entries.filter(x=>x.suggestedPriceCad==null).length,2);
 for(const x of entries){
  assert.ok(x.title.length>10,x.sku);
  assert.ok(x.description.length>45,x.sku);
  assert.equal(x.inventoryStatus,'unverified',x.sku);
  assert.match(x.image, /^assets[/]images[/]old-hollywood[/]ohnew-[0-9]{3}-[0-9]{2}[.]webp$/, x.sku);
  assert.ok(existsSync(file('public/'+x.image)),x.image);
  if(x.suggestedPriceCad!=null){
   assert.ok(x.suggestedPriceCad>=14&&x.suggestedPriceCad<=35,x.sku);
   assert.equal(x.priceStatus,'recommended_only',x.sku);
  }
 }
 assert.equal(entries.find(x=>x.sku==='OH-NEW-003-05').suggestedPriceCad,null);
 assert.equal(entries.find(x=>x.sku==='OH-NEW-007-08').suggestedPriceCad,null);

 const catalogSource=readFileSync(file('public/old-hollywood-catalog.js'),'utf8');
 const catRaw=catalogSource.split('window.BURTON_HOLLYWOOD_DRAFT_CATALOG = ')[1]?.trim().replace(/;$/,'');
 assert.ok(catRaw,'missing archival inventory review file');
 const catalog=JSON.parse(catRaw);
 assert.equal(catalog.currency,'CAD');
 assert.equal(catalog.groups.length,9);
 assert.equal(catalog.entries.length,entries.length);
 const byId=new Map(catalog.entries.map(x=>[x.id,x]));
 for(const x of entries){
  const y=byId.get(x.sku.replace('OH-NEW-','OHN-'));
  assert.ok(y,'missing catalogue entry '+x.sku);
  assert.equal(y.title,x.title,'title mismatch '+x.sku);
  assert.equal(y.description,x.description,'description mismatch '+x.sku);
  assert.equal(y.suggestedCad,x.suggestedPriceCad??null,'price mismatch '+x.sku);
  assert.equal(y.availableForCheckout,false,'must remain browse-only '+x.sku);
 }
 const html=readFileSync(file('public/old-hollywood-new.html'),'utf8');
 assert.ok(html.includes('old-hollywood-item-data.js'));
 assert.ok(html.includes('old-hollywood-intake.js'));
 assert.ok(html.includes('id="cards"'));
 for(const p of ['public/old-hollywood-catalog.js','public/old-hollywood-item-data.js','public/old-hollywood-intake.js'])execFileSync(process.execPath,['--check',file(p)]);
 const productSource=readFileSync(file('public/products.js'),'utf8');
 const live=JSON.parse(productSource.slice(productSource.indexOf('=')+1).trim().replace(/;$/,''));
 assert.equal(live.inventory.length,22,'22 original purchasable products should not change');
});
