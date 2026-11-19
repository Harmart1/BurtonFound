import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
const file=p=>join(process.cwd(),p);
const parse=(path,marker)=>{
 const s=readFileSync(file(path),'utf8');
 return JSON.parse(s.split(marker)[1].trim().replace(/;$/,''));
};

test('73 Hollywood scans resolve to 71 individually priced listings and 2 supplementary photographs',()=>{
 const scans=parse('public/old-hollywood-item-data.js','window.BURTON_NEW_HOLLYWOOD_ITEMS = ');
 assert.equal(scans.length,73);
 assert.equal(new Set(scans.map(x=>x.sku)).size,73);
 assert.equal(new Set(scans.map(x=>x.sourceGroup)).size,9);
 assert.equal(scans.filter(x=>x.priceStatus==='asking_price').length,71);
 assert.equal(scans.filter(x=>x.suggestedPriceCad===null).length,2);
 for(const s of scans){
   assert.ok(s.title.length>10,s.sku);
   assert.ok(s.description.length>45,s.sku);
   assert.match(s.image,/^assets[/]images[/]old-hollywood[/]ohnew-\d{3}-\d{2}[.]webp$/);
   assert.ok(existsSync(file('public/'+s.image)),s.sku);
   if(s.suggestedPriceCad!=null){
     assert.equal(s.inventoryStatus,'listed',s.sku);
     assert.ok(s.suggestedPriceCad>=14&&s.suggestedPriceCad<=35,s.sku);
   }
 }
 for(const id of ['OH-NEW-003-05','OH-NEW-007-08']){
   const alternate=scans.find(x=>x.sku===id);
   assert.equal(alternate.suggestedPriceCad,null);
   assert.equal(alternate.priceStatus,'supplemental_image');
 }
 for(const name of ['public/old-hollywood-item-data.js','public/old-hollywood-intake.js'])
   execFileSync(process.execPath,['--check',file(name)]);
});

test('11 curated sets have unique memberships and accurate prices',()=>{
 const source=parse('public/old-hollywood-sets-data.js','window.BURTON_HOLLYWOOD_CURATED_SETS = ');
 const scans=parse('public/old-hollywood-item-data.js','window.BURTON_NEW_HOLLYWOOD_ITEMS = ');
 const map=new Map(scans.map(p=>[p.sku,p]));
 assert.equal(source.sets.length,11);
 assert.equal(source.inventoryStatus,'listed');
 const seen=new Set();
 for(const set of source.sets){
   assert.equal(set.status,'listed',set.id);
   assert.equal(set.currency,'CAD');
   assert.ok(set.description.length>80,set.id);
   assert.ok(set.memberSkus.length>=4,set.id);
   assert.equal(set.memberSkus.length,set.itemsCount,set.id);
   assert.ok(set.proposedSetPriceCad>0,set.id);
   assert.ok(set.proposedSetPriceCad<set.individualDraftTotalCad,set.id);
   assert.ok(set.previewImages.every(src=>existsSync(file('public/'+src))),set.id);
   let sum=0;
   for(const sku of set.memberSkus){
     assert.ok(!seen.has(sku),'One scan assigned to two sets: '+sku);
     seen.add(sku);
     const item=map.get(sku);
     assert.ok(item&&item.suggestedPriceCad>0,sku);
     sum+=item.suggestedPriceCad;
   }
   assert.ok(Math.abs(sum-set.individualDraftTotalCad)<0.03,set.id);
 }
 assert.equal(seen.size,58);
 for(const name of ['public/old-hollywood-sets-data.js','public/old-hollywood-sets.js'])
   execFileSync(process.execPath,['--check',file(name)]);
 const page=readFileSync(file('public/old-hollywood-new.html'),'utf8');
 for(const id of ['id="sets"','id="setsGrid"','id="cards"','old-hollywood-sets.js','old-hollywood-intake.js'])
   assert.ok(page.includes(id));
 assert.ok(!page.includes('Preview collection · not currently for sale'));
});

