import test from 'node:test';
import assert from 'node:assert/strict';
import {feedRows} from '../functions/api/merchant-feed.js';
import worker from '../src/worker.js';
import {merchantCatalog} from '../src/merchant-catalog.generated.js';
const base='https://burtonandfound.ca';
const row={sku:'CC-001',title:'A & B',description:'Paper < page',link:base+'/products/example-cc-001',image:base+'/assets/images/example.webp',condition:'used',price_cents:2995};
const stock=[{sku:row.sku,available:true,price_cents:2995}];
const approved=new Set([row.sku]);
test('Merchant feed includes only current approved matching-price candidates with correct shipping and escaped XML',()=>{
 const [xml]=feedRows([row],stock,approved,1995);
 assert.match(xml,/<g:title>A &amp; B<\/g:title>/);
 assert.match(xml,/Paper &lt; page/);
 assert.match(xml,/<g:price>29.95 CAD<\/g:price>/);
 assert.match(xml,/<g:price>19.95 CAD<\/g:price>/);
 assert.match(xml,/<g:availability>in_stock<\/g:availability>/);
 assert.match(feedRows([row],[{...stock[0],available:false}],approved,1995)[0],/out_of_stock/);
 assert.deepEqual(feedRows([row],[{...stock[0],price_cents:3995}],approved,1995),[]);
 assert.deepEqual(feedRows([row],stock,new Set(),1995),[]);
 assert.throws(()=>feedRows([row],[],approved,1995));
 assert.throws(()=>feedRows([row],[...stock,...stock],approved,1995));
});
test('documented Merchant candidates contain no automobile sets or unverified Hollywood prints',()=>{
 assert.ok(merchantCatalog.length>0&&merchantCatalog.length<229);
 assert.ok(merchantCatalog.every(p=>p.sku.startsWith('CC-')&&p.condition==='used'&&p.link.startsWith(base+'/products/')));
});
test('preview refuses Merchant feed and non-read requests are rejected',async()=>{
 assert.equal((await worker.fetch(new Request(base+'/merchant-feed.xml'),{},{})).status,503);
 assert.equal((await worker.fetch(new Request(base+'/merchant-feed.xml',{method:'POST'}),{},{})).status,405);
});
