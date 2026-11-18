import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
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


test('Eleven curated Hollywood sets use 58 unique real scans and draft-only bundle pricing',()=>{
  const src=readFileSync(file('public/old-hollywood-sets-data.js'),'utf8');
  const raw=src.split('window.BURTON_HOLLYWOOD_CURATED_SETS = ')[1]?.trim().replace(/;$/,'');
  assert.ok(raw,'missing curated set file');
  const data=JSON.parse(raw);
  assert.equal(data.currency,'CAD');
  assert.equal(data.checkoutEnabled,false);
  assert.equal(data.inventoryStatus,'unverified');
  assert.equal(data.sets.length,11);
  const singlesRaw=readFileSync(file('public/old-hollywood-item-data.js'),'utf8')
    .split('window.BURTON_NEW_HOLLYWOOD_ITEMS = ')[1].trim().replace(/;$/,'');
  const singles=JSON.parse(singlesRaw);
  const bySku=new Map(singles.map(x=>[x.sku,x]));
  const seen=new Set();
  for(const set of data.sets){
    assert.match(set.id,/^OHS-\d{3}$/);
    assert.ok(set.title.length>14,set.id);
    assert.ok(set.description.length>90,set.id);
    assert.ok(set.memberSkus.length>=4&&set.memberSkus.length<=6,set.id);
    assert.equal(set.status,'editorial-preview-not-for-sale',set.id);
    assert.equal(set.inventoryVerified,false,set.id);
    assert.ok(set.proposedSetPriceCad>0&&set.proposedSetPriceCad<set.individualDraftTotalCad,set.id);
    assert.ok(set.indicativeDiscountPercent>=10&&set.indicativeDiscountPercent<=17,set.id);
    const sum=set.memberSkus.reduce((total,sku)=>{
      assert.ok(!seen.has(sku),'scan reused across set proposals: '+sku);
      seen.add(sku);
      const item=bySku.get(sku);
      assert.ok(item,'unknown source SKU: '+sku);
      assert.ok(typeof item.suggestedPriceCad==='number','unpriced member: '+sku);
      assert.ok(existsSync(file('public/'+item.image)),item.image);
      return total+item.suggestedPriceCad;
    },0);
    assert.ok(Math.abs(sum-set.individualDraftTotalCad)<0.02,'incorrect sum '+set.id);
    assert.equal(set.itemsCount,set.memberSkus.length,set.id);
    assert.ok(set.previewImages.every(im=>existsSync(file('public/'+im))),set.id);
  }
  assert.equal(seen.size,58);
  assert.ok(!seen.has('OH-NEW-003-05'));
  assert.ok(!seen.has('OH-NEW-007-08'));
  assert.equal(singles.filter(x=>!seen.has(x.sku)).length,15);
  const page=readFileSync(file('public/old-hollywood-new.html'),'utf8');
  for(const required of ['id="sets"','id="setsGrid"','id="setCategory"',
     'old-hollywood-sets-data.js','old-hollywood-sets.js','old-hollywood-sets.css','id="individual-finds"'])
    assert.ok(page.includes(required),'missing gallery feature '+required);
  for(const path of ['public/index.html','public/storefront.html']){
    const homepage=readFileSync(file(path),'utf8');
    assert.ok(homepage.includes('id="hollywood-curated-sets"'),path);
    assert.ok(homepage.includes('old-hollywood-sets-promo.css'),path);
    assert.ok(homepage.includes('old-hollywood-new.html?set=leading-ladies'),path);
    assert.ok(homepage.includes('old-hollywood-new.html?set=drama-film-ads'),path);
  }
  for(const p of ['public/old-hollywood-sets-data.js','public/old-hollywood-sets.js'])
    execFileSync(process.execPath,['--check',file(p)]);
});


