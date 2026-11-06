import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../src/worker.js';

const base='https://burtonfound.timharmar.workers.dev';
const env={ASSETS:{fetch:async()=>new Response('Storefront asset',{status:200})}};

test('Workers configuration publishes static assets and invokes API routes',()=>{
  const cfg=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
  assert.equal(cfg.name,'burtonfound');
  assert.equal(cfg.assets.directory,'./public');
  assert.deepEqual(cfg.assets.run_worker_first,['/api/*']);
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
