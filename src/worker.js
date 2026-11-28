/* Cloudflare Workers entry point. Reuses the Pages API handlers; assets are served by ASSETS. */
import {onRequestGet as health} from '../functions/api/health.js';
import {onRequestGet as publicAccountConfig} from '../functions/api/public-account-config.js';
import {onRequestGet as merchantFeed} from '../functions/api/merchant-feed.js';
import {onRequestGet as catalog} from '../functions/api/catalog.js';
import {onRequestGet as accountOrders} from '../functions/api/account-orders.js';
import {onRequestGet as checkoutStatus} from '../functions/api/checkout-status.js';
import {onRequestPost as checkoutCancel} from '../functions/api/checkout-cancel.js';
import {onRequestPost as checkout} from '../functions/api/checkout.js';
import {onRequestPost as shippingQuotes} from '../functions/api/shipping-quotes.js';
import {onRequestPost as stripeWebhook} from '../functions/api/stripe-webhook.js';
import {onRequestGet as adminMe} from '../functions/api/admin/me.js';
import {onRequestGet as adminReadiness} from '../functions/api/admin/readiness.js';
import {onRequestGet as bookkeeping} from '../functions/api/admin/bookkeeping.js';
import {onRequestGet as stripeReconciliation} from '../functions/api/admin/stripe-reconciliation.js';
import {onRequestGet as adminOrders} from '../functions/api/admin/orders.js';
import {onRequestGet as adminHolds} from '../functions/api/admin/holds.js';
import {onRequestGet as fulfillmentHistory} from '../functions/api/admin/fulfillment-history.js';
import {onRequestPost as adminFulfill} from '../functions/api/admin/fulfill.js';
import {onRequestPost as reconcileHold} from '../functions/api/admin/reconcile-hold.js';
import {onRequestPost as reviewShipping} from '../functions/api/admin/review-shipping.js';
import {onRequestGet as cmsPublished} from '../functions/api/cms/published.js';
import {onRequestGet as cmsStudio} from '../functions/api/cms/studio.js';
import {onRequestPost as cmsManage} from '../functions/api/cms/manage.js';
import {onRequestPost as cmsTeam} from '../functions/api/cms/team.js';
import {onRequestPost as cmsMedia} from '../functions/api/cms/media.js';

import {commerceProtection} from './commerce-protection.js';
import {sitemapXml,robotsText} from './seo-assets.generated.js';

import {onRequestPost as activity} from '../functions/api/activity.js';
import {onRequestGet as adminActivity} from '../functions/api/admin/activity.js';
const routes = {
  '/api/activity': {POST: activity},
  '/api/admin/activity': {GET: adminActivity},
  '/api/health': {GET: health},
  '/api/public-account-config': {GET: publicAccountConfig},
  '/api/catalog': {GET: catalog},
  '/api/account-orders': {GET: accountOrders},
  '/api/checkout-status': {GET: checkoutStatus},
  '/api/checkout': {POST: checkout},
  '/api/checkout-cancel': {POST: checkoutCancel},
  '/api/shipping-quotes': {POST: shippingQuotes},
  '/api/stripe-webhook': {POST: stripeWebhook},
  '/api/admin/me': {GET: adminMe},
  '/api/admin/readiness': {GET: adminReadiness},
  '/api/admin/orders': {GET: adminOrders},
  '/api/admin/bookkeeping': {GET: bookkeeping},
  '/api/admin/stripe-reconciliation': {GET: stripeReconciliation},
  '/api/admin/holds': {GET: adminHolds},
  '/api/admin/fulfillment-history': {GET: fulfillmentHistory},
  '/api/admin/fulfill': {POST: adminFulfill},
  '/api/admin/reconcile-hold': {POST: reconcileHold},
  '/api/admin/review-shipping': {POST: reviewShipping},
  '/api/cms/published': {GET: cmsPublished},
  '/api/cms/studio': {GET: cmsStudio},
  '/api/cms/manage': {POST: cmsManage},
  '/api/cms/team': {POST: cmsTeam},
  '/api/cms/media': {POST: cmsMedia}
};

const response = (message,status,headers={})=>new Response(JSON.stringify({error:message}),{
  status,
  headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...headers}
});

// Keep test credentials intact while production credentials are staged independently.
// Never fall back to a sandbox API key when live mode is selected.
export function paymentEnvironment(env){
 if(env.STRIPE_WEBHOOK_MODE!=='live')return env;
 const ready=/^sk_live_[A-Za-z0-9]+$/.test(env.STRIPE_LIVE_SECRET_KEY||'')&&/^whsec_/.test(env.STRIPE_LIVE_WEBHOOK_SECRET||'');
 return {...env,STRIPE_SECRET_KEY:ready?env.STRIPE_LIVE_SECRET_KEY:''};
}
export default {
  async fetch(request,env,ctx){
    env=paymentEnvironment(env);
    const path=new URL(request.url).pathname;
    if(path==='/merchant-feed.xml'){
      if(!['GET','HEAD'].includes(request.method))return response('Method not allowed',405,{allow:'GET, HEAD'});
      return merchantFeed({request,env,ctx});
    }
    if(path==='/sitemap.xml'||path==='/robots.txt'){
      if(!['GET','HEAD'].includes(request.method))return response('Method not allowed',405,{allow:'GET, HEAD'});
      const sitemap=path==='/sitemap.xml';
      const headers={'content-type':sitemap?'application/xml; charset=utf-8':'text/plain; charset=utf-8','cache-control':'public, max-age=300','x-content-type-options':'nosniff'};
      if(env.MARKETING_INDEXING_APPROVED!=='true')headers['x-robots-tag']='noindex';
      return new Response(request.method==='HEAD'?null:sitemap?sitemapXml:robotsText,{status:200,headers});
    }
    if(!path.startsWith('/api/')){
      if(!env.ASSETS?.fetch)return response('Static asset binding missing',503);
      return env.ASSETS.fetch(request);
    }
    const methods=Object.hasOwn(routes,path)?routes[path]:null;
    if(!methods)return response('API endpoint not found',404);
    const handler=methods[request.method];
    if(!handler)return response('Method not allowed',405,{allow:Object.keys(methods).join(', ')});
    try {
      const blocked=await commerceProtection(request,env,path);
      if(blocked)return blocked;
      return await handler({request,env,ctx});
    }
    catch(e){
      console.error('API failure',path,e?.message||'unknown');
      return response('Service temporarily unavailable',503);
    }
  }
};
