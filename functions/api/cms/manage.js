/* Protected draft / publish workflow. Only a verified manager can publish. */
import {db,json,error,checkSameOrigin,rpc} from '../../_lib/core.js';
import {cmsActor,isManager,validateCmsInput,safeEntry,contentError} from '../../_lib/cms.js';
function keyQuery(kind,key){
 return '?kind=eq.'+encodeURIComponent(kind)+'&item_key=eq.'+encodeURIComponent(key)+'&select=*&limit=1';
}
export async function onRequestPost({request,env}){
 if(!checkSameOrigin(request))return error(403,'Invalid request origin');
 if(Number(request.headers.get('content-length')||0)>22000)return error(413,'Content update too large');
 try{
  const actor=await cmsActor(request,env);
  if(!actor)return error(403,'Authorized editor account required');
  const input=await request.json();
  const action=String(input.action||''),kind=String(input.kind||''),key=String(input.key||'');
  if(!['save','publish','unpublish'].includes(action))return error(400,'Unsupported action');
  // Validate identifiers for all actions, including before service-role reads.
  if(!['product','automobile','set','page'].includes(kind)||!/^[A-Za-z0-9][A-Za-z0-9._-]{1,79}$/.test(key))return error(400,'Invalid content key');
  if(kind==='page'&&!['home','vintage','announcement'].includes(key))return error(400,'Unsupported page');
  const entries=await db(env,'bf_cms_entries',{query:keyQuery(kind,key)});
  const existing=entries?.[0]||null;
  if(action==='save'){
   const data=validateCmsInput(kind,key,input.data,env);
   const expected=Number(input.revision??0);
   if(!Number.isInteger(expected)||expected<0)return error(400,'Invalid revision');
   if(existing){
    if(existing.revision!==expected)return error(409,'Another person changed this entry. Reload before saving.');
    const updated=await db(env,'bf_cms_entries',{
      method:'PATCH',query:'?id=eq.'+encodeURIComponent(existing.id)+'&revision=eq.'+expected+'&select=*',
      body:{draft_data:data,revision:expected+1,updated_by:actor.id,updated_at:new Date().toISOString()}
    });
    if(!updated?.length)return error(409,'This draft was changed by another editor; reload');
    return json({ok:true,entry:safeEntry(updated[0]),notice:'Draft saved. Existing public content remains unchanged until publishing.'});
   }
   if(expected!==0)return error(409,'New draft requires revision zero');
   const inserted=await db(env,'bf_cms_entries',{method:'POST',
     body:{kind,item_key:key,draft_data:data,revision:1,created_by:actor.id,updated_by:actor.id},prefer:'return=representation'});
   return json({ok:true,entry:safeEntry(inserted[0]),notice:'New draft created. It is not visible to shoppers.'});
  }
  if(!isManager(actor))return error(403,'Only a manager or owner can publish or unpublish');
  if(!existing)return error(404,'Save the draft before publishing');
  const revision=Number(input.revision);
  if(!Number.isInteger(revision)||revision!==existing.revision)return error(409,'Refresh this entry before publishing');
  // The database transaction atomically aligns existing product price_cents with its published price.
  const updated=await rpc(env,'bf_cms_publish',{p_kind:kind,p_key:key,p_actor:actor.id,p_revision:revision,p_visible:action==='publish'});
  return json({ok:true,entry:safeEntry(updated),notice:action==='publish'?'Published to the website. Shopping and payment permissions were not changed.':'Content unpublished; source photos and previous versions remain preserved.'});
 }catch(e){const [status,message]=contentError(e);console.error('CMS action',e?.message||'unknown');return error(status,message)}
}
