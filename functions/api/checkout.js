import {boundedJson} from '../_lib/bounded-json.js';
import {verifyQuote} from '../_lib/shipping.js';
import {json,error,secure,checkSameOrigin,rpc,db,stripe,safeReturnUrl,verifiedUser,approvedLiveSkus} from '../_lib/core.js';
import {flatRateFor} from '../_lib/flat-shipping.js';
export async function onRequestPost({request,env}){
  if(!checkSameOrigin(request))return error(403,'Invalid checkout origin');
  if(!secure(env))return error(503,'Secure checkout is not configured. No payment has been taken.');
  let body;try{body=await boundedJson(request,8192)}catch(e){return e.status===413?error(413,'Checkout request too large'):error(400,'Invalid shopping bag')}
  const skus=body?.skus;
  if(!Array.isArray(skus)||!skus.length||skus.length>12||skus.some(s=>typeof s!=='string'||!/^[A-Z0-9-]{2,24}$/.test(s))||new Set(skus).size!==skus.length)return error(400,'Invalid or duplicate item IDs');
  if(String(env.STRIPE_SECRET_KEY||'').startsWith('sk_live_')){
    const approved=approvedLiveSkus(env);
    if(skus.some(s=>!approved.has(s)))return error(409,'An item requires seller verification before purchase. Please send a product enquiry.');
  }
  const liveShipping=env.SHIPPING_MODE==='live_carrier';
  let ship,express=null,quote=null,country,label;
  if(liveShipping){try{quote=await verifyQuote(env,body?.shipping_quote,skus);ship=quote.amount_cents;country=quote.to.country;}catch(e){return error(400,e.message)}}
  else{try{const rate=flatRateFor(env,body?.shipping_country??'CA');({country,label,standard:ship,express}=rate);}catch(e){return error(400,e.message)}}
  if(!Number.isInteger(ship)||ship<=0)return error(503,'Shipping price is not configured');
  // Never reserve one-of-a-kind stock or create a Checkout session using credentials
  // belonging to a different Stripe merchant. Validate with Stripe itself, not
  // just the key's sk_test_/sk_live_ prefix. Account IDs are public identifiers.
  const expectedMerchant=String(env.STRIPE_EXPECTED_ACCOUNT_ID||'').trim();
  if(!/^acct_[A-Za-z0-9]{10,64}$/.test(expectedMerchant))
    return error(503,'Payment merchant verification is not configured. No payment has been taken.');
  try{
    const activeMerchant=await stripe(env,'account',null,'GET');
    if(activeMerchant?.id!==expectedMerchant|| (String(env.STRIPE_SECRET_KEY).startsWith('sk_live_')&&(activeMerchant.charges_enabled!==true||activeMerchant.payouts_enabled!==true))){
      console.error('Checkout blocked: Stripe merchant verification mismatch');
      return error(503,'Payment merchant verification is unavailable. No payment has been taken.');
    }
  }catch{
    console.error('Checkout blocked: Stripe merchant credentials could not be verified');
    return error(503,'Payment merchant verification is unavailable. No payment has been taken.');
  }
  const live=String(env.STRIPE_SECRET_KEY||'').startsWith('sk_live_');
  if(live&&body.terms_version!=='CA-2026-11-28')return error(400,'Review the current purchase terms before checkout.');
  const user=await verifiedUser(request,env);
  let hold=null,session=null,creationAttempted=false;
  try{
    hold=await rpc(env,'bf_hold_cart',{p_skus:skus,p_customer_id:user?.id||null});
    if(!hold?.id||!Array.isArray(hold.lines))throw Error(hold?.error||'Those originals are not currently available');
    const origin=safeReturnUrl(request),created=Math.floor(Date.now()/1000);
    const args={mode:'payment','payment_method_types[0]':'card',success_url:`${origin}/checkout-success.html?session_id={CHECKOUT_SESSION_ID}`,cancel_url:`${origin}/index.html?checkout=cancelled#shop`,'shipping_address_collection[allowed_countries][0]':country,'phone_number_collection[enabled]':'true',expires_at:String(created+1860),client_reference_id:hold.id,'metadata[bf_hold_id]':hold.id,'metadata[source]':'burton-found'};
    // Use the storefront's public trading name on each newly created hosted Checkout page.
    args['branding_settings[display_name]']='Burton and Found';
    if(live){args['metadata[bf_terms_version]']='CA-2026-11-28';args['custom_text[submit][message]']='Canadian delivery only. Review items and shipping before payment. Seller: Burton and Found, 249-700-1871. No GST/HST currently charged. No voluntary change-of-mind returns unless agreed; statutory rights preserved.';}
    hold.lines.forEach((p,i)=>{
      args[`line_items[${i}][price_data][currency]`]='cad';args[`line_items[${i}][price_data][unit_amount]`]=String(p.price_cents);
      args[`line_items[${i}][price_data][product_data][name]`]=`${p.title} (${p.sku})`;
      args[`line_items[${i}][quantity]`]='1';
    });
    args['shipping_options[0][shipping_rate_data][type]']='fixed_amount';
    args['shipping_options[0][shipping_rate_data][fixed_amount][currency]']='cad';
    args['shipping_options[0][shipping_rate_data][fixed_amount][amount]']=String(ship);
    args['shipping_options[0][shipping_rate_data][display_name]']=quote?`${quote.carrier} · ${quote.name||quote.code}${quote.eta?' · ETA '+quote.eta:''}`.slice(0,100):'Standard tracked shipping · '+label;
    if(!quote){args['metadata[bf_flat_country]']=country;args['metadata[bf_flat_standard]']=String(ship);if(express!==null)args['metadata[bf_flat_express]']=String(express);}
    if(quote){args['metadata[bf_ship_country]']=quote.to.country;args['metadata[bf_ship_postal]']=quote.to.postal;args['metadata[bf_ship_city]']=quote.to.city;args['metadata[bf_ship_state]']=quote.to.state||'';args['metadata[bf_ship_carrier]']=quote.carrier;args['metadata[bf_ship_service]']=quote.code;args['metadata[bf_ship_amount]']=String(quote.amount_cents);args['metadata[bf_ship_date]']=quote.ship_date;if(quote.eta)args['metadata[bf_ship_eta]']=quote.eta;}
    if(express!==null){args['shipping_options[1][shipping_rate_data][type]']='fixed_amount';args['shipping_options[1][shipping_rate_data][fixed_amount][currency]']='cad';args['shipping_options[1][shipping_rate_data][fixed_amount][amount]']=String(express);args['shipping_options[1][shipping_rate_data][display_name]']='Express shipping · '+label;}
    if(env.STRIPE_AUTOMATIC_TAX==='true')args['automatic_tax[enabled]']='true';
    creationAttempted=true;
    session=await stripe(env,'checkout/sessions',args,'POST',{'Idempotency-Key':`bf-checkout-${hold.id}`});
    if(!(live?/^cs_live_/:/^cs_test_/).test(session.id)||!/^https:\/\/checkout\.stripe\.com\//.test(session.url||''))throw Error('Stripe did not return a usable checkout URL');
    if(await rpc(env,'bf_bind_stripe_session',{p_hold_id:hold.id,p_session_id:session.id})!==true)
      throw Error('Checkout reservation could not be bound');
    return json({url:session.url,session_id:session.id});
  }catch(e){
    console.error('Checkout could not start',e.message);
    // A network timeout is not proof that Stripe failed to create a session.
    // Preserve the original until no session was attempted or Stripe itself
    // confirms the exact session expired unpaid. Never release an ambiguous hold.
    let safeToRelease=!creationAttempted;
    if(creationAttempted&&/^cs_(test|live)_[A-Za-z0-9_]{12,160}$/.test(session?.id||'')){
      try{
        const expired=await stripe(env,`checkout/sessions/${session.id}/expire`,{},'POST');
        safeToRelease=expired?.id===session.id&&expired.status==='expired'&&expired.payment_status==='unpaid';
      }catch{}
    }
    if(hold?.id&&safeToRelease){try{await rpc(env,'bf_release_hold',{p_hold_id:hold.id})}catch{}}
    if(hold?.id&&!safeToRelease){
      // If the session is known, attempt to attach it for owner reconciliation.
      // This cannot release inventory; an existing reserved hold stays intact.
      if(/^cs_(test|live)_[A-Za-z0-9_]{12,160}$/.test(session?.id||'')){
        try{await rpc(env,'bf_bind_stripe_session',{p_hold_id:hold.id,p_session_id:session.id})}catch{}
      }
      console.error('Checkout needs owner reconciliation; reservation retained',hold.id);
      return error(503,'Checkout could not be confirmed. Please contact the store before trying again.');
    }
    const sold=/not available|reserved|sold|overlap|unknown/i.test(e.message);
    return error(sold?409:503,sold?'An item is no longer available. Please refresh your bag.':'Checkout could not start. No payment was taken.');
  }
}
