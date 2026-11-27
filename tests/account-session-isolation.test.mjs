import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../public/account-core.js',import.meta.url),'utf8');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const one={id:'first',email:'first@example.invalid'},two={id:'second',email:'second@example.invalid'};
const session=u=>u?{user:u,access_token:'fixture-'+u.id}:null;
function fixture({recovery=false,initial=one,delayFirst=false}={}){
 let state=session(initial),listener;
 const calls=[],timers=new Map(),store=new Map([['burton_found_bag',JSON.stringify(['OLD'])]]);let next=0;
 const block=deferred();
 const auth={onAuthStateChange(cb){listener=cb;},async getSession(){return {data:{session:state}};},async updateUser(){calls.push(['password']);return {};},async signOut(){state=null;return {};}};
 function from(table){
  let id,action='read',payload;
  const response=()=>{calls.push([action,table,id,payload]);if(delayFirst&&id==='first'&&table==='collector_profiles'&&action==='read')return block.promise;
   if(action!=='read')return Promise.resolve({data:null});
   if(table==='collector_profiles')return Promise.resolve({data:{full_name:id}});
   if(table==='collector_active_carts')return Promise.resolve({data:{item_skus:[id==='first'?'ONE':'TWO']}});
   return Promise.resolve({data:[]});};
  const chain={select(){return this},eq(key,v){if(key==='user_id')id=v;return this;},order(){return this},maybeSingle(){return response()},upsert(v){action='upsert';payload=v;id=v.user_id;return this;},then(resolve,reject){return response().then(resolve,reject);}};
  return chain;
 }
 const C={inspect:()=>({recovery,error:false,access:recovery?'fixture-first':'',callback:recovery}),accountUrl:()=> 'https://fixture.invalid/account'};
 const ctx={window:{BURTON_AUTH_CALLBACK:C,BURTON_DATA:{inventory:['ONE','TWO','OLD','GUEST'].map(sku=>({sku}))},BURTON_CONFIG:{supabaseUrl:'https://fixture.supabase.co',supabasePublishableKey:'sb_publishable_fixture'},supabase:{createClient:()=>({auth,from})}},location:{href:'https://fixture.invalid/account'},URL,document:{readyState:'loading',addEventListener(){},dispatchEvent(){}},CustomEvent:class{},history:{replaceState(){}},localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},setTimeout:(fn,ms)=>{const id=++next;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id)};
 runInNewContext(source,ctx);
 return {A:ctx.window.BURTON_ACCOUNT,calls,store,block,async change(u){state=session(u);listener(u?'SIGNED_IN':'SIGNED_OUT',state);for(const [id,t] of [...timers])if(t.ms===0){timers.delete(id);t.fn();}await new Promise(r=>setImmediate(r));},async flush(){for(const [id,t] of [...timers]){timers.delete(id);await t.fn();}}};
}
test('old mixed cart is not imported and authenticated cart is never written to guest storage',async()=>{
 const {A,calls,store}=fixture();await A.init();
 assert.deepEqual([...A.getLocalBag()],['ONE']);assert.equal(store.has('burton_found_bag'),false);assert.equal(store.has('bf_guest_active_bag_v2'),false);
 assert.equal(calls.some(c=>c[0]==='upsert'),false);
});
test('account switch cancels a scheduled cart write and isolates the next cart',async()=>{
 const x=fixture();await x.A.init();x.A.saveActiveBag(['ONE','GUEST']);await x.change(two);await x.flush();
 assert.equal(x.A.user().id,'second');assert.deepEqual([...x.A.getLocalBag()],['TWO']);assert.equal(x.A.profile().full_name,'second');
 assert.equal(x.calls.some(c=>c[0]==='upsert'),false);
});
test('stale hydration cannot overwrite a new account or its bag',async()=>{
 const x=fixture({delayFirst:true});const init=x.A.init();await new Promise(r=>setImmediate(r));await x.change(two);
 x.block.resolve({data:{full_name:'private first'}});await init;
 assert.equal(x.A.user().id,'second');assert.equal(x.A.profile().full_name,'second');assert.deepEqual([...x.A.getLocalBag()],['TWO']);assert.equal(x.A.isLoading(),false);
});
test('recovery session cannot hydrate, import, export or authorize ordinary account requests',async()=>{
 const x=fixture({recovery:true});x.store.set('bf_guest_active_bag_v2',JSON.stringify(['GUEST']));await x.A.init();
 assert.equal(x.A.recoveryState(),'ready');assert.equal(x.calls.length,0);assert.equal(x.A.profile(),null);assert.equal(await x.A.authToken(),null);assert.deepEqual([...x.A.getLocalBag()],[]);
 await assert.rejects(x.A.exportData(),/Sign in/);x.A.saveActiveBag(['ONE']);await x.flush();assert.equal(x.calls.length,0);
 await x.A.finishRecovery('fixture-new-password');assert.equal(x.A.user(),null);assert.deepEqual([...x.A.getLocalBag()],['GUEST']);assert.equal(x.calls[0][0],'password');
});
test('genuine new guest bag merges into the next authenticated account once',async()=>{
 const x=fixture({initial:null});await x.A.init();x.A.saveActiveBag(['GUEST']);await x.change(one);
 assert.deepEqual([...x.A.getLocalBag()],['ONE','GUEST']);assert.equal(x.store.has('bf_guest_active_bag_v2'),false);
 const writes=x.calls.filter(c=>c[0]==='upsert'&&c[1]==='collector_active_carts');assert.equal(writes.length,1);assert.equal(writes[0][2],'first');
 await x.change(two);assert.deepEqual([...x.A.getLocalBag()],['TWO']);
});
