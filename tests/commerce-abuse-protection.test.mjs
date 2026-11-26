import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {boundedJson} from '../functions/_lib/bounded-json.js';
import {commerceProtection} from '../src/commerce-protection.js';
import worker from '../src/worker.js';
const base='https://burtonfound.timharmar.workers.dev';
const quotePath='/api/shipping-quotes',checkoutPath='/api/checkout';
const req=(path,body='{}',ip='192.0.2.15')=>new Request(base+path,{method:'POST',headers:{origin:base,'content-type':'application/json',...(ip?{'CF-Connecting-IP':ip}:{})},body});
test('bounded streaming JSON rejects oversized bodies even without Content-Length',async()=>{
 assert.deepEqual(await boundedJson(req(quotePath,'{"ok":true}'),100),{ok:true});
 await assert.rejects(boundedJson(req(quotePath,JSON.stringify({x:'a'.repeat(5000)})),4500),{status:413});
 await assert.rejects(boundedJson(req(quotePath,'{'),4500),{status:400});
 const oversized=new Request(base+quotePath,{method:'POST',headers:{'Content-Length':'9999'},body:'{}'});
 await assert.rejects(boundedJson(oversized,4500),{status:413});
});
test('rate limiting is isolated by endpoint and respects preview safety gates',async()=>{
 const calls=[];const limit={limit:async x=>{calls.push(x);return {success:false}}};
 const env={SHIPPING_MODE:'live_carrier',CARRIER_QUOTES_ENABLED:'true',BF_QUOTE_LIMIT:limit};
 assert.equal(await commerceProtection(req(checkoutPath),env,checkoutPath),null);
 const r=await commerceProtection(req(quotePath),env,quotePath);
 assert.equal(r.status,429);assert.equal(r.headers.get('retry-after'),'60');
 assert.deepEqual(calls,[{key:'burtonfound:192.0.2.15'}]);
 assert.equal(await commerceProtection(req(quotePath),{},quotePath),null);
 assert.equal((await commerceProtection(req(quotePath),{...env,BF_QUOTE_LIMIT:undefined},quotePath)).status,503);
 assert.equal((await commerceProtection(req(quotePath,'{}',''),env,quotePath)).status,503);
 assert.equal((await commerceProtection(req(quotePath),{...env,BF_QUOTE_LIMIT:{limit:async()=>{throw Error('unavailable')}}},quotePath)).status,503);
 assert.equal(await commerceProtection(req(quotePath),{...env,BF_QUOTE_LIMIT:{limit:async()=>({success:true})}},quotePath),null);
});
test('Worker blocks limited commerce requests before carrier or Stripe handlers',async()=>{
 const env={SHIPPING_MODE:'live_carrier',CARRIER_QUOTES_ENABLED:'true',BF_QUOTE_LIMIT:{limit:async()=>({success:false})}};
 assert.equal((await worker.fetch(req(quotePath),env,{})).status,429);
 const checkoutEnv={SUPABASE_URL:'https://unit.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_fixture',STRIPE_SECRET_KEY:'sk_test_fixture',STRIPE_EXPECTED_ACCOUNT_ID:'acct_example123456',STRIPE_WEBHOOK_SECRET:'whsec_fixture',SHIPPING_STANDARD_CA_CENTS:'1000',LIVE_CHECKOUT_ENABLED:'true',TAX_CONFIGURATION_APPROVED:'true',BF_CHECKOUT_LIMIT:{limit:async()=>({success:false})}};
 assert.equal((await worker.fetch(req(checkoutPath),checkoutEnv,{})).status,429);
 assert.equal((await worker.fetch(req(checkoutPath),{},{})).status,503);
 assert.equal((await worker.fetch(new Request(base+'/api/health'),{},{})).status,200);
});
test('Wrangler has separate edge counters with bounded thresholds',()=>{
 const cfg=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
 assert.deepEqual(cfg.ratelimits.map(x=>[x.name,x.simple.limit,x.simple.period]),[['BF_CHECKOUT_LIMIT',8,60],['BF_QUOTE_LIMIT',24,60]]);
 assert.equal(new Set(cfg.ratelimits.map(x=>x.namespace_id)).size,2);
});
