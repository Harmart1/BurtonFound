import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {onRequestPost as quotePost} from '../functions/api/shipping-quotes.js';
import {secure} from '../functions/_lib/core.js';
const base='https://example.pages.dev';
test('carrier quote API stays off without explicit approval even when other variables exist',async()=>{
 const e={SHIPPING_MODE:'live_carrier',SHIPPING_QUOTE_SECRET:'a-long-safe-quote-secret-for-tests',SHIPPING_ALLOWED_COUNTRIES:'CA',SHIPPING_PACKAGES_JSON:JSON.stringify({'OH-003':{verified:true,weightKg:0.3,lengthCm:32,widthCm:24,heightCm:3}}),CANADA_POST_USERNAME:'test',CANADA_POST_PASSWORD:'test'};
 const req=()=>new Request(base+'/api/shipping-quotes',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({skus:['OH-003'],destination:{country:'CA',postal:'P6A1Z1',city:'Sault Ste. Marie',state:'ON'}})});
 let r=await quotePost({request:req(),env:e});assert.equal(r.status,503);
 assert.match((await r.json()).error,/not yet enabled/);
 assert.equal(secure({...e,SUPABASE_URL:'https://demo.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_stub',STRIPE_SECRET_KEY:'sk_test_stub',STRIPE_WEBHOOK_SECRET:'whsec_stub',LIVE_CHECKOUT_ENABLED:'true',TAX_CONFIGURATION_APPROVED:'true'}),false);
});
test('GitHub/Cloudflare package has correct routes and CI validation',()=>{
 const r=JSON.parse(readFileSync(new URL('../public/_routes.json',import.meta.url),'utf8'));
 assert.deepEqual(r.include,['/api/*']);
 assert.ok(existsSync(new URL('../.github/workflows/validate.yml',import.meta.url)));
 assert.ok(!existsSync(new URL('../index.html',import.meta.url)));
});
