import {db,json,approvedLiveSkus} from '../_lib/core.js';
export async function onRequestGet({env}){
  if(!env.SUPABASE_URL||!env.SUPABASE_SECRET_KEY)return json({configured:false,items:[]});
  try {const data=await db(env,'bf_public_stock',{query:'?select=sku,price_cents,available&order=sku.asc'});const live=String(env.STRIPE_SECRET_KEY||'').startsWith('sk_live_');const approved=live?approvedLiveSkus(env):null;return json({configured:true,items:live?data.map(row=>({...row,checkout_eligible:approved.has(row.sku)})):data});}
  catch {return json({configured:false,items:[],error:'Inventory service unavailable'},503)}
}
