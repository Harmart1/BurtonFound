import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {onRequestGet as publicConfig} from '../functions/api/public-account-config.js';
for(const filename of ['index.html','storefront.html','account.html','papertrail.html']){
 test(`${filename} navigation has a close action and direct sign-in/create-account links`,()=>{
  const html=readFileSync(new URL(`../public/${filename}`,import.meta.url),'utf8');
  assert.match(html,/id="menuToggle"/);assert.match(html,/id="menuClose"/);
  assert.match(html,/account\.html#signin/);assert.match(html,/account\.html#signup/);
  assert.match(html,/site-menu\.js/);
 });
}
test('account application uses genuine Supabase registration and authentication',()=>{
 const src=readFileSync(new URL('../public/account-core.js',import.meta.url),'utf8');
 assert.match(src,/client\.auth\.signUp\(/);
 assert.match(src,/client\.auth\.signInWithPassword\(/);
 assert.match(src,/api\/public-account-config/);
 assert.match(src,/Live registration is not enabled yet/);
});
test('public settings endpoint reveals only safe publishable account configuration',async()=>{
 const env={SUPABASE_URL:'https://safeproject.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_testing123',SUPABASE_SECRET_KEY:'sb_secret_PRIVATE_DO_NOT_EXPOSE'};
 const res=await publicConfig({env});const result=await res.json();
 assert.equal(result.configured,true);
 assert.equal(result.supabaseUrl,env.SUPABASE_URL);
 assert.equal(result.supabasePublishableKey,env.SUPABASE_PUBLISHABLE_KEY);
 assert.ok(!JSON.stringify(result).includes('PRIVATE_DO_NOT_EXPOSE'));
 const bad=await publicConfig({env:{...env,SUPABASE_PUBLISHABLE_KEY:'sb_secret_SHOULD_NOT_PUBLISH'}});
 assert.deepEqual(await bad.json(),{configured:false});
});
