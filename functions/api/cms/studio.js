/* Authenticated editorial workspace. Team data and drafts are never public. */
import {db,json,error} from '../../_lib/core.js';
import {cmsActor,isOwner,safeEntry} from '../../_lib/cms.js';
export async function onRequestGet({request,env}){
 try {
  const actor=await cmsActor(request,env);
  if(!actor)return error(403,'Studio access requires an authorized, confirmed account');
  const entries=await db(env,'bf_cms_entries',{query:'?select=*&order=updated_at.desc&limit=450'});
  let members=null;
  if(isOwner(actor))members=await db(env,'bf_cms_members',{query:'?select=user_id,role,active,granted_at,updated_at&order=granted_at.desc&limit=50'});
  return json({actor:{role:actor.role,email:actor.email},entries:(entries||[]).map(safeEntry),members});
 }catch(e){console.error('Studio read failed',e?.message||'unknown');return error(503,'Private studio temporarily unavailable')}
}
