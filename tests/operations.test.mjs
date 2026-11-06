import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {onRequestGet as health} from '../functions/api/health.js';
import {onRequestPost as fulfill} from '../functions/api/admin/fulfill.js';
import {onRequestGet as history} from '../functions/api/admin/fulfillment-history.js';
const base='https://burton-testing.pages.dev';
const userId='7d572d4c-bfaa-4ecf-ac4f-5c37b5b4c201';
const orderId='fc8372d7-bca2-4d63-bfaa-4c577a8eb9db';
const env={SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_testing',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_testing',STRIPE_SECRET_KEY:'sk_test_testing',STRIPE_WEBHOOK_SECRET:'whsec_testing',SHIPPING_STANDARD_CA_CENTS:'1495',LIVE_CHECKOUT_ENABLED:'true',TAX_CONFIGURATION_APPROVED:'true'};
const res=(data)=>new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});
const req=(payload,headers={})=>new Request(base+'/api/admin/fulfill',{method:'POST',headers:{origin:base,authorization:'Bearer fake-validated-session',...headers},body:JSON.stringify(payload)});
const valid={id:orderId,status:'shipped',carrier:'Canada Post',tracking_number:'1234567890123456'};
test('Stripe test checkout mode is distinguished from live or disabled checkout',async()=>{
 assert.equal((await (await health({env})).json()).checkout,'test_mode');
 assert.equal((await (await health({env:{...env,STRIPE_SECRET_KEY:'sk_live_testing'}})).json()).checkout,'preview_only');
 assert.equal((await (await health({env:{...env,STRIPE_SECRET_KEY:'sk_live_testing',LIVE_PAYMENTS_APPROVED:'true'}})).json()).checkout,'live_mode');
 assert.equal((await (await health({env:{...env,TAX_CONFIGURATION_APPROVED:'false'}})).json()).checkout,'preview_only');
});
test('shipping updates reject unauthenticated users before database access',async()=>{
 const r=await fulfill({request:new Request(base+'/api/admin/fulfill',{method:'POST',headers:{origin:base},body:JSON.stringify(valid)}),env});assert.equal(r.status,403);
 const h=await history({request:new Request(base+'/api/admin/fulfillment-history?order_id='+orderId),env});assert.equal(h.status,403);
});
test('shipping update validates tracking, and authorized owner uses audit RPC',async()=>{
 let rpcName=null,params=null;
 const oldFetch=globalThis.fetch;
 globalThis.fetch=async (u,opts={})=>{
  if(u.includes('/auth/v1/user'))return res({id:userId});
  if(u.includes('/rest/v1/bf_admin_users'))return res([{user_id:userId}]);
  if(u.includes('/rest/v1/rpc/bf_update_fulfillment')){rpcName='bf_update_fulfillment';params=JSON.parse(opts.body);return res({...valid,id:orderId,payment_status:'paid',fulfillment_status:'shipped'});}
  if(u.includes('/rest/v1/bf_fulfillment_events'))return res([{previous_status:'packed',new_status:'shipped',carrier:'Canada Post',created_at:'2026-11-05T12:00:00Z'}]);
  throw Error('Unexpected URL '+u);
 };
 try{
  let r=await fulfill({request:req({...valid,tracking_number:''}),env});assert.equal(r.status,400);
  r=await fulfill({request:req(valid),env});assert.equal(r.status,200);
  assert.equal(rpcName,'bf_update_fulfillment');assert.equal(params.p_admin_id,userId);
  assert.equal(params.p_tracking,'1234567890123456');
  const h=await history({request:new Request(base+'/api/admin/fulfillment-history?order_id='+orderId,{headers:{authorization:'Bearer fake-validated-session'}}),env});assert.equal(h.status,200);assert.equal((await h.json()).events.length,1);
 }finally{globalThis.fetch=oldFetch}
});
test('database and dashboard include fulfillment history and print helpers',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/002_fulfillment_workflow.sql',import.meta.url),'utf8');
 assert.match(sql,/bf_update_fulfillment/);assert.match(sql,/bf_fulfillment_events/);
 assert.match(sql,/REVOKE EXECUTE ON FUNCTION public\.bf_update_fulfillment/);
 assert.match(sql,/EXISTS\(SELECT 1 FROM public\.bf_product_units/);
 const ui=readFileSync(new URL('../public/admin/admin.js',import.meta.url),'utf8');
 assert.match(ui,/packingSlip\(/);assert.match(ui,/exportCsv\(/);assert.match(ui,/customerEmail\(/);
 assert.ok(existsSync(new URL('../public/admin/orders.html',import.meta.url)));
});

test('reconciliation releases only Stripe-confirmed expired unpaid holds',async()=>{
 const {onRequestPost: reconcile}=await import('../functions/api/admin/reconcile-hold.js');
 const checkoutId='cs_test_abcdefghijklmnopqrstuvwxyz012345';
 let sessionStatus='open',rpcCount=0;
 const original=globalThis.fetch;
 globalThis.fetch=async (url,opts={})=>{
  if(url.includes('/auth/v1/user'))return res({id:userId});
  if(url.includes('/rest/v1/bf_admin_users'))return res([{user_id:userId}]);
  if(url.includes('/rest/v1/bf_checkout_holds'))return res([{id:orderId,status:'reserved',stripe_session_id:checkoutId}]);
  if(url.includes('api.stripe.com'))return res({id:checkoutId,status:sessionStatus,payment_status:'unpaid'});
  if(url.includes('/rest/v1/rpc/bf_expire_stripe_session')){rpcCount++;return res(true)}
  throw Error('Unexpected fetch '+url);
 };
 const request=()=>new Request(base+'/api/admin/reconcile-hold',{method:'POST',headers:{origin:base,authorization:'Bearer fake-validated-session'},body:JSON.stringify({id:orderId})});
 try{
  let r=await reconcile({request:request(),env});assert.equal(r.status,200);assert.equal((await r.json()).released,false);assert.equal(rpcCount,0);
  sessionStatus='expired';r=await reconcile({request:request(),env});assert.equal(r.status,200);assert.equal((await r.json()).released,true);assert.equal(rpcCount,1);
 }finally{globalThis.fetch=original}
});
