import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../public/'+p,import.meta.url),'utf8');
const host='https://burtonfound.timharmar.workers.dev';
const context={window:{},location:{href:host+'/account.html',replace(){throw Error('unexpected redirect')}},URL,URLSearchParams};
runInNewContext(read('auth-callback.js'),context);
const C=context.window.BURTON_AUTH_CALLBACK;
test('callback routing preserves recovery tokens only on same origin and ignores normal navigation',()=>{
 assert.equal(C.forward(host+'/#shop'),null);
 assert.equal(C.forward(host+'/account#access_token=fixture&type=recovery'),null);
 assert.equal(C.forward(host+'/account.html#access_token=fixture&type=recovery'),null);
 assert.equal(C.forward(host+'/account/#access_token=fixture&type=recovery'),null);
 assert.equal(C.forward(host+'/#access_token=fixture&type=recovery'),host+'/account#access_token=fixture&type=recovery');
 assert.equal(C.forward(host+'/?code=fixture&next=https://example.invalid'),host+'/account?code=fixture');
 assert.equal(C.accountUrl(host+'/account.html#signup'),host+'/account');
 assert.equal(C.inspect(host+'/account.html#error_code=otp_expired&type=recovery').error,true);
});
function setup(href,session,event){
 const calls=[],listeners={},storage=new Map(),user=session?.user||null;
 const chain={select(){return this},eq(){return this},order(){return this},maybeSingle(){return Promise.resolve({data:null})},upsert(){return Promise.resolve({data:null})},then(resolve){resolve({data:[]})}};
 const auth={onAuthStateChange(cb){listeners.auth=cb},async getSession(){if(event)listeners.auth(event,session);return {data:{session}}},async updateUser(v){calls.push(['update',v]);return {data:{user}}},async signOut(){return {}},async resetPasswordForEmail(email,opts){calls.push(['recover',email,opts]);return {}},async resend(v){calls.push(['resend',v]);return {}},async signUp(v){calls.push(['signup',v]);return {data:{session:null}}}};
 const loc={href,replace(){}},ctx={window:{BURTON_AUTH_CALLBACK:C,BURTON_CONFIG:{supabaseUrl:'https://fixture.supabase.co',supabasePublishableKey:'sb_publishable_fixture'},supabase:{createClient:()=>({auth,from:()=>chain})}},location:loc,URL,URLSearchParams,document:{readyState:'loading',addEventListener(){},dispatchEvent(){}},CustomEvent:class{},history:{replaceState(){}},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},setTimeout:()=>0,clearTimeout(){}};
 runInNewContext(read('account-core.js'),ctx);return {A:ctx.window.BURTON_ACCOUNT,calls};
}
const user={id:'fixture-user'},session={access_token:'valid-token',user};
test('valid recovery sets password and requires sign-in again',async()=>{const {A,calls}=setup(host+'/account.html#access_token=valid-token&type=recovery',session,'PASSWORD_RECOVERY');await A.init();assert.equal(A.recoveryState(),'ready');await A.finishRecovery('new-fixture-password');assert.equal(calls[0][0],'update');assert.equal(A.recoveryState(),'none');assert.equal(A.user(),null);});
test('invalid recovery does not reuse an existing unrelated session',async()=>{const {A,calls}=setup(host+'/account.html#access_token=expired-token&type=recovery',session);await A.init();assert.equal(A.recoveryState(),'error');await assert.rejects(A.finishRecovery('new-fixture-password'),/fresh reset link/);assert.equal(calls.length,0);});
test('auth requests use canonical account URL and trim email',async()=>{const {A,calls}=setup(host+'/account.html#forgot',null);await A.forgotPassword(' fixture@example.invalid ');await A.resendConfirmation('fixture@example.invalid');await A.signUp({email:'fixture@example.invalid',password:'fixture-long',fullName:'Fixture'});assert.equal(calls[0][2].redirectTo,host+'/account');assert.equal(calls[0][1],'fixture@example.invalid');assert.equal(calls[1][1].options.emailRedirectTo,host+'/account');assert.equal(calls[2][1].options.emailRedirectTo,host+'/account');});
test('dedicated recovery UI is hidden until authenticated recovery, and hidden styles are explicit',()=>{assert.match(read('account.html'),/id="recoveryForm" hidden/);assert.match(read('account.css'),/\.collector-account-page \[hidden\]\{display:none!important\}/);assert.match(read('account.js'),/A\.finishRecovery/);assert.match(read('account.html'),/id="resendForm" hidden/);});
