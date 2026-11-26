import {stripe,error,json} from '../../_lib/core.js';
import {onRequestGet as bookkeeping} from './bookkeeping.js';
const money=n=>Number.isSafeInteger(n)&&n>=0?n:null;
const ident=(v,prefix)=>typeof v==='string'&&v.startsWith(prefix)&&/^[A-Za-z0-9_]+$/.test(v)&&v.length>prefix.length&&v.length<=255;
export function compareOrder(order,session,mode){
 const row={id:order.id,created_at:order.created_at,session_id:order.stripe_session_id,recorded_cents:money(order.total_cents),stripe_cents:null,shipping_cents:null,tax_cents:null,refund_reported_cents:null,charge_fee_cents:null,charge_net_cents:null,charge_balance_status:null,issues:[]};
 const flags=row.issues,live=mode==='live';
 if(!session||session.id!==order.stripe_session_id||session.livemode!==live||session.mode!=='payment'||session.currency!=='cad'){flags.push('Session identity, mode or currency mismatch');return row;}
 row.stripe_cents=money(session.amount_total);
 row.shipping_cents=money(session.shipping_cost?.amount_total??0);
 row.tax_cents=money(session.total_details?.amount_tax);
 if(row.recorded_cents===null||row.stripe_cents===null||row.recorded_cents!==row.stripe_cents)flags.push('Recorded total differs from Stripe');
 if(row.shipping_cents===null||row.shipping_cents!==money(order.shipping_cents))flags.push('Shipping differs from Stripe');
 if(!['paid','review','refunded'].includes(order.payment_status))flags.push('Unknown local payment status');
 if(session.payment_status!=='paid'||session.status!=='complete'){flags.push('Stripe payment is not confirmed complete');return row;}
 const pi=session.payment_intent;
 if(!pi||typeof pi!=='object'||!ident(pi.id,'pi_')||pi.id!==order.payment_intent||pi.livemode!==live||pi.currency!=='cad'||pi.status!=='succeeded'||money(pi.amount_received)!==row.stripe_cents){flags.push('Payment intent missing or inconsistent');return row;}
 const ch=pi.latest_charge;
 if(!ch||typeof ch!=='object'||!ident(ch.id,'ch_')||ch.payment_intent!==pi.id||ch.livemode!==live||ch.currency!=='cad'||ch.paid!==true||ch.captured!==true||money(ch.amount_captured)!==row.stripe_cents){flags.push('Captured charge missing or inconsistent');return row;}
 row.refund_reported_cents=money(ch.amount_refunded);
 if(row.refund_reported_cents===null||row.refund_reported_cents>row.stripe_cents){row.refund_reported_cents=null;flags.push('Refund amount unavailable or inconsistent');}
 else if(row.refund_reported_cents>0)flags.push('Refund reported — reconcile individual refund status and balance transactions');
 else if(order.payment_status==='refunded')flags.push('Local refunded status without a reported refund');
 if(ch.disputed===true)flags.push('Disputed charge — manual review');
 if(order.payment_status==='review')flags.push('Local order needs review');
 if(row.tax_cents===null)flags.push('Stripe tax total unavailable');
 const bt=ch.balance_transaction;
 if(bt&&typeof bt==='object'&&ident(bt.id,'txn_')&&bt.source===ch.id&&bt.currency==='cad'&&bt.amount===row.stripe_cents&&money(bt.fee)!==null&&Number.isSafeInteger(bt.net)&&bt.net===bt.amount-bt.fee&&['pending','available'].includes(bt.status)){
  row.charge_fee_cents=bt.fee;row.charge_net_cents=bt.net;row.charge_balance_status=bt.status;
 }else flags.push('Original CAD charge balance transaction missing or inconsistent');
 return row;
}
export async function onRequestGet({request,env}){
 // Reuse authenticated, bounded, PII-free UTC ledger. No Stripe requests on denied access.
 const report=await bookkeeping({request,env});
 if(!report.ok)return report;
 const data=await report.json(),mode=new URL(request.url).searchParams.get('mode');
 if(!['test','live'].includes(mode))return error(400,'Select live or sandbox records');
 const records=data.orders.filter(o=>String(o.stripe_session_id||'').startsWith('cs_'+mode+'_'));
 if(records.length>25)return error(422,'Select a shorter period (maximum 25 matching orders per Stripe comparison)');
 if(!records.length)return json({from:data.from,to:data.to,mode,excluded:data.orders.length,rows:[],notice:'No matching orders. Stripe was not contacted.'});
 if(!String(env.STRIPE_SECRET_KEY||'').startsWith('sk_'+mode+'_')||!ident(env.STRIPE_EXPECTED_ACCOUNT_ID,'acct_'))return error(503,'Matching Stripe credentials are not configured. No comparison made.');
 try{
  const merchant=await stripe(env,'account',null,'GET');
  if(merchant?.id!==env.STRIPE_EXPECTED_ACCOUNT_ID)return error(503,'Stripe merchant verification failed; no comparison made');
  const rows=[];
  for(const o of records){
   try{
    if(!ident(o.stripe_session_id,'cs_'+mode+'_'))throw Error('Invalid session identifier');
    const session=await stripe(env,'checkout/sessions/'+encodeURIComponent(o.stripe_session_id)+'?'+new URLSearchParams({'expand[]':'payment_intent.latest_charge.balance_transaction'}),null,'GET');
    rows.push(compareOrder(o,session,mode));
   }catch{rows.push({id:o.id,created_at:o.created_at,session_id:o.stripe_session_id,recorded_cents:money(o.total_cents),issues:['Stripe session lookup unavailable; no amounts verified']});}
  }
  return json({from:data.from,to:data.to,mode,excluded:data.orders.length-records.length,rows,notice:'Original charges only. Refunds reported as of this check, not verified settled refund totals. Not a payout, bank reconciliation, or tax return.'});
 }catch{return error(503,'Stripe connection or merchant verification failed; no comparison made');}
}
