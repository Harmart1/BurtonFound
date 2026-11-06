import {db,json,error,requireAdmin} from '../../_lib/core.js';
export async function onRequestGet({request,env}){
  try{
    if(!await requireAdmin(request,env))return error(403,'Administrator access required');
    const holds=await db(env,'bf_checkout_holds',{query:'?status=in.(creating,reserved,review)&select=id,item_skus,unit_ids,stripe_session_id,status,expires_at,created_at&order=created_at.desc&limit=80'});
    return json({holds});
  }catch(e){console.error('Holds read failed',e.message);return error(503,'Pending checkout records unavailable')}
}
