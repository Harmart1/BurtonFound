import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {onRequestGet as report} from '../functions/api/admin/bookkeeping.js';
const ctx={window:{}};for(const p of ['operations-core.js','analytics-core.js'])runInNewContext(readFileSync(new URL('../public/admin/'+p,import.meta.url),'utf8'),ctx);
const A=ctx.window.BURTON_ANALYTICS;
const products=[{sku:'OH-003',title:'Original',collection:'hollywood',catalogIds:['OH-003']},{sku:'CC-SET',title:'Set',collection:'coca-cola',catalogIds:['CC-001','CC-002']},{sku:'CC-001',title:'Single',collection:'coca-cola',catalogIds:['CC-001']},{sku:'VA-001',title:'Unverified',collection:'automobiles',requiresVerification:true,catalogIds:['VA-001']}];
const row={id:'order-a',created_at:'2026-11-10T00:00:00Z',stripe_session_id:'cs_live_fixture',subtotal_cents:1000,shipping_cents:500,total_cents:1695,payment_status:'paid',fulfillment_status:'processing',record_mode:'live',item_lines:[{sku:'OH-003',price_cents:1000}]};
test('monthly and collection analytics reconcile gross and exclude non-live, refunded and invalid rows',()=>{
 const r=A.sales([row,{...row,id:'b',created_at:'2026-12-01T00:00:00Z',item_lines:[{sku:'CC-SET',price_cents:1000}]},{...row,id:'c',stripe_session_id:'cs_test_fixture'},{...row,id:'d',payment_status:'refunded'},{...row,id:'e',total_cents:20}],products);
 assert.equal(r.count,2);assert.equal(r.gross,3390);assert.equal(r.average,1695);assert.equal(r.excluded,1);assert.equal(r.refunded,1);assert.equal(r.invalid,1);assert.equal(r.months.length,2);assert.equal(r.groups.length,2);assert.equal(r.groups.reduce((n,x)=>n+x.subtotal,0),r.subtotal);assert.match(r.monthlyCsv,/2026-12/);assert.doesNotMatch(r.skuCsv,/cs_test_fixture/);
});
test('unknown or inconsistent line allocations are not invented',()=>{
 const r=A.sales([{...row,item_lines:[{sku:'UNKNOWN',price_cents:1000}]},{...row,id:'b',item_lines:[{sku:'OH-003',price_cents:1}]}],products);
 assert.equal(r.unallocated,1000);assert.equal(r.unmapped,1000);assert.equal(r.subtotal,2000);
});
test('batch preparation excludes sandbox, refunded, unresolved and shared originals',()=>{
 const r=A.packing([row,{...row,id:'b',item_lines:[{sku:'CC-SET'}]},{...row,id:'c',item_lines:[{sku:'CC-001'}]},{...row,id:'d',record_mode:'test'},{...row,id:'e',payment_status:'refunded'},{...row,id:'f',shipping_review_reason:'Mismatch'},{...row,id:'g',item_lines:[{sku:'VA-001'}]}],products);
 assert.equal(r.ready.length,1);assert.equal(r.ready[0].id,'order-a');assert.equal(r.units,1);assert.equal(r.blocked.length,6);assert.doesNotMatch(r.csv,/CC-SET|VA-001/);
});
test('eligible bundle expands into physical units without customer personal data',()=>{
 const r=A.packing([{...row,item_lines:[{sku:'CC-SET'}],email:'buyer@example.test',shipping_address:{line1:'private'}}],products);
 assert.equal(r.units,2);assert.match(r.csv,/CC-002/);assert.doesNotMatch(r.csv,/buyer|private/);
});
test('bookkeeping returns only allowlisted line fields',async()=>{
 const previous=globalThis.fetch,uid='74d3f91e-9121-4bc5-aa7a-3ccbf888716a';
 const response=x=>new Response(JSON.stringify(x));
 globalThis.fetch=async url=>url.includes('/auth/v1/user')?response({id:uid}):url.includes('/bf_admin_users')?response([{user_id:uid}]):response([{...row,item_lines:[{sku:'OH-003',price_cents:1000,email:'private@example.test'}]}]);
 try{const r=await report({request:new Request('https://example.test/api/admin/bookkeeping?from=2026-11-01&to=2026-11-30',{headers:{authorization:'Bearer fixture'}}),env:{SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_fixture',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture'}});const d=await r.json();assert.equal(r.status,200);assert.deepEqual(d.orders[0].item_lines,[{sku:'OH-003',price_cents:1000}]);}finally{globalThis.fetch=previous;}
});
test('dashboard loads analytics before bookkeeping events and provides accessible print and export controls',()=>{
 const s=readFileSync(new URL('../public/admin/orders.html',import.meta.url),'utf8');
 assert.ok(s.indexOf('analytics-ui.js')<s.indexOf('operations-ui.js'));assert.match(s,/id="batchPrint"/);assert.match(s,/id="monthlyExport"/);
});
