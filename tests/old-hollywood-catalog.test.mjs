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


test('All 73 Old Hollywood scans and 11 editorial sets display as main shop cards without checkout access',()=>{
  const context={window:{}};
  const scripts=['public/old-hollywood-item-data.js','public/old-hollywood-sets-data.js','public/old-hollywood-market.js'];
  for(const filename of scripts){
    execFileSync(process.execPath,['--check',file(filename)]);
    runInNewContext(readFileSync(file(filename),'utf8'),context,{filename});
  }
  const api=context.window.BF_HOLLYWOOD_SHOP;
  assert.ok(api,'main shop preview adapter must load');
  assert.equal(api.stats.scans,73);
  assert.equal(api.stats.sets,11);
  assert.equal(api.stats.pricedScans,71);
  const all=api.renderCards({collection:'all',type:'all',decade:'all'});
  assert.equal(all.count,84);
  assert.equal(all.scans,73);
  assert.equal(all.sets,11);
  assert.equal((all.html.match(/data-preview-sku=/g)||[]).length,84);
  assert.equal((all.html.match(/data-preview-view=/g)||[]).length,168);
  assert.ok(all.html.includes('data-preview-sku="OH-NEW-001-01"'));
  assert.ok(all.html.includes('data-preview-sku="OH-NEW-009-02"'));
  assert.ok(all.html.includes('data-preview-sku="OH-NEW-003-05"'));
  assert.ok(all.html.includes('data-preview-sku="OH-NEW-007-08"'));
  assert.ok(all.html.includes('data-preview-sku="OHS-001"'));
  assert.ok(all.html.includes('data-preview-sku="OHS-011"'));
  assert.ok(all.html.includes('VIEW DETAILS'));
  assert.ok(!all.html.includes('data-add='),'draft previews must not offer add-to-bag');
  assert.ok(!all.html.includes('data-watch='),'draft previews must not impersonate sale-listing watch controls');
  assert.equal(api.renderCards({collection:'hollywood',type:'original',decade:'all'}).count,73);
  assert.equal(api.renderCards({collection:'hollywood',type:'bundle',decade:'all'}).count,11);
  assert.equal(api.renderCards({collection:'coca-cola',type:'all',decade:'all'}).count,0);
  assert.equal(api.renderCards({collection:'books',type:'all',decade:'all'}).count,0);
  assert.equal(api.renderCards({collection:'hollywood',type:'all',decade:'1930'}).count,0,'unverified pages must not receive invented print dates');
  assert.ok(api.renderCards({collection:'hollywood',type:'all',search:'Priscilla Lane'}).count>=3);
  const store=readFileSync(file('public/store.js'),'utf8');
  assert.ok(store.includes('window.BF_HOLLYWOOD_SHOP?.renderCards('));
  assert.ok(store.includes("}).join('')+hollywoodDrafts.html;"));
  assert.ok(store.includes('window.BF_HOLLYWOOD_SHOP?.openDetails('));
  assert.ok(!store.includes('bySku.set(preview'),'review scans must never be injected into checkout SKU map');
  for(const homepage of ['public/index.html','public/storefront.html']){
    const html=readFileSync(file(homepage),'utf8');
    const jsScripts=['old-hollywood-item-data.js','old-hollywood-sets-data.js','old-hollywood-market.js','store.js'];
    let previous=-1;
    for(const script of jsScripts){
      const current=html.indexOf('src="'+script+'"');
      assert.ok(current>previous,'script must load in data-first order: '+script+' in '+homepage);
      previous=current;
    }
    assert.ok(html.includes('old-hollywood-market.css'),homepage);
    assert.ok(html.includes('id="productGrid"'),homepage);
    assert.ok(html.includes('6 listings + 84 previews'),homepage);
  }
  const existing=JSON.parse(readFileSync(file('public/products.js'),'utf8').split('window.BURTON_DATA = ')[1].trim().replace(/;$/,''));
  assert.equal(existing.inventory.length,22,'existing purchasable inventory must stay unchanged');
});