test('82 new Old Hollywood products integrate with existing 22 shop items and 2 alt views do not create stock',()=>{
 const context={window:{},console:{warn:()=>{},error:()=>{}}};
 for(const name of ['public/products.js','public/old-hollywood-item-data.js','public/old-hollywood-sets-data.js','public/old-hollywood-products.js']){
   execFileSync(process.execPath,['--check',file(name)]);
   runInNewContext(readFileSync(file(name),'utf8'),context,{filename:name});
 }
 const inventory=context.window.BURTON_DATA.inventory;
 const bySku=new Map(inventory.map(x=>[x.sku,x]));
 assert.equal(inventory.length,104);
 assert.equal(bySku.size,104);
 const hollywood=inventory.filter(x=>x.collection==='hollywood');
 assert.equal(hollywood.length,88);
 const newer=inventory.filter(x=>x.sku.startsWith('OH-NEW-')||x.sku.startsWith('OHS-'));
 assert.equal(newer.length,82);
 assert.equal(newer.filter(x=>x.type==='original').length,71);
 assert.equal(newer.filter(x=>x.type==='bundle').length,11);
 assert.equal(newer.some(x=>x.sku==='OH-NEW-003-05'),false);
 assert.equal(newer.some(x=>x.sku==='OH-NEW-007-08'),false);
 for(const p of newer){
   assert.equal(p.status,'available',p.sku);
   assert.equal(p.stockState,'available',p.sku);
   assert.equal(p.quantity,1,p.sku);
   assert.equal(p.availableForCheckout,true,p.sku);
   assert.ok(!p.cmsOnly,p.sku);
   assert.ok(p.price>0,p.sku);
   assert.ok(p.title.length>10,p.sku);
   assert.ok(p.shortDescription.length>40,p.sku);
   assert.ok(existsSync(file('public/'+p.image)),p.image);
   assert.ok(p.images.every(image=>existsSync(file('public/'+image))),p.sku);
   assert.ok(p.authenticityNote.length>60,p.sku);
 }
 assert.equal(bySku.get('OH-NEW-003-04').images.length,2);
 assert.equal(bySku.get('OH-NEW-007-07').images.length,2);
 assert.equal(bySku.get('OHS-001').catalogIds.length,6);
 assert.equal(bySku.get('OHS-001').images.length,5);
 assert.equal(bySku.get('OH-NEW-001-01').price,24.95);
 assert.equal(bySku.get('OHS-001').price,149.95);
 assert.equal(bySku.get('OHS-011').price,130.95);
 assert.equal(context.window.BURTON_HOLLYWOOD_INTEGRATION.listedProducts,82);
 const original=parse('public/products.js','window.BURTON_DATA = ');
 assert.equal(original.inventory.length,22,'Original shop product data stays unchanged.');
});

test('Standard shop cards, watchlists, carts and detail galleries support all listed products',()=>{
 const store=readFileSync(file('public/store.js'),'utf8');
 const account=readFileSync(file('public/account-core.js'),'utf8');
 assert.ok(store.includes("$('productGrid').innerHTML=list.map(p=>{"));
 assert.ok(store.includes("if(bySku.get(sku)?.cmsOnly)"),'Other CMS unpublished products still excluded from shopping');
 assert.ok(store.includes("const p=bySku.get(sku)"),'Native SKU details used');
 assert.ok(store.includes("p.memberDetails"),'Curated set contents use standard detail panel');
 assert.ok(store.includes("checkoutReady=false"),'Global payment capability remains gated');
 assert.ok(!store.includes('hollywoodDrafts'), 'No separate draft previews in shop');
 assert.ok(account.includes("new Set(items.map(p=>p.sku))"),'Watchlist accepts the new product SKUs');
 for(const p of ['public/index.html','public/storefront.html','public/account.html']){
   const h=readFileSync(file(p),'utf8');let previous=-1;
   for(const name of ['products.js','old-hollywood-item-data.js','old-hollywood-sets-data.js','old-hollywood-products.js','account-core.js']){
     const at=h.indexOf('src="'+name+'"');
     assert.ok(at>previous,'Load ordering: '+name+' in '+p);
     previous=at;
   }
   if(!p.endsWith('account.html')){
     assert.ok(h.includes('108 product listings'),p);
     assert.ok(h.includes('old-hollywood-product-native.css'),p);
     assert.ok(h.includes('id="productGrid"'),p);
   }
 }
 for(const name of ['public/store.js','public/account-core.js'])
   execFileSync(process.execPath,['--check',file(name)]);
});
