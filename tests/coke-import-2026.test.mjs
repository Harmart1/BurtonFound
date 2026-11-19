import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {runInNewContext} from 'node:vm';
import {execFileSync} from 'node:child_process';
const f=p=>join(process.cwd(),p);
const text=p=>readFileSync(f(p),'utf8');
function state(){
 const context={window:{},console:{warn(){}},Intl};
 for(const p of ['products.js','old-hollywood-item-data.js','old-hollywood-sets-data.js','old-hollywood-products.js','coke-new-products.js','featured-merchandising.js']){
  execFileSync(process.execPath,['--check',f('public/'+p)]);
  runInNewContext(text('public/'+p),context,{filename:p});
 }
 return context.window;
}
test('Coke PDF intake adds exactly three unique originals and one three-piece set',()=>{
 const W=state(),all=W.BURTON_DATA.inventory;
 assert.equal(all.length,108);
 assert.equal(new Set(all.map(p=>p.sku)).size,108);
 const coke=all.filter(p=>p.collection==='coca-cola');
 assert.equal(coke.length,20);
 const additions=coke.filter(p=>p.sku.startsWith('CC-NEW-')||p.sku==='CC-SET-F');
 assert.equal(additions.length,4);
 assert.equal(additions.filter(p=>p.type==='original').length,3);
 assert.equal(additions.filter(p=>p.type==='bundle').length,1);
 assert.equal(additions.filter(p=>p.availableForCheckout!==true).length,0);
 assert.equal(additions.filter(p=>p.stockState!=='available').length,0);
 assert.equal(W.BURTON_NEW_COKE_INTEGRATION.duplicateImagesExcluded,4);
 assert.equal(W.BURTON_NEW_COKE_INTEGRATION.nonCokePagesExcluded,1);
 const bySku=new Map(all.map(p=>[p.sku,p]));
 for(const [sku,page,year] of [['CC-NEW-001',3,1958],['CC-NEW-002',4,1959],['CC-NEW-003',7,1961]]){
  const p=bySku.get(sku);assert.ok(p,sku);
  assert.equal(p.sourcePdfPage,page);
  assert.equal(p.year,year);
  assert.equal(p.price,24.95);
  assert.equal(p.quantity,1);
  assert.ok(p.title.length>=24,sku);
  assert.ok(p.shortDescription.length>=180,sku);
  assert.equal(p.images.length,2,sku);
  for(const image of p.images)assert.ok(existsSync(f('public/'+image)),'Missing image '+image);
 }
 for(const preexisting of ['CC-034','CC-033','CC-031']){
  assert.ok(bySku.has(preexisting),'Original matching product missing: '+preexisting);
  assert.equal(additions.some(p=>p.sku===preexisting),false);
 }
 assert.equal(bySku.get('CC-SET-F').price,62.95);
 assert.equal(bySku.get('CC-SET-F').catalogIds.length,3);
 assert.equal(new Set(bySku.get('CC-SET-F').catalogIds).size,3);
 assert.equal(bySku.get('CC-SET-F').memberDetails.length,3);
 assert.equal(bySku.get('CC-SET-F').images.length,2);
 const individualSum=bySku.get('CC-SET-F').catalogIds.reduce((n,id)=>n+bySku.get(id).price,0);
 assert.ok(bySku.get('CC-SET-F').price<individualSum);
 assert.ok(Math.abs(individualSum-74.85)<.01);
 assert.equal(W.BURTON_DATA.archive.filter(x=>x.id.startsWith('CC-NEW-')).length,3);
});
test('Coke imports are linked across all shop/account/preview surfaces without deleting existing inventory',()=>{
 for(const file of ['public/index.html','public/storefront.html','public/account.html','public/preview.html']){
  const html=text(file);
  const h='old-hollywood-products.js',c='coke-new-products.js';
  assert.ok(html.includes('src="'+c+'"'),file);
  assert.ok(html.indexOf('src="'+h+'"')<html.indexOf('src="'+c+'"'),file);
  if(file!=='public/preview.html')
   assert.ok(html.indexOf('src="'+c+'"')<html.indexOf('src="account-core.js"'),file);
  assert.ok(!html.includes('104 product listings'),file);
 }
 for(const page of ['public/index.html','public/storefront.html']){
  const html=text(page);
  assert.ok(html.includes('id="coca-cola-new"'),page);
  for(const id of ['CC-NEW-001','CC-NEW-002','CC-NEW-003','CC-SET-F'])
   assert.ok(html.includes('item='+id+'#shop'),'New product missing home link '+id);
  assert.ok(html.includes('href="coke-new-feature.css"'));
  assert.ok(html.includes('108 product listings'));
  assert.ok(html.includes('20 listings'));
  assert.ok(html.includes('14 SINGLE FINDS + 6 SETS'));
  assert.ok(html.includes('37 DISTINCT DESIGNS'));
  assert.ok(html.includes('Browse the collection'),page);
 }
 const top=state().BURTON_FEATURED;
 for(const id of ['CC-NEW-001','CC-NEW-002','CC-NEW-003']){
   assert.ok(top.orders['coca-cola:all'].includes(id),'not merchandised: '+id);
 }
 assert.ok(top.orders['coca-cola:bundle'].includes('CC-SET-F'));
 assert.ok(top.preview['coca-cola'].includes('CC-SET-F'));
 assert.ok(!top.orders['coca-cola:original'].includes('CC-SET-F'));
 assert.ok(!top.orders['coca-cola:bundle'].includes('CC-NEW-001'));
 const wr=JSON.parse(text('wrangler.jsonc'));
 for(const key of ['LIVE_CHECKOUT_ENABLED','LIVE_PAYMENTS_APPROVED','TAX_CONFIGURATION_APPROVED','CARRIER_QUOTES_ENABLED'])
  assert.equal(wr.vars[key],'false',key+' must remain gated');
});
test('Coke feature photography is present and rendered using semantic responsive cards',()=>{
 const html=text('public/index.html');
 const start=html.indexOf('<section class="bf-coke-feature"');
 const end=html.indexOf('</section>',start);
 const section=html.slice(start,end);
 assert.ok(section.includes('bf-coke-set-mosaic'));
 assert.equal((section.match(/class="bf-coke-feature-card"/g)||[]).length,4);
 for(const img of [...section.matchAll(/<img[^>]+src="([^"]+)"/g)]){
  assert.ok(existsSync(f('public/'+img[1])),img[1]);
 }
 const css=text('public/coke-new-feature.css');
 assert.ok(css.includes('@media(max-width:520px)'));
 assert.ok(css.includes('grid-template-columns:repeat(2,minmax(0,1fr))'));
 assert.ok(css.includes('bf-coke-set-mosaic'));
});
