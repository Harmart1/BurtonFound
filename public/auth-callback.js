/* First-party auth callback routing. No network requests, logging or storage. */
(()=>{
'use strict';
function inspect(href){
 const u=new URL(href),f=new URLSearchParams(u.hash.slice(1)),q=u.searchParams;
 const type=f.get('type')||q.get('type')||'';
 const error=f.has('error')||f.has('error_code')||q.has('error')||q.has('error_code');
 const access=f.get('access_token')||'';
 return {callback:error||!!access||q.has('code')||q.has('token_hash'),recovery:type==='recovery',error,access};
}
function accountUrl(href){return new URL('/account',href).href;}
function forward(href){
 const u=new URL(href),s=inspect(href);
 if(!s.callback||['/account','/account/','/account.html'].includes(u.pathname))return null;
 // Only forward explicit Supabase callback parameters; never an arbitrary URL.
 const target=new URL('/account',u.origin);
 for(const k of ['code','type','token_hash','error','error_code','error_description'])if(u.searchParams.has(k))target.searchParams.set(k,u.searchParams.get(k));
 target.hash=u.hash;
 return target.href;
}
window.BURTON_AUTH_CALLBACK=Object.freeze({inspect,accountUrl,forward});
const dest=forward(location.href);
if(dest)location.replace(dest);
})();
