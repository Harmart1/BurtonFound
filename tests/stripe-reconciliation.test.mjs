import test from 'node:test';
import assert from 'node:assert/strict';
import {compareOrder,onRequestGet as reconcile} from '../functions/api/admin/stripe-reconciliation.js';
import worker from '../src/worker.js';
const env={SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_fixture',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',STRIPE_SECRET_KEY:'sk_test_fixture',STRIPE_EXPECTED_ACCOUNT_ID:'acct_fixture123'};
const order={id:'fixture',created_at:'2026-11-15T00:00:00Z',stripe_session_id:'cs_test_fixture',payment_intent:'pi_fixture',shipping_cents:500,total_cents:1500,payment_status:'paid'};
const makeSession=()=>({id:'cs_test_fixture',livemode:false,mode:'payment',status:'complete',payment_status:'paid',currency:'cad',amount_total:1500,shipping_cost:{amount_total:500},total_details:{amount_tax:0},payment_intent:{id:'pi_fixture',livemode:false,currency:'cad',status:'succeeded',amount_received:1500,latest_charge:{id:'ch_fixture',payment_intent:'pi_fixture',livemode:false,currency:'cad',paid:true,captured:true,amount_captured:1500,amount_refunded:0,disputed:false,balance_transaction:{id:'txn_fixture',source:'ch_fixture',currency:'cad',amount:1500,fee:74,net:1426,status:'available'}}}});
const url='https://fixture.test/api/admin/stripe-reconciliation?from=2026-11-01&to=2026-11-30&mode=test',req=()=>new Request(url,{headers:{authorization:'Bearer fixture'}});
const uid='74d3f91e-9121-4bc5-aa7a-3ccbf888716a',reply=x=>new Response(JSON.stringify(x),{headers:{'content-type':'application/json'}});
test('reconciliation validates original charge fees and reports refunds separately',()=>{
 const s=makeSession(),r=compareOrder(order,s,'test');
 assert.deepEqual(r.issues,[]);assert.equal(r.charge_fee_cents,74);assert.equal(r.charge_net_cents,1426);assert.equal(r.refund_reported_cents,0);
 s.payment_intent.latest_charge.amount_refunded=300;const refunded=compareOrder(order,s,'test');assert.equal(refunded.refund_reported_cents,300);assert.match(refunded.issues.join(' '),/Refund reported/);assert.equal(refunded.charge_net_cents,1426);
 s.payment_intent.latest_charge.balance_transaction.currency='usd';assert.equal(compareOrder(order,s,'test').charge_fee_cents,null);
});
test('wrong mode, session, payment intent, charge or currency is not silently reconciled',()=>{
 for(const change of [s=>s.livemode=true,s=>s.id='cs_test_other',s=>s.currency='usd',s=>s.payment_intent.id='pi_wrong',s=>s.payment_intent.latest_charge.paid=false,s=>s.payment_status='unpaid']){
  const s=makeSession();change(s);const r=compareOrder(order,s,'test');assert.ok(r.issues.length);assert.equal(r.charge_fee_cents,null);
 }
});
test('endpoint is owner-only, read-only, mode matched, merchant checked and PII-free',async()=>{
 const prev=globalThis.fetch,calls=[];let wrong=false;
 globalThis.fetch=async(u,init)=>{const str=String(u);calls.push([str,init?.method||'GET']);
  if(str.includes('/auth/v1/user'))return reply({id:uid});
  if(str.includes('/bf_admin_users'))return reply([{user_id:uid}]);
  if(str.includes('/bf_orders'))return reply([{...order,email:'private@example.invalid'}]);
  if(str.endsWith('/v1/account'))return reply({id:wrong?'acct_wrong':env.STRIPE_EXPECTED_ACCOUNT_ID});
  if(str.includes('/checkout/sessions/'))return reply({...makeSession(),customer_details:{email:'private@example.invalid'}});
  throw Error('Unexpected request');
 };
 try{
  assert.equal((await worker.fetch(new Request(url),env,{})).status,403);assert.equal(calls.length,0);
  const result=await reconcile({request:req(),env});assert.equal(result.status,200);const data=await result.json();assert.equal(data.rows.length,1);assert.equal(data.rows[0].charge_net_cents,1426);assert.doesNotMatch(JSON.stringify(data),/private@example/);assert.ok(calls.every(x=>x[1]==='GET'));
  wrong=true;const n=calls.filter(x=>x[0].includes('/checkout/sessions/')).length;
  assert.equal((await reconcile({request:req(),env})).status,503);assert.equal(calls.filter(x=>x[0].includes('/checkout/sessions/')).length,n);
 }finally{globalThis.fetch=prev;}
});
