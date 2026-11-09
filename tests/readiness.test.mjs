import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {onRequestGet as readiness} from '../functions/api/admin/readiness.js';

const base='https://burtonfound.timharmar.workers.dev';
const adminId='74d3f91e-9121-4bc5-aa7a-3ccbf888716a';
const env={
 SUPABASE_URL:'https://safe.supabase.co',
 SUPABASE_PUBLISHABLE_KEY:'sb_publishable_public_testing',
 SUPABASE_SECRET_KEY:'sb_secret_PRIVATE_FOR_TESTS',
 STRIPE_SECRET_KEY:'sk_test_TEST_ONLY_SHOULD_NOT_LEAK',
 STRIPE_WEBHOOK_SECRET:'whsec_TEST_ONLY_SHOULD_NOT_LEAK',
 LIVE_CHECKOUT_ENABLED:'false',
 LIVE_PAYMENTS_APPROVED:'false',
 TAX_CONFIGURATION_APPROVED:'false',
 SHIPPING_MODE:'flat_rate',
 SHIPPING_ALLOWED_COUNTRIES:'CA'
};
const reply=x=>new Response(JSON.stringify(x),{status:200,headers:{'content-type':'application/json'}});

test('only authorized owners can read commercial readiness diagnostics',async()=>{
 const r=await readiness({request:new Request(base+'/api/admin/readiness'),env});
 assert.equal(r.status,403);
});

test('owner readiness reads Stripe Tax without leaking Stripe/Supabase keys or collecting payment',async()=>{
 const oldFetch=globalThis.fetch;let stripeReads=0;
 globalThis.fetch=async url=>{
  const u=String(url);
  if(u.includes('/auth/v1/user'))return reply({id:adminId});
  if(u.includes('/rest/v1/bf_admin_users'))return reply([{user_id:adminId}]);
  if(u.includes('/rest/v1/bf_public_stock'))return reply(Array.from({length:22},(_,i)=>({sku:'SKU-'+i,available:i%2===0})));
  if(u.includes('/v1/tax/settings')){stripeReads++;return reply({status:'pending',status_details:{pending:{missing_fields:['head_office']}}});}
  throw Error('Unexpected request '+u);
 };
 try{
  const r=await readiness({request:new Request(base+'/api/admin/readiness',{headers:{authorization:'Bearer owner-sandbox-token'}}),env});
  assert.equal(r.status,200);
  const data=await r.json();
  assert.equal(data.checkout,'preview_only');
  assert.equal(data.supabase.listings,22);
  assert.equal(data.supabase.available,11);
  assert.equal(data.stripe.taxSettings,'pending');
  assert.deepEqual(data.stripe.missingTaxFields,['head_office']);
  assert.equal(data.shipping.configured,false);
  assert.equal(data.email.deliveryVerifiedByApp,false);
  assert.equal(stripeReads,1);
  const serialized=JSON.stringify(data);
  assert.ok(!serialized.includes('PRIVATE_FOR_TESTS'));
  assert.ok(!serialized.includes('TEST_ONLY_SHOULD_NOT_LEAK'));
  assert.ok(!serialized.includes('sb_secret_'));
  assert.ok(!serialized.includes('sk_test_'));
  assert.ok(!serialized.includes('whsec_'));
 }finally{globalThis.fetch=oldFetch;}
});

test('readiness dashboard labels tax, shipping and email as checks, never actions',()=>{
 const html=readFileSync(new URL('../public/admin/orders.html',import.meta.url),'utf8');
 const script=readFileSync(new URL('../public/admin/admin.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../public/admin/admin.css',import.meta.url),'utf8');
 assert.match(html,/id="readinessResults"/);
 assert.match(html,/id="refreshReadiness"/);
 assert.match(script,/\/api\/admin\/readiness/);
 assert.match(script,/taxSettings/);
 assert.match(script,/deliveryVerifiedByApp/);
 assert.match(css,/--ui-surface/);
});
