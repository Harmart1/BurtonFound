import {json,secure} from '../functions/_lib/core.js';
// Cloudflare's edge counters are approximate, per location, and are not a
// global quota. Use the platform-provided address for anonymous guest traffic;
// do not accept X-Forwarded-For, browser-supplied IDs, or arbitrary headers.
export const limits=Object.freeze({
 '/api/admin/test-checkout':{binding:'BF_CHECKOUT_LIMIT',enabled:env=>env.OWNER_TEST_CHECKOUT_ENABLED==='true'},
 '/api/checkout':{binding:'BF_CHECKOUT_LIMIT',enabled:env=>secure(env)},
 '/api/shipping-quotes':{binding:'BF_QUOTE_LIMIT',enabled:env=>env.SHIPPING_MODE==='live_carrier'&&env.CARRIER_QUOTES_ENABLED==='true'}
});
export async function commerceProtection(request,env,path){
 const rule=limits[path];
 if(request.method!=='POST'||!rule||!rule.enabled(env))return null;
 const limiter=env[rule.binding],address=request.headers.get('CF-Connecting-IP');
 if(!limiter?.limit||!address||address.length>64||!(/^[0-9a-f:.]+$/i.test(address)))
  return json({error:'Service temporarily unavailable. Please try again later.'},503);
 try{
  const result=await limiter.limit({key:'burtonfound:'+address});
  if(result?.success===true)return null;
  if(result?.success===false)return json({error:'Too many requests. Please wait a minute and try again.'},429,{'retry-after':'60'});
 }catch{}
 return json({error:'Service temporarily unavailable. Please try again later.'},503);
}
