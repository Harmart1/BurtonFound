import {boundedJson} from '../_lib/bounded-json.js';
import {json,error,checkSameOrigin,secure,rpc} from '../_lib/core.js';
export const events=new Set(['page_view','add_to_bag','checkout_open']);
export const collections=new Set(['home','coca-cola','hollywood','automobiles','sets','guides','other']);
export function validActivity(v){return !!v&&Object.keys(v).length===2&&events.has(v.event)&&collections.has(v.collection);}
export async function onRequestPost({request,env}){
 if(!checkSameOrigin(request))return error(403,'Invalid origin');
 if(request.headers.get('Sec-GPC')==='1'||request.headers.get('DNT')==='1')return new Response(null,{status:204});
 if(env.MARKETING_INDEXING_APPROVED!=='true'||env.STRIPE_WEBHOOK_MODE!=='live'||!secure(env))return new Response(null,{status:204});
 let body;try{body=await boundedJson(request,256);}catch{return error(400,'Invalid activity');}
 if(!validActivity(body))return error(400,'Invalid activity');
 const ip=request.headers.get('CF-Connecting-IP');
 if(!ip||ip.length>64||!/^[0-9a-f:.]+$/i.test(ip)||!env.BF_QUOTE_LIMIT?.limit)return new Response(null,{status:204});
 try{
  if((await env.BF_QUOTE_LIMIT.limit({key:'bf-activity:'+ip})).success!==true)return new Response(null,{status:204});
  await rpc(env,'bf_count_activity',{p_event:body.event,p_collection:body.collection});
 }catch{/* Optional analytics never interrupts commerce. */}
 return new Response(null,{status:204,headers:{'cache-control':'no-store'}});
}
