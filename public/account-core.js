/* Burton & Found Collector Accounts — static-site compatible, Supabase Auth + RLS.
   ONLY a public (publishable/anon) Supabase key belongs in config.js.
   If no backend is configured, guest watchlists + bags remain in this browser;
   registration is NOT simulated or falsely marked successful. */
(()=>{
  'use strict';
  const cfg=window.BURTON_CONFIG||{};
  let readyToConnect=/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test((cfg.supabaseUrl||'').trim()) && /^(sb_publishable_[\w-]+|eyJ[\w.-]+)$/.test((cfg.supabasePublishableKey||'').trim());
  const keyWatch='bf_guest_watches',keyBags='bf_guest_saved_bags',keyCart='burton_found_bag';
  const items=window.BURTON_DATA?.inventory||[];
  const known=new Set(items.map(p=>p.sku));
  const sanitizeSkus=arr=>[...new Set(Array.isArray(arr)?arr.filter(s=>typeof s==='string'&&known.has(s)):[])].slice(0,60);
  const read=(key,fallback)=>{try{const value=JSON.parse(localStorage.getItem(key)||'null');return value??fallback;}catch{return fallback}};
  const write=(key,v)=>{try{localStorage.setItem(key,JSON.stringify(v));}catch{}};
  const emit=(name,detail={})=>document.dispatchEvent(new CustomEvent('bf:'+name,{detail}));
  let client=null,user=null,profile=null,addresses=[],saved=[],watches=new Set(sanitizeSkus(read(keyWatch,[])));
  let loading=false,connectError='',initPromise=null,cartTimer=null,authSequence=0;
  const fail=message=>{throw new Error(message)};
  const demandAuth=()=>{if(!client||!user)fail('Sign in to save this information to your account.');};
  const check=({error,data})=>{if(error)throw error;return data;};
  const getLocalBag=()=>sanitizeSkus(read(keyCart,[]));
  const syncShopBag=next=>{
    const s=sanitizeSkus(next);
    if(window.BURTON_STORE_API?.setBag)window.BURTON_STORE_API.setBag(s);
    else write(keyCart,s);
    emit('bag-sync',{bag:s});
  };
  function tell(){emit('account-change',{signedIn:!!user,configured:readyToConnect});emit('watch-change',{count:watches.size});emit('auth-change',{signedIn:!!user});}
  function localWatches(){watches=new Set(sanitizeSkus(read(keyWatch,[])));}
  function guestCarts(){const arr=read(keyBags,[]);return Array.isArray(arr)?arr.map(x=>({id:x.id,title:String(x.title||'Saved bag'),item_skus:sanitizeSkus(x.item_skus),created_at:x.created_at})).slice(0,20):[];}
  async function loadUser(sessionUser){
    const seq=++authSequence;
    if(!sessionUser){
      user=null;profile=null;addresses=[];saved=[];localWatches();syncShopBag([]);tell();return;
    }
    user=sessionUser;
    loading=true;tell();
    try{
      const [profileRes,addressRes,watchRes,cartRes,savedRes]=await Promise.all([
        client.from('collector_profiles').select('*').eq('user_id',user.id).maybeSingle(),
        client.from('collector_addresses').select('*').eq('user_id',user.id).order('is_default',{ascending:false}),
        client.from('collector_watchlist').select('sku').eq('user_id',user.id),
        client.from('collector_active_carts').select('item_skus').eq('user_id',user.id).maybeSingle(),
        client.from('collector_saved_carts').select('*').eq('user_id',user.id).order('updated_at',{ascending:false})
      ]);
      if(seq!==authSequence)return;
      for(const r of [profileRes,addressRes,watchRes,cartRes,savedRes])if(r.error)throw r.error;
      profile=profileRes.data||null;addresses=addressRes.data||[];saved=savedRes.data||[];
      const newWatches=sanitizeSkus([...(watchRes.data||[]).map(x=>x.sku),...read(keyWatch,[])]);
      const imported=newWatches.filter(s=>!(watchRes.data||[]).some(x=>x.sku===s));
      if(imported.length)check(await client.from('collector_watchlist').upsert(imported.map(sku=>({user_id:user.id,sku})),{onConflict:'user_id,sku'}));
      watches=new Set(newWatches);localStorage.removeItem(keyWatch);
      const cart=sanitizeSkus([...(cartRes.data?.item_skus||[]),...getLocalBag()]);
      syncShopBag(cart);await saveActiveBagNow(cart);
      const localSaved=guestCarts();
      if(localSaved.length){
        for(const bag of localSaved)await client.from('collector_saved_carts').insert({user_id:user.id,title:bag.title,item_skus:bag.item_skus});
        localStorage.removeItem(keyBags);
        const refreshed=check(await client.from('collector_saved_carts').select('*').eq('user_id',user.id).order('updated_at',{ascending:false}));saved=refreshed||[];
      }
      connectError='';
    }catch(e){connectError=e.message||'Account data could not be loaded';emit('account-error',{message:connectError});}
    finally{loading=false;tell();}
  }
  async function injectSDK(){
    if(window.supabase?.createClient)return;
    await new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0';
      script.onload=resolve;script.onerror=()=>reject(new Error('Account connection unavailable. Check your internet connection.'));
      document.head.appendChild(script);
    });
    if(!window.supabase?.createClient)fail('The account library could not be loaded.');
  }
  async function resolvePublicAccountConfig(){
    if(readyToConnect)return;
    try{
      const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),2500);
      let response;
      try{response=await fetch('/api/public-account-config',{cache:'no-store',signal:ctl.signal})}
      finally{clearTimeout(timer)}
      if(!response?.ok)return;
      const remote=await response.json();
      const url=String(remote.supabaseUrl||''),key=String(remote.supabasePublishableKey||'');
      if(/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url) && /^(sb_publishable_[\w-]+|eyJ[\w.-]+)$/.test(key)){
        cfg.supabaseUrl=url;cfg.supabasePublishableKey=key;readyToConnect=true;
      }
    }catch(e){/* Offline previews stay in guest mode without external requests. */}
  }
  function init(){
    if(initPromise)return initPromise;
    initPromise=(async()=>{
      await resolvePublicAccountConfig();
      if(readyToConnect){
        try{
          await injectSDK();client=window.supabase.createClient(cfg.supabaseUrl.trim(),cfg.supabasePublishableKey.trim(),{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
          // Subscribe before session recovery, or a password-reset redirect can be missed.
          client.auth.onAuthStateChange((event,session)=>{
            if(!['SIGNED_IN','SIGNED_OUT','USER_UPDATED','PASSWORD_RECOVERY','INITIAL_SESSION'].includes(event))return;
            // Avoid calls into Supabase's auth API while the auth callback holds the lock.
            setTimeout(()=>{
              if(event==='SIGNED_OUT')loadUser(null);
              else if(session?.user && (session.user.id!==user?.id || event==='SIGNED_IN'))loadUser(session.user);
              else if(session?.user){user=session.user;tell();}
              if(event==='PASSWORD_RECOVERY')emit('password-recovery');
            },0);
          });
          const {data,error}=await client.auth.getSession();if(error)throw error;
          if(data?.session?.user && data.session.user.id!==user?.id)await loadUser(data.session.user);
        }catch(e){connectError=e.message||'Connection failed';emit('account-error',{message:connectError});}
      }
      tell();return {configured:readyToConnect,connected:!!client,user};
    })();return initPromise;
  }
  async function signUp({email,password,fullName}){
    await init();if(!client)fail('Live registration is not enabled yet. The store owner must connect a secure account service.');
    const redirectTo=new URL('account.html',document.baseURI).href;
    const response=await client.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:redirectTo,data:{full_name:fullName.trim()}}});check(response);
    if(response.data?.session?.user)await loadUser(response.data.session.user);
    return {needsConfirmation:!response.data?.session};
  }
  async function signIn({email,password}){
    await init();if(!client)fail('Accounts are not connected yet. Explore the sample dashboard instead.');
    const data=check(await client.auth.signInWithPassword({email:email.trim(),password}));
    if(data?.user)await loadUser(data.user);
    return data;
  }
  async function signOut(){
    demandAuth();check(await client.auth.signOut({scope:'local'}));await loadUser(null);
    try{localStorage.removeItem(keyCart);}catch{}
  }
  async function forgotPassword(email){await init();if(!client)fail('Account email is not connected yet.');check(await client.auth.resetPasswordForEmail(email,{redirectTo:new URL('account.html',location.href).href}));}
  async function updatePassword(password){demandAuth();check(await client.auth.updateUser({password}));}
  async function updateEmail(email){demandAuth();check(await client.auth.updateUser({email:email.trim()}));}
  async function updateProfile(data){demandAuth();
    const fields={
      full_name:String(data.full_name||'').trim().slice(0,100),phone:String(data.phone||'').trim().slice(0,35),
      age_range:String(data.age_range||'').slice(0,25),collecting_experience:String(data.collecting_experience||'').slice(0,40),
      purchase_purpose:String(data.purchase_purpose||'').slice(0,40),discovery_source:String(data.discovery_source||'').slice(0,70),
      interests:(Array.isArray(data.interests)?data.interests:[]).filter(x=>typeof x==='string').slice(0,8),
      newsletter_opt_in:data.newsletter_opt_in===undefined?!!profile?.newsletter_opt_in:!!data.newsletter_opt_in
    };
    const result=check(await client.from('collector_profiles').upsert({user_id:user.id,...fields},{onConflict:'user_id'}).select().single());profile=result;emit('account-change');return result;
  }
  async function saveAddress(data){demandAuth();
    const v={user_id:user.id,label:String(data.label||'Home').slice(0,36),recipient:String(data.recipient||'').trim().slice(0,120),line1:String(data.line1||'').trim().slice(0,160),line2:String(data.line2||'').trim().slice(0,160),city:String(data.city||'').trim().slice(0,80),region:String(data.region||'').trim().slice(0,80),postal_code:String(data.postal_code||'').trim().slice(0,25),country:String(data.country||'Canada').slice(0,60),is_default:!!data.is_default};
    if(!v.line1||!v.city||!v.postal_code||!v.recipient)fail('Recipient, street address, city and postal code are required.');
    if(v.is_default){const {error}=await client.from('collector_addresses').update({is_default:false}).eq('user_id',user.id).eq('is_default',true);if(error)throw error;}
    if(data.id)v.id=data.id;
    const result=check(await client.from('collector_addresses').upsert(v).select().single());
    addresses=check(await client.from('collector_addresses').select('*').eq('user_id',user.id).order('is_default',{ascending:false}));emit('account-change');return result;
  }
  async function deleteAddress(id){demandAuth();check(await client.from('collector_addresses').delete().eq('id',id).eq('user_id',user.id));addresses=addresses.filter(a=>a.id!==id);emit('account-change');}
  async function toggleWatch(sku){
    if(!known.has(sku))return false;
    const previously=watches.has(sku);
    if(previously)watches.delete(sku);else watches.add(sku);
    emit('watch-change',{count:watches.size});
    if(!user||!client){write(keyWatch,[...watches]);return !previously;}
    try{const result=previously?await client.from('collector_watchlist').delete().eq('user_id',user.id).eq('sku',sku):await client.from('collector_watchlist').upsert({user_id:user.id,sku},{onConflict:'user_id,sku'});check(result);}
    catch(e){if(previously)watches.add(sku);else watches.delete(sku);emit('watch-change',{count:watches.size});emit('account-error',{message:'Could not save watchlist: '+e.message});}
    return watches.has(sku);
  }
  async function saveActiveBagNow(skus){if(!user||!client)return;check(await client.from('collector_active_carts').upsert({user_id:user.id,item_skus:sanitizeSkus(skus)},{onConflict:'user_id'}));}
  function saveActiveBag(skus){if(!user||!client)return;clearTimeout(cartTimer);cartTimer=setTimeout(()=>saveActiveBagNow(skus).catch(e=>emit('account-error',{message:'Could not sync shopping bag: '+e.message})),350);}
  async function saveNamedBag(name,skus){
    const title=String(name||'Saved paper bag').trim().slice(0,60)||'Saved paper bag',item_skus=sanitizeSkus(skus);
    if(!item_skus.length)fail('Add at least one item to your bag before saving.');
    if(user&&client){const result=check(await client.from('collector_saved_carts').insert({user_id:user.id,title,item_skus}).select().single());saved=[result,...saved];emit('account-change');return result;}
    const local=guestCarts();const value={id:'guest-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),title,item_skus,created_at:new Date().toISOString()};
    write(keyBags,[value,...local]);emit('account-change');return value;
  }
  async function deleteNamedBag(id){
    if(user&&client){check(await client.from('collector_saved_carts').delete().eq('id',id).eq('user_id',user.id));saved=saved.filter(x=>x.id!==id);}
    else write(keyBags,guestCarts().filter(x=>x.id!==id));
    emit('account-change');
  }
  function restoreBag(item_skus){syncShopBag(sanitizeSkus(item_skus));saveActiveBag(item_skus);}
  async function exportData(){demandAuth();
    const packet={exported_at:new Date().toISOString(),email:user.email,profile,addresses,watchlist:[...watches],saved_carts:saved,active_cart:getLocalBag()};
    return new Blob([JSON.stringify(packet,null,2)],{type:'application/json'});
  }
  async function deleteMyAccount(){demandAuth();check(await client.rpc('delete_my_account'));try{await client.auth.signOut({scope:'local'});}catch{}await loadUser(null);localStorage.removeItem(keyCart);}
  async function authToken(){if(!client||!user)return null;const {data,error}=await client.auth.getSession();return error?null:data?.session?.access_token||null;}
  const API={authToken,init,ready:()=>initPromise||init(),configured:()=>readyToConnect,connected:()=>!!client,connectionError:()=>connectError,isLoading:()=>loading,user:()=>user,profile:()=>profile,addresses:()=>[...addresses],savedCarts:()=>user?[...saved]:guestCarts(),isWatching:sku=>watches.has(sku),watchedSkus:()=>[...watches],watchCount:()=>watches.size,toggleWatch,signUp,signIn,signOut,forgotPassword,updatePassword,updateEmail,updateProfile,saveAddress,deleteAddress,saveActiveBag,saveNamedBag,deleteNamedBag,restoreBag,exportData,deleteMyAccount,getLocalBag,getInventory:()=>[...items]};
  window.BURTON_ACCOUNT=API;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
