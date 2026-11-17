/* Validated image uploads into a dedicated public-media bucket; drafts aren't linked publicly. */
import {json,error,checkSameOrigin} from '../../_lib/core.js';
import {cmsActor} from '../../_lib/cms.js';
export async function onRequestPost({request,env}){
 if(!checkSameOrigin(request))return error(403,'Invalid upload origin');
 const size=Number(request.headers.get('content-length')||0);
 if(size>5242880)return error(413,'Maximum image size is 5 MB');
 try{
  const actor=await cmsActor(request,env);
  if(!actor)return error(403,'Authorized editor required');
  const content=await request.arrayBuffer();
  if(content.byteLength<100||content.byteLength>5242880)return error(413,'Image must be between 100 bytes and 5 MB');
  const b=new Uint8Array(content);
  const webp=String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP';
  const png=b.slice(0,8).every((x,i)=>x===[137,80,78,71,13,10,26,10][i]);
  const jpeg=b[0]===255&&b[1]===216&&b[2]===255;
  if(!webp&&!png&&!jpeg)return error(415,'Only actual JPEG, PNG or WebP photographs are accepted');
  const type=webp?'image/webp':png?'image/png':'image/jpeg',ext=webp?'webp':png?'png':'jpg';
  const filename='catalogue/'+crypto.randomUUID()+'.'+ext;
  const base=env.SUPABASE_URL.replace(/\/$/,'');
  const secret=env.SUPABASE_SECRET_KEY||'';
  if(!secret)return error(503,'Image storage is not configured');
  const headers={'apikey':secret,'content-type':type,'cache-control':'3600','x-upsert':'false'};
  if(!secret.startsWith('sb_secret_'))headers.authorization='Bearer '+secret;
  const res=await fetch(base+'/storage/v1/object/bf-cms-media/'+filename,{method:'POST',headers,body:content});
  if(!res.ok){console.error('CMS image storage',res.status);return error(503,'Photo storage failed; try again')}
  return json({ok:true,url:base+'/storage/v1/object/public/bf-cms-media/'+filename,
    note:'Uploaded photograph has a public URL; avoid private documents and customer images.'});
 }catch(e){console.error('CMS photo',e?.message||'unknown');return error(503,'Photo could not be uploaded')}
}
