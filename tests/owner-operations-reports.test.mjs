import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {onRequestGet as report} from '../functions/api/admin/bookkeeping.js';
import worker from '../src/worker.js';
const ctx={window:{}};runInNewContext(readFileSync(new URL('../public/admin/operations-core.js',import.meta.url),'utf8'),ctx);
const O=ctx.window.BURTON_OPERATIONS;
const base='https://example.test',uid='74d3f91e-9121-4bc5-aa7a-3ccbf888716a';
const env={SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_fixture',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture'};
const req=(query,auth=true)=>new Request(base+'/api/admin/bookkeeping?'+query,{headers:auth?{authorization:'Bearer fixture'}:{}});
const response=x=>new Response(JSON.stringify(x),{headers:{'content-type':'application/json'}});
const row={id:'r1',created_at:'2026-11-10T00:00:00Z',stripe_session_id:'cs_live_fixture',payment_intent:'pi_fixture',subtotal_cents:1000,shipping_cents:500,total_cents:1695,payment_status:'paid',fulfillment_status:'processing'};
test('bookkeeping access denied without auth; date range validated before order reads',async()=>{
 assert.equal((await worker.fetch(req('',false),env,{})).status,403);
 const before=globalThis.fetch;let reads=0;
 globalThis.fetch=async u=>{if(u.includes('/auth/v1/user'))return response({id:uid});if(u.includes('/bf_admin_users'))return response([{user_id:uid}]);reads++;throw Error('unexpected');};
 try{assert.equal((await report({request:req('from=2026-02-30&to=2026-03-01'),env})).status,400);assert.equal(reads,0);}finally{globalThis.fetch=before;}
});
test('bookkeeping read uses bounded UTC period and allowlisted fields only',async()=>{
 const before=globalThis.fetch;let query;
 globalThis.fetch=async u=>{if(u.includes('/auth/v1/user'))return response({id:uid});if(u.includes('/bf_admin_users'))return response([{user_id:uid}]);query=new URL(u).searchParams;return response([{...row,email:'private@example.test',shipping_address:{line1:'private'}}]);};
 try{const r=await report({request:req('from=2026-11-01&to=2026-11-30'),env});assert.equal(r.status,200);const d=await r.json();assert.equal(d.orders.length,1);assert.equal(d.timezone,'UTC');assert.equal(d.orders[0].email,undefined);assert.equal(d.orders[0].shipping_address,undefined);assert.equal(query.getAll('created_at')[1],'lt.2026-12-01T00:00:00.000Z');}finally{globalThis.fetch=before;}
});
test('ledger excludes sandbox and review/refunded amounts from recorded paid gross',()=>{
 const r=O.ledger([row,{...row,id:'r2',stripe_session_id:'cs_test_fixture'},{...row,id:'r3',payment_status:'review'},{...row,id:'r4',payment_status:'refunded'},{...row,id:'r5',total_cents:10}]);
 assert.equal(r.rows,4);assert.equal(r.paid,1);assert.equal(r.gross,1695);assert.equal(r.other,195);assert.equal(r.excluded,1);assert.equal(r.invalid,1);assert.equal(r.review,1);assert.equal(r.refunded,1);assert.match(r.csv,/unclassified/);assert.doesNotMatch(r.csv,/cs_test_fixture/);
});
test('inventory flags missing, mismatched, unverified available and database-only records',()=>{
 const r=O.inventory([{sku:'A',title:'=Unsafe spreadsheet formula',price:10,requiresVerification:true},{sku:'B',title:'Other',price:12}],[{sku:'A',price_cents:999,available:true},{sku:'C',price_cents:100,available:false}]);
 assert.equal(r.count.missing,1);assert.equal(r.count.price,1);assert.equal(r.count.critical,1);assert.equal(r.count.backendOnly,1);assert.match(r.csv,/'=Unsafe/);assert.equal(O.priority({...row,shipping_review_reason:'Mismatch'}),0);assert.equal(O.priority(row),1);
});
test('operations interface retains owner workspace and defaults to live-only report',()=>{
 const html=readFileSync(new URL('../public/admin/orders.html',import.meta.url),'utf8');assert.match(html,/id="ledgerMode"><option value="live"/);assert.match(html,/id="stockExport"/);assert.match(html,/operations-core.js/);
});
