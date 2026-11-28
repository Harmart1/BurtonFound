import {db,json,error,requireAdmin} from '../../_lib/core.js';
import {events,collections} from '../activity.js';
export async function onRequestGet({request,env}){
 try{
  if(!await requireAdmin(request,env))return error(403,'Administrator access required');
  const today=new Date().toISOString().slice(0,10),from=new Date(Date.parse(today)-29*86400000).toISOString().slice(0,10);
  const rows=await db(env,'bf_daily_activity',{query:'?select=day,event,collection,count&day=gte.'+from+'&day=lte.'+today+'&order=day.asc&limit=630'});
  if(!Array.isArray(rows)||rows.length>630||rows.some(r=>!/^\d{4}-\d{2}-\d{2}$/.test(r.day)||!events.has(r.event)||!collections.has(r.collection)||!Number.isSafeInteger(r.count)||r.count<0))throw Error('Invalid aggregate data');
  const totals={page_view:0,add_to_bag:0,checkout_open:0},byCollection={};
  for(const r of rows){totals[r.event]+=r.count;const c=byCollection[r.collection]??={page_view:0,add_to_bag:0,checkout_open:0};c[r.event]+=r.count;}
  return json({from,to:today,timezone:'UTC',totals,byCollection,rows});
 }catch{return error(503,'Activity report unavailable');}
}
