/* Only pre-authorized site owners can grant/remove studio access. */
import {db,json,error,checkSameOrigin} from '../../_lib/core.js';
import {cmsActor,isOwner} from '../../_lib/cms.js';
const EMAIL=/^[^@\s]{1,64}@[^@\s]+\.[^@\s]+$/;
async function lookupUser(env,email){
 const headers={apikey:env.SUPABASE_SECRET_KEY};
 if(!String(env.SUPABASE_SECRET_KEY||'').startsWith('sb_secret_'))headers.authorization='Bearer '+env.SUPABASE_SECRET_KEY;
 for(let page=1;page<=15;page++){
  const r=await fetch(env.SUPABASE_URL.replace(/\/$/,'')+'/auth/v1/admin/users?page='+page+'&per_page=100',{headers,cache:'no-store'});
  if(!r.ok)throw Error('Account lookup unavailable');
  const data=await r.json(),users=Array.isArray(data.users)?data.users:[];
  const match=users.find(x=>String(x.email||'').toLowerCase()===email);
  if(match)return match;
  if(users.length<100)break;
 }
 return null;
}
export async function onRequestPost({request,env}){
 if(!checkSameOrigin(request))return error(403,'Invalid request origin');
 if(Number(request.headers.get('content-length')||0)>3000)return error(413,'Invalid request');
 try{
  const actor=await cmsActor(request,env);
  if(!isOwner(actor))return error(403,'Only the confirmed owner can manage staff');
  const v=await request.json(),email=String(v.email||'').trim().toLowerCase(),action=String(v.action||'');
  if(!EMAIL.test(email)||email.length>254||!['grant','revoke'].includes(action))return error(400,'Enter a valid staff email and action');
  const target=await lookupUser(env,email);
  if(!target||!target.email_confirmed_at||target.is_anonymous)return error(404,'This person must first sign up and confirm their email on the website');
  const owner=await db(env,'bf_admin_users',{query:'?user_id=eq.'+encodeURIComponent(target.id)+'&select=user_id&limit=1'});
  if(owner?.length)return error(403,'Owner permissions cannot be changed by the studio');
  if(action==='grant'){
   const role=String(v.role||'');
   if(!['editor','manager'].includes(role))return error(400,'Choose Editor or Manager');
   const members=await db(env,'bf_cms_members',{method:'POST',query:'?on_conflict=user_id',
     body:{user_id:target.id,role,active:true,granted_by:actor.id,updated_at:new Date().toISOString()},
     prefer:'resolution=merge-duplicates,return=representation'});
   return json({ok:true,role:members?.[0]?.role||role,notice:'Verified account authorized. They can now sign in using their own password.'});
  }
  await db(env,'bf_cms_members',{method:'PATCH',query:'?user_id=eq.'+encodeURIComponent(target.id),
   body:{active:false,updated_at:new Date().toISOString()},prefer:'return=representation'});
  return json({ok:true,notice:'Studio access revoked. Do not share owner passwords.'});
 }catch(e){console.error('Team access request',e?.message||'unknown');return error(503,'Could not update team access')}
}
