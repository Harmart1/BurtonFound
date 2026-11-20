import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {runInNewContext} from 'node:vm';
import {execFileSync} from 'node:child_process';
const file=p=>join(process.cwd(),p);
const read=p=>readFileSync(file(p),'utf8');
const parse=(p,marker)=>JSON.parse(read(p).split(marker)[1].trim().replace(/;$/,''));
function load(){
  const ctx={window:{},console:{warn(){}},Intl};
  for(const s of ['products.js','old-hollywood-item-data.js','old-hollywood-sets-data.js',
                   'old-hollywood-products.js','coke-new-products.js','coke-archive-singles.js',
                   'vintage-cars-data.js','vintage-cars-sets.js','vintage-cars-products.js','featured-merchandising.js'])
    runInNewContext(read('public/'+s),ctx,{filename:s});
  return ctx.window;
}

test('Every featured category points to distinct actual catalogue products with existing photographs',()=>{
 const W=load(),products=W.BURTON_DATA.inventory,bySku=new Map(products.map(p=>[p.sku,p]));
 const config=W.BURTON_FEATURED;
 assert.equal(products.length,229);
 for(const [key,ids] of Object.entries(config.orders)){
   assert.ok(ids.length>=5,key);
   assert.equal(new Set(ids).size,ids.length,'Duplicate featured SKU in '+key);
   const [collection,kind]=key.split(':');
   assert.ok(['all','hollywood','coca-cola'].includes(collection),key);
   assert.ok(['all','original','bundle'].includes(kind),key);
   for(const id of ids){
     const item=bySku.get(id);
     assert.ok(item,'Missing product '+id+' in '+key);
     if(collection!=='all')assert.equal(item.collection,collection,id);
     if(kind!=='all')assert.equal(item.type,kind,id);
     assert.ok(existsSync(file('public/'+item.image)),'Missing photo '+item.image);
     assert.ok(item.title.length>5,id);
   }
 }
 for(const key of ['all:all','all:original','all:bundle','hollywood:all',
       'hollywood:original','hollywood:bundle','coca-cola:all',
       'coca-cola:original','coca-cola:bundle'])assert.ok(config.orders[key],key);
 assert.equal(config.orders['hollywood:all'][0],'OH-003');
 assert.equal(config.orders['coca-cola:all'][0],'CC-010');
 assert.equal(config.orders['hollywood:bundle'][0],'OHS-003');
 assert.ok(!Object.values(config.orders).flat().includes('OH-NEW-003-05'),
   'Alternate view must never be advertised as a separate product');
 for(const ids of Object.values(config.preview))
   for(const id of ids)assert.ok(bySku.has(id),id);
 assert.equal(config.preview.hollywood[0],'OH-003');
 assert.equal(config.preview.sets[0],'OHS-003');
 assert.equal(config.preview['coca-cola'][0],'CC-NEW-001');
 assert.equal(config.preview.automobiles[0],'VA-049');
 for(const id of config.preview.automobiles)assert.equal(bySku.get(id).availableForCheckout,false);
});

test('11 collector-set covers are real member photos and lead the product gallery',()=>{
 const W=load(),config=W.BURTON_FEATURED,setData=W.BURTON_HOLLYWOOD_CURATED_SETS;
 const bySku=new Map(W.BURTON_DATA.inventory.map(p=>[p.sku,p]));
 assert.equal(setData.sets.length,11);
 assert.equal(Object.keys(config.setCovers).length,11);
 for(const set of setData.sets){
    const chosen=config.setCovers[set.id];
    assert.ok(set.memberSkus.includes(chosen),'Cover not in set: '+set.id);
    const member=bySku.get(chosen);
    assert.ok(member,'Member not for sale: '+chosen);
    assert.equal(set.image,member.image,'Set featured image not chosen photo: '+set.id);
    assert.equal(set.previewImages[0],set.image,'Mosaic first image mismatch: '+set.id);
    assert.ok(existsSync(file('public/'+set.image)),set.id);
    const product=bySku.get(set.id);
    assert.ok(product,'Set product not available '+set.id);
    assert.equal(product.image,set.image,'Product card cover differs from set gallery '+set.id);
    assert.ok(product.images.length>=3,'No additional set images: '+set.id);
 }
 assert.equal(bySku.get('OH-NEW-003-04').image,'assets/images/old-hollywood/ohnew-003-05.webp',
   'The cleaner alternate portrait should be the hero photograph');
 assert.equal(bySku.get('OH-NEW-003-04').images.length,2);
});

test('Featured ordering only applies to default featured mode and does not affect manual sorts',()=>{
 const store=read('public/store.js');
 assert.ok(store.includes("orders[currentCollection+':'+currentFilter]"));
 assert.ok(store.includes("if(currentSort==='featured')"));
 for(const sort of ['low','high','oldest','newest'])
   assert.ok(store.includes("if(currentSort==='"+sort+"')"),sort);
 assert.ok(store.includes("list.sort((a,b)=>a.price-b.price)"));
 assert.ok(store.includes("list.sort((a,b)=>b.price-a.price)"));
 const vintage=read('public/vintage-cars-refined.js');
 assert.ok(vintage.includes("sort.value==='catalogue'&&!activeSet"));
 for(const sort of ['make','oldest','newest','lowprice','highprice'])
   assert.ok(vintage.includes("sort.value==='"+sort+"'"),sort);
 const cars=parse('public/vintage-cars-data.js','window.BURTON_VINTAGE_CARS=');
 assert.ok(cars.length>=80);
 const vehicleIds=new Set(cars.map(x=>x.sku));
 for(const id of load().BURTON_FEATURED.vintageCars){
   const found=cars.find(x=>x.sku===id);
   assert.ok(vehicleIds.has(id),'Missing automobile '+id);
   assert.ok(existsSync(file('public/'+found.image)),'Missing automobile image '+id);
 }
 assert.equal(load().BURTON_FEATURED.vintageCars[0],'VA-049');
});

test('Curated image data loads before each storefront and gallery renderer',()=>{
 const names={
   'public/index.html':['featured-merchandising.js','store.js'],
   'public/storefront.html':['featured-merchandising.js','store.js'],
   'public/preview.html':['featured-merchandising.js','preview-launch.js'],
   'public/vintage-cars.html':['featured-merchandising.js','vintage-cars-refined.js'],
   'public/old-hollywood-new.html':['featured-merchandising.js','old-hollywood-sets.js','old-hollywood-intake.js']
 };
 for(const [name,scripts] of Object.entries(names)){
   const html=read(name);let previous=-1;
   for(const src of scripts){const at=html.indexOf('src="'+src+'"');assert.ok(at>previous,'Missing/out of order '+src+' in '+name);previous=at;}
 }
 const archive=read('public/old-hollywood-new.html');
 assert.ok(archive.includes('Best photographs first'));
 assert.ok(archive.includes('Archive/source order'));
 const gallery=read('public/old-hollywood-sets.js');
 assert.ok(gallery.includes("set.image"));
 assert.ok(gallery.includes("window.BURTON_FEATURED?.orders?.['hollywood:bundle']"));
 for(const p of ['public/featured-merchandising.js','public/old-hollywood-products.js',
        'public/vintage-cars-refined.js','public/preview-launch.js','public/old-hollywood-intake.js',
        'public/old-hollywood-sets.js'])execFileSync(process.execPath,['--check',file(p)]);
});
