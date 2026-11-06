import {db,json,error} from '../_lib/core.js';
export async function onRequestGet({request,env}){
  const id=new URL(request.url).searchParams.get('session_id')||'';
  if(!/^cs_(test|live)_[A-Za-z0-9_]{12,160}$/.test(id))return error(400,'Invalid order reference');
  try{const rows=await db(env,'bf_checkout_public_status',{query:`?stripe_session_id=eq.${encodeURIComponent(id)}&select=status,order_ref&limit=1`});
    if(!rows?.length)return json({status:'processing'});return json(rows[0]);}
  catch{return error(503,'Order lookup temporarily unavailable')}
}
