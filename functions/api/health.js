import {json,secure} from '../_lib/core.js';
export const onRequestGet=({env})=>{
  const enabled=secure(env);
  const mode=enabled?(String(env.STRIPE_SECRET_KEY).startsWith('sk_test_')?'test_mode':'live_mode'):'preview_only';
  return json({service:'Burton & Found',checkout:mode,currency:'CAD',shippingCountries:String(env.SHIPPING_ALLOWED_COUNTRIES||'CA').split(',').map(s=>s.trim()).filter(Boolean),shippingMode:enabled&&env.SHIPPING_MODE==='live_carrier'&&env.CARRIER_QUOTES_ENABLED==='true'?'live_carrier':'flat_rate',note:mode==='test_mode'?'TEST PAYMENTS ONLY · no real charges':mode==='live_mode'?'Live Stripe checkout configured':'Payments disabled until owner configuration is complete'});
};
