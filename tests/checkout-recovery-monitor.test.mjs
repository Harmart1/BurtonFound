import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {onRequestPost as checkout} from '../functions/api/checkout.js';
import {onRequestPost as webhook} from '../functions/api/stripe-webhook.js';
import {boundedText} from '../functions/_lib/bounded-json.js';
const base='https://example.test';
const hold='40b9bf73-7d03-48cc-8d51-907d039175b8',sid='cs_test_abcdefghijklmnopqrst';
const env={SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_fixture',STRIPE_SECRET_KEY:'sk_test_fixture',STRIPE_EXPECTED_ACCOUNT_ID:'acct_example123456',STRIPE_WEBHOOK_SECRET:'whsec_fixture',SHIPPING_STANDARD_CA_CENTS:'1000',LIVE_CHECKOUT_ENABLED:'true',TAX_CONFIGURATION_APPROVED:'true'};
const req=()=>new Request(base+'/api/checkout',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify({skus:['OH-003']})});
const reply=x=>new Response(JSON.stringify(x),{headers:{'content-type':'application/json'}});
test('ambiguous Stripe creation never releases a one-of-a-kind inventory hold',async()=>{
 const previous=globalThis.fetch,paths=[];
 globalThis.fetch=async url=>{
  const u=String(url);paths.push(u);
  if(u.endsWith('/account'))return reply({id:env.STRIPE_EXPECTED_ACCOUNT_ID});
  if(u.endsWith('/bf_hold_cart'))return reply({id:hold,lines:[{sku:'OH-003',title:'Original',price_cents:1000}]});
  if(u.endsWith('/checkout/sessions'))throw Error('Connection lost after request');
  throw Error('Unexpected call');
 };
 try{
  const r=await checkout({request:req(),env});assert.equal(r.status,503);
  assert.match((await r.json()).error,/could not be confirmed/);
  assert.equal(paths.some(x=>x.endsWith('/bf_release_hold')),false);
 }finally{globalThis.fetch=previous;}
});
test('release after bind failure requires exact Stripe-confirmed unpaid expiration',async()=>{
 const previous=globalThis.fetch;
 try{
  for(const scenario of ['expired','paid','wrong-id','timeout']){
   const calls=[];
   globalThis.fetch=async url=>{
    const u=String(url);calls.push(u);
    if(u.endsWith('/account'))return reply({id:env.STRIPE_EXPECTED_ACCOUNT_ID});
    if(u.endsWith('/bf_hold_cart'))return reply({id:hold,lines:[{sku:'OH-003',title:'Original',price_cents:1000}]});
    if(u.endsWith('/checkout/sessions'))return reply({id:sid,url:'https://checkout.stripe.com/c/pay/'+sid});
    if(u.endsWith('/bf_bind_stripe_session'))return reply(false);
    if(u.endsWith('/expire')){
     if(scenario==='timeout')throw Error('Network');
     return reply({id:scenario==='wrong-id'?'cs_test_other_session':sid,status:'expired',payment_status:scenario==='paid'?'paid':'unpaid'});
    }
    if(u.endsWith('/bf_release_hold'))return reply(true);
    throw Error('Unexpected call');
   };
   const r=await checkout({request:req(),env});assert.equal(r.status,503);
   assert.equal(calls.some(x=>x.endsWith('/bf_release_hold')),scenario==='expired',scenario);
  }
 }finally{globalThis.fetch=previous;}
});
test('webhook rejects large actual body before signature or database work',async()=>{
 const previous=globalThis.fetch;globalThis.fetch=()=>{throw Error('Must not fetch')};
 try{
  const body='é'.repeat(150001);
  const req=new Request(base+'/api/stripe-webhook',{method:'POST',body});
  assert.equal((await webhook({request:req,env})).status,413);
  const original=' { "test": true } ';
  assert.equal(await boundedText(new Request(base,{method:'POST',body:original}),100),original);
 }finally{globalThis.fetch=previous;}
});
test('scheduled public monitoring uses GET only and has no credential dependency',()=>{
 const y=readFileSync(new URL('../.github/workflows/worker-smoke.yml',import.meta.url),'utf8');
 assert.match(y,/schedule:/);assert.match(y,/preview_only/);
 assert.match(y,/\/api\/catalog/);assert.match(y,/\/api\/admin\/readiness/);
 assert.doesNotMatch(y,/secrets\.|--request|--data|POST/);
});
