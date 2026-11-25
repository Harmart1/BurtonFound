import {json,error,checkSameOrigin} from '../_lib/core.js';
import {destination,parcelFor,canadaPostRates,fedexRates,signQuote,mailingDate,safeQuoteError} from '../_lib/shipping.js';
export async function onRequestPost({request,env}){
 if(!checkSameOrigin(request))return error(403,'Invalid request origin');
 if(Number(request.headers.get('content-length')||0)>4500)return error(413,'Request too large');
 let body;try{body=await request.json()}catch{return error(400,'Invalid shipping request')}
 const skus=body?.skus;
 if(!Array.isArray(skus)||!skus.length||skus.length>12||skus.some(s=>typeof s!=='string'||!/^[A-Z0-9-]{2,24}$/.test(s))||new Set(skus).size!==skus.length)return error(400,'Invalid shopping bag');
 // Carrier APIs are a billable/resource-sensitive server capability; never expose them
 // by accident merely because credentials have been entered in Cloudflare.
 if(env.SHIPPING_MODE!=='live_carrier'||env.CARRIER_QUOTES_ENABLED!=='true')
  return error(503,'Live carrier quotes are not yet enabled. Please contact the store for shipping options.');
 if(String(env.SHIPPING_QUOTE_SECRET||'').length<32)return error(503,'Live shipping is not yet configured');
 let to,parcel;try{to=destination(body.destination,env);parcel=parcelFor(env,skus)}catch(e){return error(400,e.message)}
 const shipDate=mailingDate(env.SHIPPING_HANDLING_BUSINESS_DAYS||2);
 // Canada Post Test apps return canned/stub prices; FedEx sandbox is likewise
 // never represented as live postage to public visitors.
 const calls=[
  env.CANADA_POST_TEST_APP==='true'||env.CANADA_POST_API_MODE==='legacy'&&env.CANADA_POST_SANDBOX==='true'
    ?Promise.resolve([]):canadaPostRates(env,to,parcel,shipDate),
  env.FEDEX_SANDBOX==='true'?Promise.resolve([]):fedexRates(env,to,parcel,shipDate)
 ];
 const results=await Promise.allSettled(calls);
 const available=results.flatMap(r=>r.status==='fulfilled'?r.value:[]).filter(r=>r.amount_cents>0&&r.amount_cents<=500000&&r.currency==='CAD'&&/^[A-Z0-9._-]{2,65}$/.test(r.code||'')&&r.name);
 if(!available.length){results.filter(r=>r.status==='rejected').forEach(r=>safeQuoteError(r.reason));return error(503,'No carrier rates are currently available. Contact us to arrange shipping.');}
 const shipping=[];
 for(const rate of available.filter(r=>r.currency==='CAD').sort((a,b)=>a.amount_cents-b.amount_cents).slice(0,12)){
  const payload={v:2,skus:skus.slice().sort(),to,packed:[parcel.weightKg,parcel.lengthCm,parcel.widthCm,parcel.heightCm],ship_date:shipDate,carrier:rate.carrier,code:rate.code,amount_cents:rate.amount_cents,expires:Math.floor(Date.now()/1000)+600,eta:rate.estimated_date||null,name:rate.name.slice(0,65)};
  shipping.push({...rate,quote_token:await signQuote(env,payload)});
 }
 return json({options:shipping,currency:'CAD',ship_date:shipDate,expires_in_seconds:600,disclaimer:to.country==='US'?'Carrier postage only; US customs duties, taxes and brokerage are NOT included. Cross-border checkout remains disabled until fulfilment and duties are approved.':'Live carrier postage for the seller-verified parcel. Carrier delivery times are estimates. Re-enter the same address at checkout; mismatches require manual review.'});
}
