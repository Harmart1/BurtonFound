import {secure,approvedLiveSkus,db} from '../_lib/core.js';
import {flatRateFor} from '../_lib/flat-shipping.js';
import {merchantCatalog} from '../../src/merchant-catalog.generated.js';
const xml=v=>String(v??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const tag=(k,v)=>'<g:'+k+'>'+xml(v)+'</g:'+k+'>';
const money=c=>(c/100).toFixed(2)+' CAD';
export function feedRows(candidates,stock,approved,shipping){
 if(!Array.isArray(stock)||!Array.isArray(candidates)||!Number.isSafeInteger(shipping)||shipping<=0)throw Error('Invalid feed snapshot');
 const rows=new Map();
 for(const r of stock){
  if(!/^[A-Z0-9-]{2,24}$/.test(r?.sku||'')||rows.has(r.sku)||typeof r.available!=='boolean'||!Number.isSafeInteger(r.price_cents)||r.price_cents<=0)throw Error('Invalid stock row');
  rows.set(r.sku,r);
 }
 if([...approved].some(s=>!rows.has(s)))throw Error('Incomplete approved stock snapshot');
 return candidates.filter(p=>approved.has(p.sku)&&rows.get(p.sku)?.price_cents===p.price_cents).map(p=>{
  if(!/^https:\/\/burtonandfound\.ca\/products\/[a-z0-9-]+$/.test(p.link)||!/^https:\/\/burtonandfound\.ca\/assets\/images\//.test(p.image)||p.condition!=='used'||!p.title||!p.description)throw Error('Invalid candidate metadata');
  const r=rows.get(p.sku);
  return '<item>'+tag('id',p.sku)+tag('title',p.title)+tag('description',p.description)+tag('link',p.link)+tag('image_link',p.image)+tag('price',money(r.price_cents))+tag('availability',r.available?'in_stock':'out_of_stock')+tag('condition','used')+tag('identifier_exists','no')+'<g:shipping>'+tag('country','CA')+tag('service','Standard tracked shipping')+tag('price',money(shipping))+'</g:shipping></item>';
 });
}
export async function onRequestGet({env,request}){
 const headers={'content-type':'application/xml; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','x-robots-tag':'noindex'};
 if(env.MARKETING_INDEXING_APPROVED!=='true'||env.STRIPE_WEBHOOK_MODE!=='live'||!/^sk_live_/.test(env.STRIPE_SECRET_KEY||'')||!secure(env)||env.SHIPPING_MODE!=='flat_rate'||env.SHIPPING_ALLOWED_COUNTRIES!=='CA'||env.STRIPE_AUTOMATIC_TAX!=='false')return new Response('Feed unavailable',{status:503,headers:{'cache-control':'no-store'}});
 try{
  const approved=approvedLiveSkus(env);
  const stock=await db(env,'bf_public_stock',{query:'?select=sku,price_cents,available&order=sku.asc'});
  const items=feedRows(merchantCatalog,stock,approved,flatRateFor(env,'CA').standard);
  if(!items.length)throw Error('No eligible products');
  return new Response(request?.method==='HEAD'?null:'<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>Burton and Found — Canadian collectibles</title><link>https://burtonandfound.ca/</link><description>Current Canadian product catalogue</description>'+items.join('\n')+'</channel></rss>',{headers});
 }catch{return new Response('Feed temporarily unavailable',{status:503,headers:{'cache-control':'no-store'}});}
}
