import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../src/worker.js';

const base='https://burtonfound.timharmar.workers.dev';
const userId='4ae1a49b-d1b8-44d8-87f5-34c5a8b7a02c';
const env={
  SUPABASE_URL:'https://fixture.supabase.co',
  SUPABASE_PUBLISHABLE_KEY:'sb_publishable_for_tests',
  SUPABASE_SECRET_KEY:'sb_secret_for_tests'
};
const json=data=>new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});

test('owner identity endpoint does not identify visitors or signed-in regular customers as admins',async()=>{
  const anon=await worker.fetch(new Request(base+'/api/admin/me'),env,{});
  assert.equal(anon.status,403);
  const original=globalThis.fetch;
  globalThis.fetch=async (url)=>{
    if(url.includes('/auth/v1/user'))return json({id:userId});
    if(url.includes('/rest/v1/bf_admin_users'))return json([]);
    throw new Error('Unexpected network call: '+url);
  };
  try{
    const regular=await worker.fetch(new Request(base+'/api/admin/me',{headers:{authorization:'Bearer user-test-token'}}),env,{});
    assert.equal(regular.status,403);
  }finally{globalThis.fetch=original;}
});

test('owner identity endpoint returns only admin boolean for a verified allowlisted user',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async (url)=>{
    if(url.includes('/auth/v1/user'))return json({id:userId,email:'test-owner@example.com'});
    if(url.includes('/rest/v1/bf_admin_users'))return json([{user_id:userId}]);
    throw new Error('Unexpected network call: '+url);
  };
  try{
    const result=await worker.fetch(new Request(base+'/api/admin/me',{headers:{authorization:'Bearer user-test-token'}}),env,{});
    assert.equal(result.status,200);
    assert.deepEqual(await result.json(),{admin:true});
  }finally{globalThis.fetch=original;}
});

test('owner console is hidden by default and only revealed after protected API check',()=>{
  const html=readFileSync(new URL('../public/account.html',import.meta.url),'utf8');
  const js=readFileSync(new URL('../public/account.js',import.meta.url),'utf8');
  assert.match(html,/id="ownerConsoleLink"[^>]*hidden/);
  assert.match(js,/fetch\('\/api\/admin\/me'/);
  assert.match(js,/result\.admin===true/);
});

test('owner account workflow requires encrypted email match and email confirmation',()=>{
  const yaml=readFileSync(new URL('../.github/workflows/grant-owner-admin.yml',import.meta.url),'utf8');
  assert.match(yaml,/secrets\.BF_OWNER_EMAIL/);
  assert.match(yaml,/secrets\.BF_SUPABASE_SECRET_KEY/);
  assert.match(yaml,/email_confirmed_at/);
  assert.match(yaml,/BF_OWNER_EMAIL/);
  assert.match(yaml,/LIVE_PAYMENTS_APPROVED/);
});
