import {db,json,error,verifiedUser} from '../_lib/core.js';
export async function onRequestGet({request,env}){
  const user=await verifiedUser(request,env);if(!user)return error(401,'Sign in to see your orders');
  try{const rows=await db(env,'bf_orders',{query:`?customer_id=eq.${encodeURIComponent(user.id)}&select=id,created_at,item_lines,total_cents,payment_status,fulfillment_status,carrier,tracking_number,shipped_at&order=created_at.desc&limit=50`});return json({orders:rows});}
  catch{return error(503,'Order history unavailable')}
}
