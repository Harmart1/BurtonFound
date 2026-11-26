import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {onRequestPost as checkout} from '../functions/api/checkout.js';

const base='https://burtonfound.timharmar.workers.dev';
const req=()=>new Request(base+'/api/checkout',{method:'POST',
 headers:{origin:base,'content-type':'application/json'},body:JSON.stringify({skus:['OH-003']})});
const env={
 SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_unit_fixture',
 STRIPE_SECRET_KEY:'sk_test_not_a_real_key',STRIPE_WEBHOOK_SECRET:'whsec_not_a_real_key',
 SHIPPING_STANDARD_CA_CENTS:'1295',TAX_CONFIGURATION_APPROVED:'true',LIVE_CHECKOUT_ENABLED:'true',
 STRIPE_EXPECTED_ACCOUNT_ID:'acct_1SN2j92NSH96TjSa'
};
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
test('wrong Stripe merchant blocks checkout BEFORE any inventory holds or charges',async()=>{
 const prev=globalThis.fetch,paths=[];
 globalThis.fetch=async(url)=>{
  paths.push(String(url));
  if(String(url)==='https://api.stripe.com/v1/account')return reply({id:'acct_other_merchant_identity_2026'});
  throw Error('Unexpected request: inventory should not be touched');
 };
 try{
  const result=await checkout({request:req(),env});
  assert.equal(result.status,503);
  assert.match((await result.json()).error,/verification is unavailable/);
  assert.deepEqual(paths,['https://api.stripe.com/v1/account']);
 }finally{globalThis.fetch=prev;}
});
test('invalid or revoked Stripe key blocks checkout before inventory is touched',async()=>{
 const prev=globalThis.fetch,calls=[];
 globalThis.fetch=async(url)=>{
  calls.push(String(url));
  if(String(url)==='https://api.stripe.com/v1/account')
   return reply({error:{message:'Invalid API Key'}},401);
  throw Error('No Supabase reservation should be attempted');
 };
 try{
  const result=await checkout({request:req(),env});
  assert.equal(result.status,503);
  assert.equal(calls.length,1);
 }finally{globalThis.fetch=prev;}
});
test('checkout refuses missing or malformed expected merchant without outbound requests',async()=>{
 const prev=globalThis.fetch;
 globalThis.fetch=()=>{throw Error('No Stripe or database calls permitted')};
 try{
  const result=await checkout({request:req(),env:{...env,STRIPE_EXPECTED_ACCOUNT_ID:''}});
  assert.equal(result.status,503);
  assert.match((await result.json()).error,/identity is not configured/);
 }finally{globalThis.fetch=prev;}
});
test('production config pins correct, public Stripe merchant identity without enabling payments',()=>{
 const vars=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8')).vars;
 assert.equal(vars.STRIPE_EXPECTED_ACCOUNT_ID,'acct_1SN2j92NSH96TjSa');
 assert.equal(vars.LIVE_CHECKOUT_ENABLED,'false');
 assert.equal(vars.STRIPE_PAYOUTS_VERIFIED,'false');
 assert.equal(vars.LIVE_PAYMENTS_APPROVED,'false');
 const code=readFileSync(new URL('../functions/api/checkout.js',import.meta.url),'utf8');
 assert.ok(code.indexOf("stripe(env,'account',null,'GET')")<code.indexOf("rpc(env,'bf_hold_cart'"));
 assert.match(code,/merchant verification mismatch/);
});
