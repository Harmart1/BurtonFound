/* Cloudflare Pages Functions: private server-side helpers, never imported by browser code. */
export const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...headers}});
export const error=(status,message)=>json({error:message},status);
export function hasVerifiedPackages(env){
  try{
    const profiles=JSON.parse(env.SHIPPING_PACKAGES_JSON||'{}');
    return Object.values(profiles).some(p=>p&&p.verified===true&&[p.weightKg,p.lengthCm,p.widthCm,p.heightCm].every(v=>Number.isFinite(Number(v))&&Number(v)>0));
  }catch{return false}
}
export function secure(env){return !!(env.SUPABASE_URL&&env.SUPABASE_SECRET_KEY&&/^sk_(test|live)_/.test(env.STRIPE_SECRET_KEY||'')&&/^whsec_/.test(env.STRIPE_WEBHOOK_SECRET||'')&&(env.SHIPPING_MODE==='live_carrier'?(env.CARRIER_QUOTES_ENABLED==='true'&&String(env.SHIPPING_QUOTE_SECRET||'').length>=32&&hasVerifiedPackages(env)&&(env.CANADA_POST_USERNAME&&env.CANADA_POST_PASSWORD||env.FEDEX_CLIENT_ID&&env.FEDEX_CLIENT_SECRET&&env.FEDEX_ACCOUNT_NUMBER)&&!(String(env.STRIPE_SECRET_KEY).startsWith('sk_live_')&&(env.CANADA_POST_SANDBOX==='true'||env.FEDEX_SANDBOX==='true'))):env.SHIPPING_STANDARD_CA_CENTS)&&env.TAX_CONFIGURATION_APPROVED==='true'&&env.LIVE_CHECKOUT_ENABLED==='true');}
export function requireDb(env){if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(env.SUPABASE_URL||'')||!(env.SUPABASE_SECRET_KEY||'').trim())throw Error('Database is not configured');}
export async function db(env,table,{method='GET',query='',body,prefer='return=representation'}={}){
  requireDb(env);
  const key=env.SUPABASE_SECRET_KEY;const headers={apikey:key,'Content-Type':'application/json',Prefer:prefer};
  // Modern sb_secret keys are opaque and must NOT be sent as Bearer JWTs.
  if(!key.startsWith('sb_secret_'))headers.Authorization=`Bearer ${key}`;
  const res=await fetch(`${env.SUPABASE_URL.replace(/\/$/,'')}/rest/v1/${table}${query}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  const raw=await res.text();let result;try{result=raw?JSON.parse(raw):null;}catch{result=raw;}
  if(!res.ok){console.error('Database request failed',table,res.status,result?.code||'unknown');throw Error(`Database operation failed (${res.status})`);}return result;
}
export const rpc=(env,name,args)=>db(env,`rpc/${name}`,{method:'POST',body:args});
export async function verifiedUser(request,env){
  const auth=request.headers.get('authorization')||'';if(!/^Bearer \S+$/.test(auth))return null;
  if(!env.SUPABASE_URL||!env.SUPABASE_PUBLISHABLE_KEY)return null;
  const res=await fetch(`${env.SUPABASE_URL.replace(/\/$/,'')}/auth/v1/user`,{headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,authorization:auth}});
  if(!res.ok)return null;const user=await res.json();return /^[0-9a-f-]{36}$/i.test(user?.id||'')?user:null;
}
export async function requireAdmin(request,env){
  const user=await verifiedUser(request,env);if(!user)return null;
  const admin=await db(env,'bf_admin_users',{query:`?user_id=eq.${encodeURIComponent(user.id)}&select=user_id&limit=1`});
  return Array.isArray(admin)&&admin.length?user:null;
}
export async function stripe(env,path,fields,method='POST',extraHeaders={}){
  if(!/^sk_(test|live)_/.test(env.STRIPE_SECRET_KEY||''))throw Error('Stripe is not configured');
  const url=`https://api.stripe.com/v1/${path}`;
  const h={Authorization:`Bearer ${env.STRIPE_SECRET_KEY}`,...extraHeaders};
  const options={method,headers:h};if(fields){h['Content-Type']='application/x-www-form-urlencoded';options.body=new URLSearchParams(fields).toString();}
  const res=await fetch(url,options);let data;try{data=await res.json()}catch{data={error:{message:'Invalid Stripe response'}}}
  if(!res.ok)throw Error(`Stripe: ${data?.error?.message||res.status}`);return data;
}
export function safeReturnUrl(request){const u=new URL(request.url);return `${u.protocol}//${u.host}`;}
export function checkSameOrigin(request){const origin=request.headers.get('origin');if(!origin)return false;try{return new URL(origin).origin===new URL(request.url).origin}catch{return false}}
function hex(bytes){return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('')}
function constantEqual(a,b){if(a.length!==b.length)return false;let v=0;for(let i=0;i<a.length;i++)v|=a.charCodeAt(i)^b.charCodeAt(i);return v===0}
export async function verifyStripe(payload,signature,secret,now=Math.floor(Date.now()/1000)){
  const values=String(signature||'').split(',').map(x=>x.trim().split('='));
  const t=Number(values.find(x=>x[0]==='t')?.[1]);if(!Number.isInteger(t)||Math.abs(now-t)>300)return false;
  const signatures=values.filter(x=>x[0]==='v1').map(x=>x[1]);if(!signatures.length)return false;
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const digest=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${t}.${payload}`));const expected=hex(new Uint8Array(digest));
  return signatures.some(s=>constantEqual(s,expected));
}
