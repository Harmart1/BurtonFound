import {error,json,rpc,verifyStripe} from '../_lib/core.js';
import {cleanPostal} from '../_lib/shipping.js';
export const normalizeCity=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
export function shippingMismatch(metadata,address,amount){
 const expected=metadata||{},a=address||{};
 if(!expected.bf_ship_carrier)return false;
 if(!a.country||!a.postal_code)return true;
 if(a.country.toUpperCase()!==expected.bf_ship_country||cleanPostal(a.postal_code)!==expected.bf_ship_postal||Number(amount)!==Number(expected.bf_ship_amount))return true;
 if(expected.bf_ship_state&&String(a.state||'').toUpperCase()!==expected.bf_ship_state)return true;
 if(expected.bf_ship_city&&normalizeCity(a.city)!==normalizeCity(expected.bf_ship_city))return true;
 return false;
}
export async function onRequestPost({request,env}){
  if(!env.STRIPE_WEBHOOK_SECRET||!env.SUPABASE_SECRET_KEY)return error(503,'Webhook is not configured');
  const payload=await request.text();
  if(payload.length>300000)return error(413,'Event too large');
  if(!await verifyStripe(payload,request.headers.get('Stripe-Signature'),env.STRIPE_WEBHOOK_SECRET))return error(400,'Invalid Stripe webhook signature');
  let evt;try{evt=JSON.parse(payload)}catch{return error(400,'Malformed webhook')}
  const session=evt?.data?.object;
  if(!/^evt_/.test(evt.id||'')||!/^cs_(test|live)_/.test(session?.id||''))return error(400,'Unsupported event payload');
  try{
    if((evt.type==='checkout.session.completed'&&session.payment_status==='paid')||evt.type==='checkout.session.async_payment_succeeded'){
      const shipping=session.collected_information?.shipping_details||session.shipping_details||{};
      const result=await rpc(env,'bf_mark_checkout_paid',{p_session_id:session.id,p_event_id:evt.id,p_amount:session.amount_total,p_currency:session.currency||'cad',p_email:session.customer_details?.email||session.customer_email||null,p_shipping:shipping,p_payment_intent:typeof session.payment_intent==='string'?session.payment_intent:null,p_shipping_cents:session.shipping_cost?.amount_total||0});
      if(result?.status==='review')console.error('MANUAL REVIEW REQUIRED: possible inventory conflict on Stripe session',session.id);
      const expected=session.metadata||{};const actual=shipping.address||session.customer_details?.address||{};
      if(expected.bf_ship_carrier){await rpc(env,'bf_record_shipping_selection',{p_session_id:session.id,p_carrier:expected.bf_ship_carrier,p_service:expected.bf_ship_service||'',p_eta:expected.bf_ship_eta||null});}
      if(expected.bf_ship_country&&shippingMismatch(expected,actual,session.shipping_cost?.amount_total||0)){
        await rpc(env,'bf_flag_shipping_mismatch',{p_session_id:session.id,p_reason:'Payment received but the Stripe delivery address or shipping amount differs from the quoted destination. Hold fulfillment and contact customer to confirm before shipping.'});
        console.error('SHIPPING REVIEW REQUIRED: quote differs from Stripe checkout destination',session.id);
      }
    }else if(evt.type==='checkout.session.expired'||evt.type==='checkout.session.async_payment_failed'){
      await rpc(env,'bf_expire_stripe_session',{p_session_id:session.id,p_event_id:evt.id});
    }
    return json({received:true});
  }catch(e){console.error('Stripe event processing failed',evt.id,e.message);return error(500,'Webhook processing needs retry');}
}
