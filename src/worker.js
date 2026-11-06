/* Cloudflare Workers entry point. Reuses the Pages API handlers; assets are served by ASSETS. */
import {onRequestGet as health} from '../functions/api/health.js';
import {onRequestGet as publicAccountConfig} from '../functions/api/public-account-config.js';
import {onRequestGet as catalog} from '../functions/api/catalog.js';
import {onRequestGet as accountOrders} from '../functions/api/account-orders.js';
import {onRequestGet as checkoutStatus} from '../functions/api/checkout-status.js';
import {onRequestPost as checkout} from '../functions/api/checkout.js';
import {onRequestPost as shippingQuotes} from '../functions/api/shipping-quotes.js';
import {onRequestPost as stripeWebhook} from '../functions/api/stripe-webhook.js';
import {onRequestGet as adminOrders} from '../functions/api/admin/orders.js';
import {onRequestGet as adminHolds} from '../functions/api/admin/holds.js';
import {onRequestGet as fulfillmentHistory} from '../functions/api/admin/fulfillment-history.js';
import {onRequestPost as adminFulfill} from '../functions/api/admin/fulfill.js';
import {onRequestPost as reconcileHold} from '../functions/api/admin/reconcile-hold.js';
import {onRequestPost as reviewShipping} from '../functions/api/admin/review-shipping.js';

const routes = {
  '/api/health': {GET: health},
  '/api/public-account-config': {GET: publicAccountConfig},
  '/api/catalog': {GET: catalog},
  '/api/account-orders': {GET: accountOrders},
  '/api/checkout-status': {GET: checkoutStatus},
  '/api/checkout': {POST: checkout},
  '/api/shipping-quotes': {POST: shippingQuotes},
  '/api/stripe-webhook': {POST: stripeWebhook},
  '/api/admin/orders': {GET: adminOrders},
  '/api/admin/holds': {GET: adminHolds},
  '/api/admin/fulfillment-history': {GET: fulfillmentHistory},
  '/api/admin/fulfill': {POST: adminFulfill},
  '/api/admin/reconcile-hold': {POST: reconcileHold},
  '/api/admin/review-shipping': {POST: reviewShipping}
};

const response = (message,status,headers={})=>new Response(JSON.stringify({error:message}),{
  status,
  headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...headers}
});

export default {
  async fetch(request,env,ctx){
    const path=new URL(request.url).pathname;
    if(!path.startsWith('/api/')){
      if(!env.ASSETS?.fetch)return response('Static asset binding missing',503);
      return env.ASSETS.fetch(request);
    }
    const methods=Object.hasOwn(routes,path)?routes[path]:null;
    if(!methods)return response('API endpoint not found',404);
    const handler=methods[request.method];
    if(!handler)return response('Method not allowed',405,{allow:Object.keys(methods).join(', ')});
    try {return await handler({request,env,ctx});}
    catch(e){
      console.error('API failure',path,e?.message||'unknown');
      return response('Service temporarily unavailable',503);
    }
  }
};
