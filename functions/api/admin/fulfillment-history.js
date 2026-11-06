import {db,json,error,requireAdmin} from '../../_lib/core.js';
export async function onRequestGet({request,env}){
 const user=await requireAdmin(request,env);if(!user)return error(403,'Administrator access required');
 const id=new URL(request.url).searchParams.get('order_id')||'';
 if(!/^[0-9a-f-]{36}$/i.test(id))return error(400,'Invalid order ID');
 try{
  const events=await db(env,'bf_fulfillment_events',{query:`?order_id=eq.${encodeURIComponent(id)}&select=previous_status,new_status,carrier,tracking_number,created_at&order=created_at.desc&limit=30`});
  return json({events});
 }catch(e){console.error('Fulfillment history read',e.message);return error(503,'History unavailable')}
}
