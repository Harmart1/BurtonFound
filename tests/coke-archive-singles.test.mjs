import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {runInNewContext} from 'node:vm';
import {execFileSync} from 'node:child_process';
const root=process.cwd();
const at=p=>join(root,p);
const read=p=>readFileSync(at(p),'utf8');
const scripts=[
 'products.js','old-hollywood-item-data.js','old-hollywood-sets-data.js',
 'old-hollywood-products.js','coke-new-products.js','coke-archive-singles.js',
 'featured-merchandising.js'
];
function getCatalog(){
 const context={window:{},console:{warn(){},error(){}},Intl};
 for(const p of scripts)runInNewContext(read('public/'+p),context,{filename:p});
 return context.window;
}
test('All 37 distinct Coke designs are listed individually, alongside six existing sets, with unique SKUs',()=>{
 const w=getCatalog(),p=w.BURTON_DATA.inventory;
 const coke=p.filter(v=>v.collection==='coca-cola');
 const singles=coke.filter(v=>v.type==='original');
 const sets=coke.filter(v=>v.type==='bundle');
 assert.equal(p.length,131);
 assert.equal(new Set(p.map(x=>x.sku)).size,131);
 assert.equal(coke.length,43);
 assert.equal(singles.length,37);
 assert.equal(sets.length,6);
 assert.equal(new Set(singles.map(x=>x.sku)).size,37);
 const source=w.BURTON_DATA.archive.filter(x=>x.collection==='coca-cola');
 assert.equal(source.length,37);
 for(const x of source)assert.ok(singles.some(p=>p.sku===x.id),'Unlisted archive page '+x.id);
 assert.equal(w.BURTON_COKE_ARCHIVE_INDIVIDUALS.newSingleListings,23);
 assert.equal(w.BURTON_COKE_ARCHIVE_INDIVIDUALS.cokeProductListings,43);
 assert.equal(w.BURTON_COKE_ARCHIVE_INDIVIDUALS.totalProducts,131);
});
test('Former set-only Coca-Cola units have independent product pages, prices grounded in archive ranges, both image variants',()=>{
 const w=getCatalog(),archive=new Map(w.BURTON_DATA.archive.map(x=>[x.id,x]));
 const originals=w.BURTON_DATA.inventory.filter(x=>x.collection==='coca-cola'&&x.type==='original');
 const newlyIndependent=originals.filter(x=>/^CC-\d{3}$/.test(x.sku)&&x.memberOfSet);
 assert.equal(newlyIndependent.length,23);
 for(const item of newlyIndependent){
  const source=archive.get(item.sku);
  assert.ok(source,'Archive source missing '+item.sku);
  assert.equal(item.catalogIds.length,1);
  assert.equal(item.catalogIds[0],item.sku);
  assert.ok(item.shortDescription.length>=130,item.sku);
  assert.equal(item.year,source.year);
  assert.equal(item.condition,source.condition);
  assert.equal(item.conditionNotes,source.conditionNotes);
  assert.ok(item.price>=source.valueMin&&item.price<=source.valueMax,'price out of reference range '+item.sku);
  assert.ok(/\.95$/.test(item.price.toFixed(2)),item.sku);
  assert.equal(item.stockState,'available');
  assert.equal(item.availableForCheckout,true);
  assert.equal(item.images.length,2);
  assert.equal(item.image,'assets/images/polished/'+item.sku.toLowerCase()+'.webp');
  assert.equal(item.images[1],source.photo);
  for(const photo of item.images)assert.ok(existsSync(at('public/'+photo)),'Missing photograph '+photo);
  assert.ok(/^SET-[A-E]$/.test(item.memberOfSet),item.sku);
 }
});
test('Every originally bundled unit has one corresponding single listing and is still included in exactly its original set',()=>{
 const w=getCatalog(),products=w.BURTON_DATA.inventory;
 const sets=products.filter(x=>/^SET-[A-E]$/.test(x.sku));
 assert.equal(sets.length,5);
 const bySku=new Map(products.map(x=>[x.sku,x]));
 const occurrences=new Map();
 for(const set of sets)for(const member of set.catalogIds){
  assert.ok(bySku.has(member),'No single product for set item '+member);
  assert.equal(bySku.get(member).memberOfSet,set.sku,'Set membership mismatch '+member);
  occurrences.set(member,(occurrences.get(member)||0)+1);
 }
 assert.equal(occurrences.size,23);
 for(const [id,number] of occurrences)assert.equal(number,1,'Duplicate physical inventory in multiple sets: '+id);
 const newSet=bySku.get('CC-SET-F');
 assert.deepEqual([...newSet.catalogIds],['CC-NEW-001','CC-NEW-002','CC-NEW-003']);
 for(const member of newSet.catalogIds)assert.ok(bySku.has(member));
});
test('New individual listings load everywhere and homepage labels correctly indicate 43 Coke listings',()=>{
 for(const page of ['public/index.html','public/storefront.html','public/account.html','public/preview.html']){
  const html=read(page);
  let prior=-1;
  for(const s of ['coke-new-products.js','coke-archive-singles.js']){
    const at=html.indexOf('src="'+s+'"');
    assert.ok(at>prior,'Script missing or out of order '+page+':'+s);
    prior=at;
  }
  assert.ok(!html.includes('20 listings'),'Stale Coke count on '+page);
  assert.ok(!html.includes('108 product listings'),'Stale shop count on '+page);
 }
 for(const page of ['public/index.html','public/storefront.html']){
  const html=read(page);
  assert.ok(html.includes('43 listings'),page);
  assert.ok(html.includes('229 product listings'),page);
  assert.ok(html.includes('37 SINGLE FINDS + 6 SETS'),page);
  assert.ok(html.includes('37 DISTINCT DESIGNS'),page);
  assert.ok(html.includes('Single pieces <span>194</span>'),page);
 }
 const html=read('public/preview.html');
 assert.ok(html.includes('131</strong>'));
 assert.ok(html.includes('43</strong>'));
 for(const s of scripts)execFileSync(process.execPath,['--check',at('public/'+s)]);
});
