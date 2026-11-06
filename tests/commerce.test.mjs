import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import {secure,verifyStripe} from '../functions/_lib/core.js';
import {onRequestPost as checkout} from '../functions/api/checkout.js';
import {onRequestPost as webhook} from '../functions/api/stripe-webhook.js';
import {onRequestGet as health} from '../functions/api/health.js';
import {onRequestGet as adminOrders} from '../functions/api/admin/orders.js';
globalThis.crypto ||= webcrypto;
const base='https://burton-example.pages.dev';
const req=(items,options={})=>new Request(base+'/api/checkout',{method:'POST',headers:{origin:base,'content-type':'application/json',...options.headers},body:JSON.stringify(items)});
const env={SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_test',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',STRIPE_SECRET_KEY:'sk_test_testing',STRIPE_WEBHOOK_SECRET:'whsec_testing',SHIPPING_STANDARD_CA_CENTS:'1225',LIVE_CHECKOUT_ENABLED:'true',TAX_CONFIGURATION_APPROVED:'true'};
const json=(value)=>new Response(JSON.stringify(value),{status:200,headers:{'content-type':'application/json'}});

test('payment remains disabled until all secrets and owner tax sign-off are present',async()=>{
 assert.equal(secure({...env,TAX_CONFIGURATION_APPROVED:'false'}),false);
 assert.equal(secure({...env,STRIPE_SECRET_KEY:''}),false);
 const r=await checkout({request:req({skus:['OH-003']}),env:{}});assert.equal(r.status,503);
 const h=await health({env:{}});assert.equal((await h.json()).checkout,'preview_only');
});
test('bad checkout origin and duplicate SKU cannot create payment sessions',async()=>{
 let r=await checkout({request:new Request(base+'/api/checkout',{method:'POST',headers:{origin:'https://evil.example','content-type':'application/json'},body:JSON.stringify({skus:['OH-003']})}),env});assert.equal(r.status,403);
 r=await checkout({request:req({skus:['OH-003','OH-003']}),env});assert.equal(r.status,400);
});
test('checkout ignores forged client prices and uses database canonical price',async()=>{
 const original=globalThis.fetch;let stripeForm=null,rpcCount=0;
 globalThis.fetch=async (url,init)=>{
  if(url.includes('/rest/v1/rpc/bf_hold_cart')){rpcCount++;return json({id:'40b9bf73-7d03-48cc-8d51-907d039175b8',lines:[{sku:'OH-003',title:'Marlene Dietrich Portrait',price_cents:3995}]});}
  if(url.includes('/rest/v1/rpc/bf_bind_stripe_session'))return json(true);
  if(url.includes('api.stripe.com')){stripeForm=new URLSearchParams(init.body);return json({id:'cs_test_abcdefghijklmnopqrst',url:'https://checkout.stripe.com/c/pay/cs_test_abcdefghijklmnopqrst'});}
  throw Error('Unexpected URL '+url);
 };
 try{const r=await checkout({request:req({skus:['OH-003'],prices:[0],total:1}),env});assert.equal(r.status,200);assert.equal(rpcCount,1);assert.equal(stripeForm.get('line_items[0][price_data][unit_amount]'),'3995');assert.equal(stripeForm.get('shipping_options[0][shipping_rate_data][fixed_amount][amount]'),'1225');assert.equal(stripeForm.get('shipping_address_collection[allowed_countries][0]'),'CA');}finally{globalThis.fetch=original}
});
test('Stripe signed webhook verifies raw body and rejects tampered signatures',async()=>{
 const body='{"id":"evt_123","data":{"object":{"id":"cs_test_123"}}}';const ts=Math.floor(Date.now()/1000),key=await crypto.subtle.importKey('raw',new TextEncoder().encode('whsec_testing'),{name:'HMAC',hash:'SHA-256'},false,['sign']);const sig=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${ts}.${body}`)))).map(x=>x.toString(16).padStart(2,'0')).join('');
 assert.equal(await verifyStripe(body,`t=${ts},v1=${sig}`,'whsec_testing'),true);
 assert.equal(await verifyStripe(body+'x',`t=${ts},v1=${sig}`,'whsec_testing'),false);
 assert.equal(await verifyStripe(body,`t=${ts-400},v1=${sig}`,'whsec_testing'),false);
 const response=await webhook({request:new Request(base+'/api/stripe-webhook',{method:'POST',headers:{'stripe-signature':'t=1,v1=deadbeef'},body}),env});assert.equal(response.status,400);
});
test('private admin orders API rejects unauthenticated visitors',async()=>{
 const original=globalThis.fetch;globalThis.fetch=()=>{throw Error('Should not fetch admin data')};try{const r=await adminOrders({request:new Request(base+'/api/admin/orders'),env});assert.equal(r.status,403)}finally{globalThis.fetch=original}
});
test('catalog maps 22 sale listings to 40 physical units; no overlap inside each SKU',()=>{
 const contents=readFileSync(new URL('../public/products.js',import.meta.url),'utf8');const data=JSON.parse(contents.slice(contents.indexOf('=')+1).trim().replace(/;$/,''));
 assert.equal(data.inventory.length,22);const units=new Set(data.inventory.flatMap(p=>p.catalogIds));assert.equal(units.size,40);
 for(const p of data.inventory){assert.equal(new Set(p.catalogIds).size,p.catalogIds.length);assert.ok(existsSync(new URL(`../public/${p.image}`,import.meta.url)));}
 const marketing=readFileSync(new URL('../public/store.js',import.meta.url),'utf8');assert.ok(marketing.includes('/api/checkout'));
});

test('live Stripe keys are rejected unless separately and explicitly approved',()=>{
 const maybeLive={...env,STRIPE_SECRET_KEY:'sk_live_unused_example',LIVE_PAYMENTS_APPROVED:'false'};
 assert.equal(secure(maybeLive),false);
 assert.equal(secure({...maybeLive,LIVE_PAYMENTS_APPROVED:undefined}),false);
});
