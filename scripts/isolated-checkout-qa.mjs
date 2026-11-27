// Actual application handlers + real disposable PostgreSQL; provider responses are synthetic.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {webcrypto} from 'node:crypto';
import {onRequestPost as checkout} from '../functions/api/checkout.js';
import {onRequestPost as webhook} from '../functions/api/stripe-webhook.js';
import {onRequestGet as checkoutStatus} from '../functions/api/checkout-status.js';
globalThis.crypto ||= webcrypto;
const container=process.env.FIXTURE_CONTAINER;
assert.match(container||'',/^[a-f0-9]{12,64}$/);
const env={SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_fixture_only',STRIPE_SECRET_KEY:'sk_test_fixture_only',STRIPE_EXPECTED_ACCOUNT_ID:'acct_fixture123456',STRIPE_WEBHOOK_SECRET:'whsec_fixture_only',STRIPE_WEBHOOK_MODE:'test',SHIPPING_STANDARD_CA_CENTS:'500',LIVE_CHECKOUT_ENABLED:'true',LIVE_PAYMENTS_APPROVED:'false',TAX_CONFIGURATION_APPROVED:'true'};
function sql(statement){
 const r=spawnSync('docker',['exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','bf_checkout_fixture'],{input:statement+';\n',encoding:'utf8'});
 if(r.status!==0)throw Error('Fixture SQL rejected operation');
 return r.stdout.trim();
}
const str=v=>v==null?'NULL':"'"+String(v).replaceAll("'","''")+"'";
const count=table=>Number(sql('select count(*) from public.'+table));
const stock=sku=>sql('select available from public.bf_public_stock where sku='+str(sku))==='t';
const idnum=n=>'cs_test_fixture_checkout_'+String(n).padStart(12,'0');
let next=0;
const sessions=new Map();
const response=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json'}});
const old=globalThis.fetch;
globalThis.fetch=async(url,init={})=>{
 const u=new URL(String(url));
 if(u.origin==='https://api.stripe.com'){
  if(u.pathname==='/v1/account'&&init.method==='GET')return response({id:env.STRIPE_EXPECTED_ACCOUNT_ID});
  if(u.pathname==='/v1/checkout/sessions'&&init.method==='POST'){
   const body=new URLSearchParams(init.body),id=idnum(++next);
   assert.equal(body.get('line_items[0][price_data][currency]'),'cad');assert.equal(body.get('shipping_options[0][shipping_rate_data][fixed_amount][amount]'),'500');
   sessions.set(id,body);return response({id,url:'https://checkout.stripe.com/c/pay/'+id});
  }
  throw Error('Unexpected synthetic Stripe request');
 }
 if(u.origin!=='https://fixture.supabase.co')throw Error('Network denied');
 if(u.pathname==='/rest/v1/bf_checkout_public_status'){
  const id=u.searchParams.get('stripe_session_id').slice(3);
  const data=sql("select coalesce(json_agg(q),'[]'::json) from (select status,order_ref from public.bf_checkout_public_status where stripe_session_id="+str(id)+') q');
  return response(JSON.parse(data));
 }
 const name=u.pathname.split('/').pop(),b=JSON.parse(init.body||'{}');
 let query;
 if(name==='bf_hold_cart')query='select public.bf_hold_cart(ARRAY['+b.p_skus.map(str).join(',')+']::text[],'+str(b.p_customer_id)+'::uuid)';
 else if(name==='bf_bind_stripe_session')query='select public.bf_bind_stripe_session('+str(b.p_hold_id)+'::uuid,'+str(b.p_session_id)+')';
 else if(name==='bf_release_hold')query='select public.bf_release_hold('+str(b.p_hold_id)+'::uuid)';
 else if(name==='bf_expire_stripe_session')query='select public.bf_expire_stripe_session('+[b.p_session_id,b.p_event_id].map(str).join(',')+')';
 else if(name==='bf_mark_checkout_paid')query='select public.bf_mark_checkout_paid('+[str(b.p_session_id),str(b.p_event_id),Number(b.p_amount),str(b.p_currency),str(b.p_email),str(JSON.stringify(b.p_shipping))+'::jsonb',str(b.p_payment_intent),Number(b.p_shipping_cents)].join(',')+')';
 else throw Error('Unexpected fixture RPC');
 try{const raw=sql(query);return response(raw==='t'?true:raw==='f'?false:JSON.parse(raw));}catch{return response({code:'fixture_rpc_rejected'},409);}
};
const origin='https://fixture.invalid';
const req=skus=>new Request(origin+'/api/checkout',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({skus})});
async function start(skus){const r=await checkout({request:req(skus),env});assert.equal(r.status,200);return (await r.json()).session_id;}
async function status(id){const r=await checkoutStatus({request:new Request(origin+'/api/checkout-status?session_id='+id),env});assert.equal(r.status,200);return r.json();}
async function event(id,type,eventId,extra={}){
 const data={id:eventId,type,livemode:false,data:{object:{id,object:'checkout.session',livemode:false,mode:'payment',status:'complete',payment_status:'paid',currency:'cad',amount_total:1500,payment_intent:'pi_fixture_payment',shipping_cost:{amount_total:500},...extra}}};
 const body=JSON.stringify(data),ts=Math.floor(Date.now()/1000),key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.STRIPE_WEBHOOK_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']),sig=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(ts+'.'+body)))).map(x=>x.toString(16).padStart(2,'0')).join('');
 return webhook({request:new Request(origin+'/api/stripe-webhook',{method:'POST',headers:{'Stripe-Signature':'t='+ts+',v1='+sig},body}),env});
}
try{
 assert.equal((await checkout({request:req(['QA-001']),env:{...env,LIVE_CHECKOUT_ENABLED:'false'}})).status,503);
 assert.equal(count('bf_checkout_holds'),0);
 const id=await start(['QA-001']);assert.equal(sessions.get(id).get('line_items[0][price_data][unit_amount]'),'1000');
 assert.equal((await status(id)).status,'processing');assert.equal(stock('QA-001'),false);assert.equal(stock('QA-SET'),false);
 assert.notEqual((await checkout({request:req(['QA-SET']),env})).status,200);assert.equal(next,1);
 assert.equal((await event(id,'checkout.session.completed','evt_fixture_unpaid',{payment_status:'unpaid'})).status,200);assert.equal(count('bf_orders'),0);assert.equal(stock('QA-001'),false);
 assert.equal((await event(id,'checkout.session.expired','evt_fixture_expired',{status:'expired',payment_status:'unpaid'})).status,200);
 assert.equal((await status(id)).status,'expired');assert.equal(stock('QA-001'),true);assert.equal(stock('QA-SET'),true);
 console.log('PASS checkout creation, authoritative price, reservation, overlap protection, delayed payment and expiry release');
 const paid=await start(['QA-001']);
 assert.equal((await event(paid,'checkout.session.async_payment_succeeded','evt_fixture_invalid',{payment_status:'unpaid'})).status,400);assert.equal(count('bf_orders'),0);
 assert.equal((await event(paid,'checkout.session.completed','evt_fixture_paid')).status,200);assert.equal((await status(paid)).status,'paid');assert.ok((await status(paid)).order_ref);
 assert.equal((await event(paid,'checkout.session.completed','evt_fixture_paid')).status,200);assert.equal(count('bf_orders'),1);
 assert.equal(sql('select total_cents from public.bf_orders'),'1500');
 assert.equal(stock('QA-001'),false);assert.equal(stock('QA-SET'),false);assert.equal(stock('QA-002'),true);
 console.log('PASS signed payment processing, duplicate delivery, order totals, customer status and sold inventory');
}finally{globalThis.fetch=old;}
