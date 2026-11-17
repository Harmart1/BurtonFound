/* Public, read-only site content. Never exposes drafts, staff identifiers or customer records. */
import {db,json} from '../../_lib/core.js';
export async function onRequestGet({env}){
 try{
  const entries=await db(env,'bf_cms_entries',{query:'?select=kind,item_key,published_data,revision,published_at&is_published=eq.true&order=kind.asc,item_key.asc&limit=450'});
  return json({entries:(entries||[]).filter(x=>x.published_data&&['product','automobile','set','page'].includes(x.kind)).map(x=>({kind:x.kind,key:x.item_key,data:x.published_data,revision:x.revision,publishedAt:x.published_at}))},
   200,{'cache-control':'public, max-age=20'});
 }catch(e){console.error('Published CMS read',e?.message||'unknown');return json({entries:[],unavailable:true},503)}
}
