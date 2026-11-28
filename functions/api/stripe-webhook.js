import {boundedText} from '../_lib/bounded-json.js';
import {error,json,rpc,verifyStripe} from '../_lib/core.js';
import {cleanPostal} from '../_lib/shipping.js';
export const normalizeCity=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
export function shippingMismatch(metadata,address,amount){
 const expected=metadata||{},a=address||{};
 if(expected.bf_flat_country){const prices=[expected.bf_flat_standard,expected.bf_flat_express].filter(v=>typeof v==='string'&&/^\d+$/.test(v)).map(Number);return String(a.country||'').toUpperCase()!==expected.bf_flat_country||!prices.includes(Number(amount));}
 if(!expected.bf_ship_carrier)return false;
 if(!a.country||!a.postal_code)return true;
 if(a.country.toUpperCase()!==expected.bf_ship_country||cleanPostal(a.postal_code)!==expected.bf_ship_postal||Number(amount)!==Number(expected.bf_ship_amount))return true;
 if(expected.bf_ship_state&&String(a.state||'').toUpperCase()!==expected.bf_ship_state)return true;
 if(expected.bf_ship_city&&normalizeCity(a.city)!==normalizeCity(expected.bf_ship_city))return true;
 return false;
}
const checkoutEvents=new Set(['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed','checkout.session.expired']);
const validId=(value,prefix)=>typeof value==='string'&&value.startsWith(prefix)&&/^[A-Za-z0-9_]+$/.test(value)&&value.length>prefix.length&&value.length<=255;
const cents=n=>Number.isSafeInteger(n)&&n>=0;
export function classifyStripeEvent(evt,env){
 const mode=env.STRIPE_WEBHOOK_MODE;
 if(!['test','live'].includes(mode))return {error:'Webhook mode is not configured',status:503};
 if(!validId(evt?.id,'evt_')||typeof evt?.type!=='string'||typeof evt?.livemode!=='boolean')return {error:'Unsupported event payload',status:400};
 if(evt.livemode!==(mode==='live'))return {error:'Stripe event mode mismatch',status:400};
 if(evt.account!=null&&evt.account!==env.STRIPE_EXPECTED_ACCOUNT_ID)return {error:'Stripe merchant mismatch',status:400};
 const session=evt.data?.object;
 // Isolated CI test sessions never touch the real inventory/order database.
 // The signed non-checkout probe proves the deployed guard before creating any test session.
 if(mode==='test'&&evt.livemode===false&&session?.livemode===false&&validId(session.id,'cs_test_')&&session.metadata?.bf_isolated_qa==='burtonfound-sandbox-v1'&&(checkoutEvents.has(evt.type)||evt.type==='bf.integration.isolation_probe'))return {action:'qa-isolated'};
 if(!checkoutEvents.has(evt.type))return {action:'ignore'};
 if(!validId(session?.id,'cs_'+mode+'_')||session.livemode!==evt.livemode||session.object!=='checkout.session'||session.mode!=='payment')return {error:'Invalid checkout session identity or mode',status:400};
 if(evt.type==='checkout.session.completed'||evt.type==='checkout.session.async_payment_succeeded'){
  // An ordinary completed event can precede a delayed payment; leave inventory reserved.
  if(evt.type==='checkout.session.completed'&&session.status==='complete'&&session.payment_status==='unpaid')return {action:'ignore'};
  const shipping=session.shipping_cost?.amount_total??0;
  if(session.status!=='complete'||session.payment_status!=='paid'||session.currency!=='cad'||!cents(session.amount_total)||session.amount_total===0||!cents(shipping)||shipping>session.amount_total||!validId(session.payment_intent,'pi_'))return {error:'Checkout payment is not confirmed or totals are invalid',status:400};
  return {action:'paid',session};
 }
 if(session.payment_status!=='unpaid'||session.status!==(evt.type==='checkout.session.expired'?'expired':'complete'))return {error:'Checkout release event is not an unpaid terminal session',status:400};
 return {action:'release',session};
}
export async function onRequestPost({request,env}){
  if((!env.STRIPE_WEBHOOK_SECRET&&!env.STRIPE_LIVE_WEBHOOK_SECRET)||!env.SUPABASE_SECRET_KEY)return error(503,'Webhook is not configured');
  let payload;try{payload=await boundedText(request,300000)}catch(e){return e.status===413?error(413,'Event too large'):error(400,'Malformed webhook');}
  const sig=request.headers.get('Stripe-Signature');
  const liveBinding=!!env.STRIPE_LIVE_WEBHOOK_SECRET&&await verifyStripe(payload,sig,env.STRIPE_LIVE_WEBHOOK_SECRET);
  if(!liveBinding&&(!env.STRIPE_WEBHOOK_SECRET||!await verifyStripe(payload,sig,env.STRIPE_WEBHOOK_SECRET)))return error(400,'Invalid Stripe webhook signature');
  // Separate live signature binding permits staging without disrupting sandbox delivery.
  // Signature determines mode, not untrusted request data.
  if(liveBinding)env={...env,STRIPE_WEBHOOK_MODE:'live'};
  let evt;try{evt=JSON.parse(payload)}catch{return error(400,'Malformed webhook')}
  const result=classifyStripeEvent(evt,env);
  if(result.error)return error(result.status,result.error);
  if(liveBinding&&evt.type==='bf.integration.live_probe'&&evt.livemode===true)return json({received:true,live_probe:true});
  if(liveBinding&&checkoutEvents.has(evt.type)&&evt.data?.object?.metadata?.source!=='burton-found')return json({received:true});
  if(result.action==='qa-isolated')return json({received:true,qa_isolated:true});
  if(result.action==='ignore')return json({received:true});
  const session=result.session;
  try{
    if(result.action==='paid'){
      const shipping=session.collected_information?.shipping_details||session.shipping_details||{};
      const result=await rpc(env,'bf_mark_checkout_paid',{p_session_id:session.id,p_event_id:evt.id,p_amount:session.amount_total,p_currency:session.currency,p_email:session.customer_details?.email||session.customer_email||null,p_shipping:shipping,p_payment_intent:session.payment_intent,p_shipping_cents:session.shipping_cost?.amount_total||0});
      if(result?.status==='review')console.error('MANUAL REVIEW REQUIRED: possible inventory conflict on Stripe session',session.id);
      const expected=session.metadata||{};const actual=shipping.address||session.customer_details?.address||{};
      if(expected.bf_ship_carrier){await rpc(env,'bf_record_shipping_selection',{p_session_id:session.id,p_carrier:expected.bf_ship_carrier,p_service:expected.bf_ship_service||'',p_eta:expected.bf_ship_eta||null});}
      if((expected.bf_ship_country||expected.bf_flat_country)&&shippingMismatch(expected,actual,session.shipping_cost?.amount_total||0)){
        await rpc(env,'bf_flag_shipping_mismatch',{p_session_id:session.id,p_reason:'Payment received but the Stripe delivery address or shipping amount differs from the quoted destination. Hold fulfillment and contact customer to confirm before shipping.'});
        console.error('SHIPPING REVIEW REQUIRED: quote differs from Stripe checkout destination',session.id);
      }
    }else if(result.action==='release'){
      await rpc(env,'bf_expire_stripe_session',{p_session_id:session.id,p_event_id:evt.id});
    }
    return json({received:true});
  }catch(e){console.error('Stripe event processing failed',evt.id,e.message);return error(500,'Webhook processing needs retry');}
}
