/* An owner may request reconciliation, but only Stripe's own EXPIRED status permits release. */
import {db,json,error,requireAdmin,checkSameOrigin,stripe,rpc} from '../../_lib/core.js';
export async function onRequestPost({request,env}){
 if(!checkSameOrigin(request))return error(403,'Invalid origin');
 try{
  if(!await requireAdmin(request,env))return error(403,'Administrator access required');
  const body=await request.json();const id=String(body?.id||'');
  if(!/^[0-9a-f-]{36}$/i.test(id))return error(400,'Invalid checkout ID');
  const rows=await db(env,'bf_checkout_holds',{query:`?id=eq.${encodeURIComponent(id)}&select=id,status,stripe_session_id&limit=1`});
  if(!rows.length)return error(404,'Checkout hold not found');
  const hold=rows[0];
  if(hold.status!=='reserved')return json({released:false,message:`Hold is ${hold.status}. Review manually in Stripe; no automatic release.`});
  if(!/^cs_(test|live)_[A-Za-z0-9_]{12,160}$/.test(hold.stripe_session_id||''))return error(409,'Stripe session not attached; manual investigation required');
  const session=await stripe(env,`checkout/sessions/${encodeURIComponent(hold.stripe_session_id)}`,null,'GET');
  if(session.id!==hold.stripe_session_id)return error(409,'Stripe returned an unexpected session');
  if(session.status!=='expired'||session.payment_status==='paid')return json({released:false,session_status:session.status,payment_status:session.payment_status,message:'Not released. Stripe has not confirmed this checkout expired without payment.'});
  await rpc(env,'bf_expire_stripe_session',{p_session_id:session.id,p_event_id:`owner-verified-expired:${session.id}`});
  return json({released:true,message:'Stripe confirmed this unpaid session expired. Its reservation has been released.'});
 }catch(e){console.error('Hold reconciliation failed',e.message);return error(503,'Could not verify this checkout with Stripe. Inventory remains reserved.')}
}
