import {db,json} from '../_lib/core.js';
export async function onRequestGet({env}){
  if(!env.SUPABASE_URL||!env.SUPABASE_SECRET_KEY)return json({configured:false,items:[]});
  try {const data=await db(env,'bf_public_stock',{query:'?select=sku,price_cents,available&order=sku.asc'});return json({configured:true,items:data});}
  catch {return json({configured:false,items:[],error:'Inventory service unavailable'},503)}
}
