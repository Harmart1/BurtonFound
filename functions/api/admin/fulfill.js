import {json,error,requireAdmin,checkSameOrigin,rpc} from '../../_lib/core.js';
export async function onRequestPost({request,env}){
  if(!checkSameOrigin(request))return error(403,'Invalid origin');
  if(Number(request.headers.get('content-length')||0)>4096)return error(413,'Request too large');
  try{
    const user=await requireAdmin(request,env);
    if(!user)return error(403,'Administrator access required');
    const v=await request.json();
    const id=String(v.id||''),status=String(v.status||'');
    const carrier=String(v.carrier||''),tracking=String(v.tracking_number||'');
    if(!/^[0-9a-f-]{36}$/i.test(id)||!['processing','packed','shipped','delivered','needs_attention'].includes(status)||carrier.length>50||tracking.length>100)return error(400,'Invalid update');
    if(['shipped','delivered'].includes(status)&&(!carrier.trim()||!tracking.trim()))return error(400,'Carrier and tracking required');
    const order=await rpc(env,'bf_update_fulfillment',{p_order_id:id,p_status:status,p_carrier:carrier,p_tracking:tracking,p_admin_id:user.id});
    return json({ok:true,order,notice:'Saved with fulfillment audit history. Send the customer update separately.'});
  }catch(e){console.error('Fulfillment error',e.message);return error(503,'Could not update order; check owner access and database migration 002')}
}
