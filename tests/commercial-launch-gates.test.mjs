import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {secure,LIVE_LAUNCH_GATES,approvedLiveSkus} from '../functions/_lib/core.js';
import {onRequestPost as checkout} from '../functions/api/checkout.js';
const base='https://burtonandfound.ca';
const live={GUEST_CHECKOUT_EMAIL_DEFERRED:'true',CUSTOMER_EMAIL_DELIVERY_APPROVED:'false',SHIPPING_ALLOWED_COUNTRIES:'CA',LIVE_APPROVED_SKUS_JSON:'["CC-010"]',STRIPE_SECRET_KEY:'sk_live_fixture',STRIPE_WEBHOOK_SECRET:'whsec_fixture',STRIPE_WEBHOOK_MODE:'live',STRIPE_EXPECTED_ACCOUNT_ID:'acct_1SN2j92NSH96TjSa',SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_fixture',LIVE_PAYMENTS_APPROVED:'true',STRIPE_PAYOUTS_VERIFIED:'true',LIVE_CHECKOUT_ENABLED:'true',TAX_CONFIGURATION_APPROVED:'true',SHIPPING_MODE:'flat_rate',FLAT_RATE_PRICES_APPROVED:'true',SHIPPING_STANDARD_CA_CENTS:'1995',...Object.fromEntries(LIVE_LAUNCH_GATES.map(k=>[k,'true']))};
test('all separate production readiness gates and webhook mode are required',()=>{
 assert.equal(secure(live),true);
 assert.equal(secure({...live,GUEST_CHECKOUT_EMAIL_DEFERRED:'false'}),false);
 assert.equal(secure({...live,GUEST_CHECKOUT_EMAIL_DEFERRED:'false',CUSTOMER_EMAIL_DELIVERY_APPROVED:'true'}),true);
 for(const k of LIVE_LAUNCH_GATES){assert.equal(secure({...live,[k]:'false'}),false,k);assert.equal(secure({...live,[k]:undefined}),false,k);}
 assert.equal(secure({...live,STRIPE_WEBHOOK_MODE:'test'}),false);
 const cfg=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
 for(const k of LIVE_LAUNCH_GATES)assert.equal(cfg.vars[k],'false');
 assert.equal(secure({...live,STRIPE_SECRET_KEY:'sk_test_fixture',STRIPE_WEBHOOK_MODE:'test',...Object.fromEntries(LIVE_LAUNCH_GATES.map(k=>[k,'false']))}),true);
});
test('real-money checkout rechecks Stripe charge and payout eligibility before inventory reservation',async()=>{
 const before=globalThis.fetch;
 let calls=[];
 try{
  for(const flags of [{charges_enabled:false,payouts_enabled:true},{charges_enabled:true,payouts_enabled:false},{}]){
   calls=[];globalThis.fetch=async url=>{calls.push(String(url));return new Response(JSON.stringify({id:live.STRIPE_EXPECTED_ACCOUNT_ID,...flags}),{headers:{'content-type':'application/json'}});};
   const r=await checkout({env:live,request:new Request(base+'/api/checkout',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify({skus:['CC-010']})})});
   assert.equal(r.status,503);assert.deepEqual(calls,['https://api.stripe.com/v1/account']);
  }
 }finally{globalThis.fetch=before;}
});

test('Canadian-only launch refuses US even if legacy customs flags accidentally become enabled',async()=>{
 const before=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;throw Error('No external request expected');};
 try{
  const env={...live,US_SHIPPING_APPROVED:'true',CANADA_POST_US_DUTIES_APPROVED:'true',SHIPPING_STANDARD_US_CENTS:'2995'};
  const r=await checkout({env,request:new Request(base+'/api/checkout',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify({skus:['CC-010'],shipping_country:'US'})})});
  assert.equal(r.status,400);assert.equal(calls,0);
 }finally{globalThis.fetch=before;}
});
test('only explicitly approved live SKUs can proceed; invalid approval records fail closed',async()=>{
 for(const raw of ['[]','invalid','{}','["CC-010","CC-010"]','["invalid sku"]',undefined]){assert.equal(approvedLiveSkus({...live,LIVE_APPROVED_SKUS_JSON:raw}).size,0);assert.equal(secure({...live,LIVE_APPROVED_SKUS_JSON:raw}),false);}
 assert.deepEqual([...approvedLiveSkus(live)],['CC-010']);
 const before=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;throw Error('No external request expected');};
 try{const r=await checkout({env:live,request:new Request(base+'/api/checkout',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify({skus:['CC-010','OH-003']})})});assert.equal(r.status,409);assert.equal(calls,0);}
 finally{globalThis.fetch=before;}
});
