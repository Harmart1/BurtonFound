/* Publish only the Supabase project URL and publishable key. Never expose secret/service role keys. */
import {json} from '../_lib/core.js';
export const onRequestGet=({env})=>{
  const url=String(env.SUPABASE_URL||'');
  const key=String(env.SUPABASE_PUBLISHABLE_KEY||'');
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url)||!/^(sb_publishable_[\w-]+|eyJ[\w.-]+)$/.test(key))return json({configured:false},200);
  return json({configured:true,supabaseUrl:url,supabasePublishableKey:key});
};
