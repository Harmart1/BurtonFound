import {db,json,error,requireAdmin} from '../../_lib/core.js';
const date=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
export async function onRequestGet({request,env}){
 try{
  if(!await requireAdmin(request,env))return error(403,'Administrator access required');
  const q=new URL(request.url).searchParams,from=q.get('from'),to=q.get('to');
  if(!date(from)||!date(to)||from>to||Date.parse(to)-Date.parse(from)>366*86400000)return error(400,'Choose a valid UTC date range of up to 367 days');
  const end=new Date(Date.parse(to)+86400000).toISOString();
  const fields='id,created_at,stripe_session_id,payment_intent,subtotal_cents,shipping_cents,total_cents,payment_status,fulfillment_status';
  // Deliberately bounded, no customer names, emails or addresses. Reject a
  // truncated export rather than silently present it as a full accounting period.
  const rows=[];
  for(let offset=0;offset<=5000;offset+=500){
   const page=await db(env,'bf_orders',{query:'?select='+fields+'&created_at=gte.'+encodeURIComponent(from+'T00:00:00Z')+'&created_at=lt.'+encodeURIComponent(end)+'&order=created_at.asc,id.asc&limit=500&offset='+offset});
   if(!Array.isArray(page))throw Error('Invalid order response');
   rows.push(...page);
   if(rows.length>5000)return error(422,'More than 5,000 orders; choose a shorter date range');
   if(page.length<500)break;
  }
  if(new Set(rows.map(x=>x.id)).size!==rows.length)return error(409,'Orders changed while reading; refresh and retry');
  const orders=rows.map(r=>({
   id:r.id,created_at:r.created_at,stripe_session_id:r.stripe_session_id,payment_intent:r.payment_intent,
   subtotal_cents:r.subtotal_cents,shipping_cents:r.shipping_cents,total_cents:r.total_cents,
   payment_status:r.payment_status,fulfillment_status:r.fulfillment_status
  }));
  return json({from,to,timezone:'UTC',orders});
 }catch{ return error(503,'Bookkeeping report temporarily unavailable');}
}
