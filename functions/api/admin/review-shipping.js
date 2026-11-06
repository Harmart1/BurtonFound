import {rpc,json,error,requireAdmin,checkSameOrigin} from '../../_lib/core.js';
export async function onRequestPost({request,env}){
 if(!checkSameOrigin(request))return error(403,'Invalid request origin');
 if(Number(request.headers.get('content-length')||0)>2300)return error(413,'Request too large');
 try{
   const user=await requireAdmin(request,env);if(!user)return error(403,'Owner access required');
   const body=await request.json();const id=String(body.id||''),note=String(body.note||'').trim();
   if(!/^[0-9a-f-]{36}$/i.test(id)||note.length<20||note.length>1000)return error(400,'Provide a valid order and a detailed 20–1000 character review note');
   const order=await rpc(env,'bf_resolve_shipping_review',{p_order_id:id,p_admin_id:user.id,p_note:note});
   return json({ok:true,order,notice:'Shipping mismatch review recorded. Reconfirm actual postage before shipment.'});
 }catch(e){console.error('Owner shipping review not resolved',e.message);return error(409,'Review cannot be cleared. Verify payment, physical inventory, and the migration before proceeding.');}
}
