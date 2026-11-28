import test from 'node:test';
import assert from 'node:assert/strict';
import {cancellationToken,onRequestPost as cancel} from '../functions/api/checkout-cancel.js';
const base='https://burtonandfound.ca',id='cs_live_fixture123456789',hold='40b9bf73-7d03-48cc-8d51-907d039175b8';
const env={STRIPE_WEBHOOK_MODE:'live',STRIPE_LIVE_WEBHOOK_SECRET:'whsec_fixture',STRIPE_SECRET_KEY:'sk_live_fixture',STRIPE_EXPECTED_ACCOUNT_ID:'acct_fixture123456',SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_fixture'};
const req=(token,origin=base)=>new Request(base+'/api/checkout-cancel',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({session_id:id,cancel_token:token})});
const reply=x=>new Response(JSON.stringify(x),{headers:{'Content-Type':'application/json'}});
test('unauthorized or cross-origin cancellation never reaches providers',async()=>{
 const original=globalThis.fetch;globalThis.fetch=()=>{throw Error('Unexpected fetch')};
 try{
 const token=await cancellationToken(env,id);
 assert.match(token,/^[a-f0-9]{64}$/);assert.notEqual(token,await cancellationToken(env,id+'x'));
 assert.equal((await cancel({request:req('0'.repeat(64)),env})).status,403);
 assert.equal((await cancel({request:req(token,'https://unrelated.example'),env})).status,403);
 }finally{globalThis.fetch=original}
});
test('only the exact verified unpaid session can release its reservation',async()=>{
 const original=globalThis.fetch,token=await cancellationToken(env,id);
 try{
 for(const scenario of ['open','expired','paid','wrong-hold','wrong-merchant','timeout','already-released','review']){
  const calls=[];const session={id,livemode:true,status:scenario==='expired'?'expired':scenario==='paid'?'complete':'open',payment_status:scenario==='paid'?'paid':'unpaid',metadata:{source:'burton-found',bf_hold_id:scenario==='wrong-hold'?'other':hold}};
  globalThis.fetch=async(url,init)=>{
   calls.push(String(url));
   if(url.includes('/bf_checkout_holds?'))return reply([{id:hold,status:scenario==='already-released'?'expired':scenario==='review'?'review':'reserved'}]);
   if(url.endsWith('/account'))return reply({id:scenario==='wrong-merchant'?'acct_wrong':env.STRIPE_EXPECTED_ACCOUNT_ID});
   if(url.endsWith('/expire')){if(scenario==='timeout')throw Error('network');return reply({...session,status:'expired'});}
   if(url.endsWith('/checkout/sessions/'+id))return reply(session);
   if(url.endsWith('/bf_expire_stripe_session')){assert.equal(JSON.parse(init.body).p_session_id,id);return reply(true);}
   throw Error('Unexpected request');
  };
  const r=await cancel({request:req(token),env}),v=await r.json();
  assert.equal(v.released===true,['open','expired','already-released'].includes(scenario),scenario);
  assert.equal(calls.some(x=>x.endsWith('/bf_expire_stripe_session')),['open','expired'].includes(scenario),scenario);
  assert.equal(calls.some(x=>x.endsWith('/expire')),['open','timeout'].includes(scenario),scenario);
 }
 }finally{globalThis.fetch=original}
});