test('All 73 Hollywood scans and 11 sets become standard product cards and watchable catalog SKUs, never purchasable stock',()=>{
 const context={window:{},console:{warn:()=>{}}};
 const scripts=[
   'public/products.js',
   'public/old-hollywood-item-data.js',
   'public/old-hollywood-sets-data.js',
   'public/old-hollywood-products.js'
 ];
 for(const path of scripts){
   execFileSync(process.execPath,['--check',file(path)]);
   runInNewContext(readFileSync(file(path),'utf8'),context,{filename:path});
 }
 const stock=context.window.BURTON_DATA.inventory;
 assert.equal(stock.length,106,'22 original shop products plus 84 Hollywood product entries');
 const bySku=new Map(stock.map(p=>[p.sku,p]));
 assert.equal(bySku.size,106,'product SKUs must be unique');
 const drafts=stock.filter(p=>p.cmsOnly&&p.collection==='hollywood');
 assert.equal(drafts.length,84);
 assert.equal(drafts.filter(p=>p.type==='original').length,73);
 assert.equal(drafts.filter(p=>p.type==='bundle').length,11);
 assert.equal(drafts.filter(p=>p.draftDuplicate).length,2);
 assert.equal(drafts.filter(p=>!p.draftDuplicate&&p.price>0).length,82);
 assert.equal(drafts.filter(p=>p.availableForCheckout!==false).length,0);
 for(const p of drafts){
   assert.equal(p.stockState,'unavailable',p.sku);
   assert.equal(p.status,'preview',p.sku);
   assert.equal(p.quantity,0,p.sku);
   assert.equal(p.collection,'hollywood',p.sku);
   assert.ok(p.title.length>10,p.sku);
   assert.ok(p.shortDescription.length>45,p.sku);
   assert.ok(p.image.endsWith('.webp'),p.sku);
   assert.ok(existsSync(file('public/'+p.image)),p.image);
   assert.ok(Array.isArray(p.images),p.sku);
   assert.ok(Array.isArray(p.catalogIds),p.sku);
   assert.equal(p.authenticityNote.length>40,true,p.sku);
   if(p.type==='bundle'){
     assert.equal(p.catalogIds.length,p.images.length+1,p.sku);
     assert.equal(p.draftMemberDetails.length,p.catalogIds.length,p.sku);
   }
 }
 assert.equal(bySku.get('OH-NEW-001-01').price,24.95);
 assert.equal(bySku.get('OH-NEW-009-02').price,30.95);
 assert.equal(bySku.get('OH-NEW-003-05').price,0);
 assert.equal(bySku.get('OH-NEW-007-08').price,0);
 assert.equal(bySku.get('OHS-001').price,149.95);
 assert.equal(bySku.get('OHS-011').price,130.95);
 assert.equal(context.window.BURTON_HOLLYWOOD_INTEGRATION.checkoutApproved,false);
 assert.equal(context.window.BURTON_HOLLYWOOD_INTEGRATION.publishedRecords,84);

 const store=readFileSync(file('public/store.js'),'utf8');
 assert.ok(store.includes("$('productGrid').innerHTML=list.map(p=>{"),'standard product-card rendering used');
 assert.ok(store.includes("const p=bySku.get(sku)"),'standard product details available for new SKUs');
 assert.ok(store.includes("p.cmsOnly||bag.includes(p.sku)||p.stockState==='unavailable'"),'unverified cards disabled for cart');
 assert.ok(store.includes("if(bySku.get(sku)?.cmsOnly)"),'manual add attempt guarded');
 assert.ok(store.includes("filter(id=>bySku.has(id)&&!bySku.get(id)?.cmsOnly)"),'restored bags filtered');
 assert.ok(!store.includes("window.BF_HOLLYWOOD_SHOP?.renderCards"),'no separate preview card renderer');

 const account=readFileSync(file('public/account-core.js'),'utf8');
 assert.ok(account.includes('sanitizeBagSkus'),'watchlist and saleable bags must be separate');
 assert.ok(account.includes('!p.cmsOnly'),'unverified stock cannot enter account saved bags');
 for(const home of ['public/index.html','public/storefront.html','public/account.html']){
   const html=readFileSync(file(home),'utf8');
   let prior=-1;
   for(const script of ['products.js','old-hollywood-item-data.js','old-hollywood-sets-data.js','old-hollywood-products.js','account-core.js']){
     const at=html.indexOf('src="'+script+'"');
     assert.ok(at>prior,'scripts load in product-data-first order: '+script+' in '+home);
     prior=at;
   }
 }
 for(const home of ['public/index.html','public/storefront.html']){
   const html=readFileSync(file(home),'utf8');
   assert.ok(html.includes('old-hollywood-product-native.css'),home);
   assert.ok(html.includes('id="productGrid"'),home);
   assert.ok(html.includes('6 listings + 84 previews'),home);
 }
 // Source of truth for actual checkout remains unchanged; no draft item is inserted there.
 const original=JSON.parse(readFileSync(file('public/products.js'),'utf8')
   .split('window.BURTON_DATA = ')[1].trim().replace(/;$/,''));
 assert.equal(original.inventory.length,22);
});
