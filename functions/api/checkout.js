import {verifyQuote} from '../_lib/shipping.js';
import {json,error,secure,checkSameOrigin,rpc,db,stripe,safeReturnUrl,verifiedUser} from '../_lib/core.js';
const amount=(v)=>/^\d{1,8}$/.test(String(v||''))?Number(v):null;
export async function onRequestPost({request,env}){
  if(!checkSameOrigin(request))return error(403,'Invalid checkout origin');
  if(!secure(env))return error(503,'Secure checkout is not configured. No payment has been taken.');
  if(Number(request.headers.get('content-length')||0)>8192)return error(413,'Checkout request too large');
  let body;try{body=await request.json()}catch{return error(400,'Invalid shopping bag')}
  const skus=body?.skus;
  if(!Array.isArray(skus)||!skus.length||skus.length>12||skus.some(s=>typeof s!=='string'||!/^[A-Z0-9-]{2,24}$/.test(s))||new Set(skus).size!==skus.length)return error(400,'Invalid or duplicate item IDs');
  const liveShipping=env.SHIPPING_MODE==='live_carrier';
  let ship=amount(env.SHIPPING_STANDARD_CA_CENTS),express=amount(env.SHIPPING_EXPRESS_CA_CENTS),quote=null;
  if(liveShipping){try{quote=await verifyQuote(env,body?.shipping_quote,skus);ship=quote.amount_cents;express=null;}catch(e){return error(400,e.message)}}
  if(ship===null)return error(503,'Shipping price is not configured');
  const user=await verifiedUser(request,env);
  let hold=null,session=null;
  try{
    hold=await rpc(env,'bf_hold_cart',{p_skus:skus,p_customer_id:user?.id||null});
    if(!hold?.id||!Array.isArray(hold.lines))throw Error(hold?.error||'Those originals are not currently available');
    const origin=safeReturnUrl(request),created=Math.floor(Date.now()/1000);
    const args={mode:'payment','payment_method_types[0]':'card',success_url:`${origin}/checkout-success.html?session_id={CHECKOUT_SESSION_ID}`,cancel_url:`${origin}/index.html?checkout=cancelled#shop`,'shipping_address_collection[allowed_countries][0]':quote?.to.country||'CA','phone_number_collection[enabled]':'true',expires_at:String(created+1860),client_reference_id:hold.id,'metadata[bf_hold_id]':hold.id,'metadata[source]':'burton-found'};
    hold.lines.forEach((p,i)=>{
      args[`line_items[${i}][price_data][currency]`]='cad';args[`line_items[${i}][price_data][unit_amount]`]=String(p.price_cents);
      args[`line_items[${i}][price_data][product_data][name]`]=`${p.title} (${p.sku})`;
      args[`line_items[${i}][quantity]`]='1';
    });
    args['shipping_options[0][shipping_rate_data][type]']='fixed_amount';
    args['shipping_options[0][shipping_rate_data][fixed_amount][currency]']='cad';
    args['shipping_options[0][shipping_rate_data][fixed_amount][amount]']=String(ship);
    args['shipping_options[0][shipping_rate_data][display_name]']=quote?`${quote.carrier} · ${quote.name||quote.code}${quote.eta?' · ETA '+quote.eta:''}`.slice(0,100):'Standard tracked shipping · Canada';
    if(quote){args['metadata[bf_ship_country]']=quote.to.country;args['metadata[bf_ship_postal]']=quote.to.postal;args['metadata[bf_ship_city]']=quote.to.city;args['metadata[bf_ship_state]']=quote.to.state||'';args['metadata[bf_ship_carrier]']=quote.carrier;args['metadata[bf_ship_service]']=quote.code;args['metadata[bf_ship_amount]']=String(quote.amount_cents);args['metadata[bf_ship_date]']=quote.ship_date;if(quote.eta)args['metadata[bf_ship_eta]']=quote.eta;}
    if(express!==null){args['shipping_options[1][shipping_rate_data][type]']='fixed_amount';args['shipping_options[1][shipping_rate_data][fixed_amount][currency]']='cad';args['shipping_options[1][shipping_rate_data][fixed_amount][amount]']=String(express);args['shipping_options[1][shipping_rate_data][display_name]']='Express shipping · Canada';}
    if(env.STRIPE_AUTOMATIC_TAX==='true')args['automatic_tax[enabled]']='true';
    session=await stripe(env,'checkout/sessions',args,'POST',{'Idempotency-Key':`bf-checkout-${hold.id}`});
    if(!/^cs_(test|live)_/.test(session.id)||!/^https:\/\/checkout\.stripe\.com\//.test(session.url||''))throw Error('Stripe did not return a usable checkout URL');
    await rpc(env,'bf_bind_stripe_session',{p_hold_id:hold.id,p_session_id:session.id});
    return json({url:session.url,session_id:session.id});
  }catch(e){
    console.error('Checkout could not start',e.message);
    if(session?.id){try{await stripe(env,`checkout/sessions/${session.id}/expire`,{},'POST')}catch{}}
    if(hold?.id){try{await rpc(env,'bf_release_hold',{p_hold_id:hold.id})}catch{}}
    const sold=/not available|reserved|sold|overlap|unknown/i.test(e.message);
    return error(sold?409:503,sold?'An item is no longer available. Please refresh your bag.':'Checkout could not start. No payment was taken.');
  }
}
