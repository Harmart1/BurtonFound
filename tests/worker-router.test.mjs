import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker,{paymentEnvironment} from '../src/worker.js';

const base='https://burtonfound.timharmar.workers.dev';
const env={ASSETS:{fetch:async()=>new Response('Storefront asset',{status:200})}};

test('Workers configuration publishes static assets and invokes API routes',()=>{
  const cfg=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
  assert.equal(cfg.name,'burtonfound');
  assert.equal(cfg.assets.directory,'./public');
  assert.deepEqual(cfg.assets.run_worker_first,['/api/*','/sitemap.xml','/robots.txt','/merchant-feed.xml']);
  assert.equal(cfg.vars.LIVE_CHECKOUT_ENABLED,'false');
  assert.equal(cfg.vars.LIVE_PAYMENTS_APPROVED,'false');
});

test('Worker serves the existing storefront through the assets binding',async()=>{
  const r=await worker.fetch(new Request(base+'/'),env,{});
  assert.equal(r.status,200);
  assert.equal(await r.text(),'Storefront asset');
});

test('Worker health stays preview-only with no configured credentials',async()=>{
  const r=await worker.fetch(new Request(base+'/api/health'),env,{});
  assert.equal(r.status,200);
  const j=await r.json();
  assert.equal(j.service,'Burton & Found');
  assert.equal(j.checkout,'preview_only');
});

test('Worker exposes public account configuration without secrets',async()=>{
  const r=await worker.fetch(new Request(base+'/api/public-account-config'),env,{});
  assert.equal(r.status,200);
  assert.deepEqual(await r.json(),{configured:false});
});

test('Worker rejects unknown APIs and wrong HTTP methods',async()=>{
  let r=await worker.fetch(new Request(base+'/api/no-such-route'),env,{});
  assert.equal(r.status,404);
  r=await worker.fetch(new Request(base+'/api/health',{method:'POST'}),env,{});
  assert.equal(r.status,405);
  assert.equal(r.headers.get('allow'),'GET');
});

test('Worker does not create Stripe payments without backend credentials',async()=>{
  const r=await worker.fetch(new Request(base+'/api/checkout',{
    method:'POST',headers:{origin:base,'content-type':'application/json'},
    body:JSON.stringify({skus:['OH-003']})
  }),env,{});
  assert.equal(r.status,503);
});

test('Worker serves generated branded sitemap and robots independently of static assets',async()=>{
  const sitemap=await worker.fetch(new Request(base+'/sitemap.xml'),{},{});
  assert.equal(sitemap.status,200);assert.match(sitemap.headers.get('content-type'),/application\/xml/);
  assert.equal(sitemap.headers.get('x-robots-tag'),'noindex');
  const xml=await sitemap.text();assert.equal((xml.match(/<loc>/g)||[]).length,238);assert.equal((xml.match(/<loc>https:\/\/burtonandfound\.ca\/products\//g)||[]).length,229);
  const robots=await worker.fetch(new Request(base+'/robots.txt'),{},{});assert.match(await robots.text(),/Sitemap: https:\/\/burtonandfound\.ca\/sitemap\.xml/);
  const head=await worker.fetch(new Request(base+'/sitemap.xml',{method:'HEAD'}),{},{});assert.equal(await head.text(),'');
  const bad=await worker.fetch(new Request(base+'/sitemap.xml',{method:'POST'}),{},{});assert.equal(bad.status,405);
});

test('live runtime never falls back to sandbox credentials and staging leaves preview untouched',()=>{
 const staging={STRIPE_WEBHOOK_MODE:'test',STRIPE_SECRET_KEY:'sk_test_fixture',STRIPE_LIVE_SECRET_KEY:'sk_live_fixture',STRIPE_LIVE_WEBHOOK_SECRET:'whsec_fixture'};
 assert.equal(paymentEnvironment(staging).STRIPE_SECRET_KEY,'sk_test_fixture');
 assert.equal(paymentEnvironment({...staging,STRIPE_WEBHOOK_MODE:'live'}).STRIPE_SECRET_KEY,'sk_live_fixture');
 assert.equal(paymentEnvironment({...staging,STRIPE_WEBHOOK_MODE:'live',STRIPE_LIVE_WEBHOOK_SECRET:''}).STRIPE_SECRET_KEY,'');
 assert.equal(paymentEnvironment({...staging,STRIPE_WEBHOOK_MODE:'live',STRIPE_LIVE_SECRET_KEY:'sk_test_fixture'}).STRIPE_SECRET_KEY,'');
});
