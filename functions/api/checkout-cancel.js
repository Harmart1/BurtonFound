/* A capability is issued only to the browser that started a bound checkout. */
import {boundedJson} from '../_lib/bounded-json.js';
import {json,error,checkSameOrigin,db,rpc,stripe} from '../_lib/core.js';
const idPattern=/^cs_(test|live)_[A-Za-z0-9_]{12,160}$/;
export async function cancellationToken(env,id){
 const secret=env.STRIPE_WEBHOOK_MODE==='live'?env.STRIPE_LIVE_WEBHOOK_SECRET:env.STRIPE_WEBHOOK_SECRET;
 if(!idPattern.test(id)||!secret)throw Error('Cancellation unavailable');
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('bf-checkout-cancel-v1:'+id)));
 return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
}
function same(a,b){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
export async function onRequestPost({request,env}){
 if(!checkSameOrigin(request))return error(403,'Invalid origin');
 let body;try{body=await boundedJson(request,2048)}catch{return error(400,'Invalid cancellation request')}
 const id=body?.session_id,token=body?.cancel_token;
 if(typeof id!=='string'||!idPattern.test(id)||typeof token!=='string'||!(/^[a-f0-9]{64}$/.test(token)))return error(400,'Invalid cancellation request');
 try{
  if(!same(await cancellationToken(env,id),token))return error(403,'Invalid cancellation authorization');
  const live=String(env.STRIPE_SECRET_KEY||'').startsWith('sk_live_');
  if(!id.startsWith(live?'cs_live_':'cs_test_'))return error(409,'Checkout mode changed; contact the store');
  const rows=await db(env,'bf_checkout_holds',{query:'?stripe_session_id=eq.'+encodeURIComponent(id)+'&select=id,status&limit=1'});
  const hold=rows?.[0];if(!hold)return error(404,'Checkout not found');
  if(['expired','released'].includes(hold.status))return json({released:true});
  if(hold.status!=='reserved')return json({released:false,status:'not_releasable'});
  const merchant=await stripe(env,'account',null,'GET');
  if(merchant?.id!==env.STRIPE_EXPECTED_ACCOUNT_ID)return error(503,'Payment merchant unavailable');
  const owns=s=>s?.id===id&&s.livemode===live&&s.metadata?.source==='burton-found'&&s.metadata?.bf_hold_id===hold.id;
  let s=await stripe(env,'checkout/sessions/'+id,null,'GET');
  if(!owns(s))return error(409,'Checkout identity could not be verified');
  if(s.status==='open'&&s.payment_status==='unpaid'){
   try{s=await stripe(env,'checkout/sessions/'+id+'/expire',{},'POST');}
   catch{s=await stripe(env,'checkout/sessions/'+id,null,'GET');}
  }
  if(!owns(s)||s.status!=='expired'||s.payment_status!=='unpaid')return json({released:false,status:'not_releasable'});
  if(await rpc(env,'bf_expire_stripe_session',{p_session_id:id,p_event_id:'customer-cancel:'+id})!==true)throw Error('Release not confirmed');
  return json({released:true});
 }catch{ return error(503,'Cancellation not confirmed. Stock remains protected; try again or contact the store.'); }
}
