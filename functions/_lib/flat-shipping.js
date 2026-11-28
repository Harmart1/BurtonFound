/* Merchant-configured flat rates in CAD; never trust client prices. */
const cents=value=>{const s=String(value??'');return /^\d{1,6}$/.test(s)&&Number(s)>0&&Number(s)<=500000?Number(s):null;};
export function flatRateFor(env,rawCountry='CA'){
  if(env.FLAT_RATE_PRICES_APPROVED==='false'||(String(env.STRIPE_SECRET_KEY||'').startsWith('sk_live_')&&env.FLAT_RATE_PRICES_APPROVED!=='true'))throw Error('Flat-rate shipping prices are awaiting merchant approval.');
  const country=String(rawCountry??'').trim().toUpperCase();
  const allowed=String(env.SHIPPING_ALLOWED_COUNTRIES||'CA').split(',').map(c=>c.trim().toUpperCase());
  if(!['CA','US'].includes(country)||!allowed.includes(country))throw Error('Shipping to this country is not available.');
  // US fulfilment and postal duty/declaration handling are separate commercial approvals.
  if(country==='US'&&(env.US_SHIPPING_APPROVED!=='true'||env.CANADA_POST_US_DUTIES_APPROVED!=='true'))throw Error('US orders require confirmed customs and shipping arrangements. Please contact us.');
  const standard=cents(env['SHIPPING_STANDARD_'+country+'_CENTS']);
  if(standard===null)throw Error('Flat-rate shipping has not been configured for this destination.');
  const express=cents(env['SHIPPING_EXPRESS_'+country+'_CENTS']);
  return {country,standard,express:express!==null&&express>=standard?express:null,label:country==='CA'?'Canada':'United States'};
}
export function flatRateOptions(env){
  return ['CA','US'].flatMap(country=>{try{return [flatRateFor(env,country)]}catch{return []}});
}
