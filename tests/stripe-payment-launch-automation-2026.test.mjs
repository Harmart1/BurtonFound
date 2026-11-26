import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {secure} from '../functions/_lib/core.js';
import {onRequestPost as webhook} from '../functions/api/stripe-webhook.js';
import {webcrypto} from 'node:crypto';

globalThis.crypto ||= webcrypto;
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const base='https://burtonfound.timharmar.workers.dev';

test('payout verification gate blocks Stripe live checkout independently of approvals',()=>{
 const env={SUPABASE_URL:'https://unit.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_test',
  STRIPE_EXPECTED_ACCOUNT_ID:'acct_1SN2j92NSH96TjSa',STRIPE_SECRET_KEY:'sk_live_fixture',STRIPE_WEBHOOK_SECRET:'whsec_fixture',
  SHIPPING_STANDARD_CA_CENTS:'1995',LIVE_CHECKOUT_ENABLED:'true',
  LIVE_PAYMENTS_APPROVED:'true',TAX_CONFIGURATION_APPROVED:'true'};
 assert.equal(secure(env),false);
 assert.equal(secure({...env,STRIPE_PAYOUTS_VERIFIED:'false'}),false);
 assert.equal(secure({...env,STRIPE_EXPECTED_ACCOUNT_ID:'acct_1SN2j92NSH96TjSa',STRIPE_SECRET_KEY:'sk_test_fixture'}),true,'Sandbox test mode must not require payouts enabled');
});
test('current production configuration cannot activate payments or falsely verify payouts',()=>{
 const vars=JSON.parse(source('wrangler.jsonc')).vars;
 for(const name of ['LIVE_CHECKOUT_ENABLED','LIVE_PAYMENTS_APPROVED','TAX_CONFIGURATION_APPROVED','STRIPE_PAYOUTS_VERIFIED'])
  assert.equal(vars[name],'false',name);
 assert.equal(vars.STRIPE_AUTOMATIC_TAX,'false');
});
test('Stripe sandbox secret installer matches connected account and never activates live keys',()=>{
 const s=source('.github/workflows/install-stripe-sandbox-secrets.yml');
 assert.match(s,/acct_1SN2j92NSH96TjSa/);
 assert.doesNotMatch(s,/acct_1UZT5PRoHhWgtgRh/);
 assert.match(s,/sk_test_/);
 assert.match(s,/LIVE_CHECKOUT_ENABLED/);
});
test('read-only Stripe audit never posts to Stripe or writes Worker settings',()=>{
 const workflow=source('.github/workflows/stripe-payment-readiness.yml');
 const script=source('scripts/audit_stripe_payment_setup.py');
 assert.match(workflow,/workflow_dispatch/);
 assert.match(workflow,/audit_stripe_payment_setup\.py/);
 assert.match(workflow,/upload-artifact/);
 assert.match(script,/burtonfound\.timharmar\.workers\.dev/);
 assert.match(script,/GET|Request/);
 assert.doesNotMatch(script,/\/v1\/webhook_endpoints/);
 assert.doesNotMatch(script,/\/v1\/checkout\/sessions/);
 assert.doesNotMatch(script,/cloudflare_bindings\(\).*put/i);
 assert.match(script,/STRIPE_PAYOUTS_VERIFIED/);
});
test('signed synthetic Stripe payment confirms paid order through existing idempotent database RPC',async()=>{
 const secret='whsec_fixture_secret',ts=Math.floor(Date.now()/1000);
 const evt={
  id:'evt_sample_payment_test',type:'checkout.session.completed',
  data:{object:{id:'cs_test_synthetic_payment_example',payment_status:'paid',
   amount_total:6300,currency:'cad',customer_details:{email:'buyer@example.test'},
   shipping_cost:{amount_total:1305},metadata:{bf_ship_country:'CA',bf_ship_postal:'K1A0B1',bf_ship_city:'Ottawa',bf_ship_state:'ON',bf_ship_carrier:'Canada Post',bf_ship_service:'DOM.EP',bf_ship_amount:'1305'},
   collected_information:{shipping_details:{address:{country:'CA',postal_code:'K1A0B1',city:'Ottawa',state:'ON'},name:'Synthetic Buyer'}}}}
 };
 const body=JSON.stringify(evt);
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const digest=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(ts+'.'+body)));
 const sig=Array.from(digest).map(x=>x.toString(16).padStart(2,'0')).join('');
 const request=(b,signature)=>new Request(base+'/api/stripe-webhook',{method:'POST',
  headers:{'Stripe-Signature':signature,'content-type':'application/json'},body:b});
 const prev=globalThis.fetch;const rpc=[];
 globalThis.fetch=async(url,init)=>{
  const str=String(url);if(!str.includes('/rest/v1/rpc/'))throw Error('Unexpected outbound request');
  rpc.push({name:str.split('/').pop(),args:JSON.parse(init.body)});
  return new Response(JSON.stringify({status:'paid'}),{status:200,headers:{'content-type':'application/json'}});
 };
 try{
  const env={SUPABASE_URL:'https://unit.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_unit',STRIPE_WEBHOOK_SECRET:secret};
  const result=await webhook({request:request(body,'t='+ts+',v1='+sig),env});
  assert.equal(result.status,200);
  assert.deepEqual(rpc.map(x=>x.name),['bf_mark_checkout_paid','bf_record_shipping_selection']);
  assert.equal(rpc[0].args.p_amount,6300);
  assert.equal(rpc[0].args.p_shipping_cents,1305);
  const invalid=await webhook({request:request(body+' ','t='+ts+',v1='+sig),env});
  assert.equal(invalid.status,400);assert.equal(rpc.length,2);
 }finally{globalThis.fetch=prev;}
});
