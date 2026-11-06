import {db,json,error,requireAdmin} from '../../_lib/core.js';
export async function onRequestGet({request,env}){
  try{if(!await requireAdmin(request,env))return error(403,'Administrator access required');
    const orders=await db(env,'bf_orders',{query:'?select=id,created_at,email,customer_name,item_lines,subtotal_cents,total_cents,shipping_cents,shipping_address,shipping_review_reason,shipping_review_resolved_at,shipping_review_resolution_note,selected_shipping_carrier,selected_shipping_service,selected_shipping_eta,fulfillment_status,carrier,tracking_number,shipped_at,payment_status,customer_id&order=created_at.desc&limit=100'});
    return json({orders});
  }catch(e){console.error('Orders read',e.message);return error(503,'Order dashboard temporarily unavailable')}
}
