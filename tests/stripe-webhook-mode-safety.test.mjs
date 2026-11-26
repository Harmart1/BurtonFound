import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyStripeEvent,onRequestPost as webhook} from '../functions/api/stripe-webhook.js';
import {webcrypto} from 'node:crypto';
globalThis.crypto ||= webcrypto;
const env={STRIPE_WEBHOOK_MODE:'test',STRIPE_EXPECTED_ACCOUNT_ID:'acct_fixture123456',STRIPE_WEBHOOK_SECRET:'whsec_fixture',SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_fixture'};
const event=(type='checkout.session.completed',fields={},outer={})=>({id:'evt_fixture',type,livemode:false,data:{object:{id:'cs_test_fixture',object:'checkout.session',livemode:false,mode:'payment',status:'complete',payment_status:'paid',currency:'cad',amount_total:1500,payment_intent:'pi_fixture',shipping_cost:{amount_total:500},...fields}},...outer});
const act=(e,cfg=env)=>classifyStripeEvent(e,cfg).action;
test('webhook verifies event mode, session mode and merchant independent of checkout availability',()=>{
 assert.equal(act(event()),'paid');
 assert.equal(act(event(undefined,{}, {livemode:true})),undefined);
 assert.equal(act(event(undefined,{id:'cs_live_fixture'})),undefined);
 assert.equal(act(event(undefined,{livemode:true})),undefined);
 assert.equal(act(event(undefined,{mode:'setup'})),undefined);
 assert.equal(act(event(undefined,{}, {account:'acct_wrong'})),undefined);
 assert.equal(act(event(undefined,{id:'cs_live_fixture',livemode:true},{livemode:true}),{...env,STRIPE_WEBHOOK_MODE:'live',LIVE_CHECKOUT_ENABLED:'false'}),'paid');
 assert.equal(classifyStripeEvent(event(),{}).status,503);
});
test('completed delayed payment keeps hold; asynchronous success needs paid status and valid totals',()=>{
 assert.equal(act(event(undefined,{payment_status:'unpaid'})),'ignore');
 for(const v of [{payment_status:'unpaid'},{payment_status:'no_payment_required'},{currency:'usd'},{currency:undefined},{amount_total:-1},{amount_total:0},{amount_total:1.5},{shipping_cost:{amount_total:2000}},{payment_intent:null},{status:'open'}])
  assert.equal(act(event('checkout.session.async_payment_succeeded',v)),undefined,JSON.stringify(v));
 assert.equal(act(event('checkout.session.async_payment_succeeded')),'paid');
});
test('only unpaid terminal checkout releases inventory',()=>{
 assert.equal(act(event('checkout.session.expired',{status:'expired',payment_status:'unpaid'})),'release');
 assert.equal(act(event('checkout.session.async_payment_failed',{payment_status:'unpaid'})),'release');
 assert.equal(act(event('checkout.session.expired',{status:'expired'})),undefined);
 assert.equal(act(event('checkout.session.expired',{status:'open',payment_status:'unpaid'})),undefined);
 assert.equal(act(event('checkout.session.async_payment_failed')),undefined);
});
test('authenticated malformed and non-checkout events never invoke database writes',async()=>{
 const before=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('Unexpected fetch');};
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.STRIPE_WEBHOOK_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 async function signed(e){const payload=JSON.stringify(e),ts=Math.floor(Date.now()/1000),signature=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(ts+'.'+payload)))).map(x=>x.toString(16).padStart(2,'0')).join('');return webhook({request:new Request('https://fixture.test/api/stripe-webhook',{method:'POST',body:payload,headers:{'Stripe-Signature':'t='+ts+',v1='+signature}}),env});}
 try{
  assert.equal((await signed(event('checkout.session.async_payment_succeeded',{payment_status:'unpaid'}))).status,400);
  assert.equal((await signed(event(undefined,{}, {livemode:true}))).status,400);
  assert.equal((await signed(event(undefined,{payment_status:'unpaid'}))).status,200);
  assert.equal((await signed({id:'evt_probe',type:'bf.integration.ping',livemode:false})).status,200);
  assert.equal(calls,0);
 }finally{globalThis.fetch=before;}
});
