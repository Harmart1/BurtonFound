import {json,error,requireAdmin} from '../../_lib/core.js';

// Authenticated, explicitly allowlisted owners only. No customer details returned.
export async function onRequestGet({request,env}){
  try {
    const user=await requireAdmin(request,env);
    if(!user)return error(403,'Administrator access required');
    return json({admin:true});
  }catch(e){
    console.error('Admin identity check failed',e?.message||'unknown');
    return error(503,'Owner access temporarily unavailable');
  }
}
