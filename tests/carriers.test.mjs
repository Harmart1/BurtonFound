import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {destination, parcelFor, parseCanadaPost, parseFedex, canadaPostRequest, fedexRequest, signQuote, verifyQuote, mailingDate} from '../functions/_lib/shipping.js';
import {shippingMismatch} from '../functions/api/stripe-webhook.js';
import {secure,hasVerifiedPackages} from '../functions/_lib/core.js';
import {onRequestPost as getQuotes} from '../functions/api/shipping-quotes.js';
import {onRequestPost as checkout} from '../functions/api/checkout.js';
globalThis.crypto ||= webcrypto;
const base='https://bf-merchant.pages.dev';
const pack={weightKg:0.35,lengthCm:33,widthCm:26,heightCm:4,verified:true};
const env={CARRIER_QUOTES_ENABLED:'true',SHIPPING_MODE:'live_carrier',SHIPPING_ALLOWED_COUNTRIES:'CA,US,GB',SHIPPING_PACKAGES_JSON:JSON.stringify({'OH-003':pack}),SHIPPING_QUOTE_SECRET:'a-long-random-test-only-key-12345678901234',SHIPPING_HANDLING_BUSINESS_DAYS:'2'};
const place={country:'CA',postal:'P6B 3T1',city:'Sault Ste. Marie',state:'ON'};
const cpXml=`<price-quotes><price-quote><service-code>DOM.EP</service-code><service-name>Expedited Parcel</service-name><price-details><base>10.00</base><due>12.72</due></price-details><service-standard><expected-transit-time>2</expected-transit-time><expected-delivery-date>2026-11-10</expected-delivery-date></service-standard></price-quote><price-quote><service-code>INT.SP.SURF</service-code><service-name>Untracked service</service-name><price-details><due>5.00</due></price-details></price-quote></price-quotes>`;
const fakeReq=(url,data)=>new Request(base+url,{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify(data)});
const goodRate=()=>({v:2,skus:['OH-003'],to:destination(place,env),packed:[.35,33,26,4],ship_date:'2026-11-09',carrier:'Canada Post',code:'DOM.EP',amount_cents:1272,expires:Math.floor(Date.now()/1000)+580,name:'Expedited Parcel'});
test('country and postal validation rejects unsupported destinations',()=>{
 assert.equal(destination(place,env).postal,'P6B3T1');
 assert.throws(()=>destination({...place,country:'JP'},env),/not currently enabled/);
 assert.throws(()=>destination({...place,postal:'BAD'},env),/Canadian postal/);
});
test('only measured verified packages can receive carrier rates',()=>{
 assert.deepEqual(parcelFor(env,['OH-003']),{weightKg:0.35,lengthCm:33,widthCm:26,heightCm:4});
 assert.throws(()=>parcelFor({...env,SHIPPING_PACKAGES_JSON:JSON.stringify({'OH-003':{...pack,verified:false}})},['OH-003']),/not confirmed/);
 assert.throws(()=>parcelFor(env,['OH-003','CC-010']),/measured, packed/);
});
test('Canada Post XML rates include carrier delivery dates, exclude untracked small packet',()=>{
 const rates=parseCanadaPost(cpXml);
 assert.equal(rates.length,1);
 assert.equal(rates[0].code,'DOM.EP');assert.equal(rates[0].amount_cents,1272);assert.equal(rates[0].estimated_date,'2026-11-10');
 const r=canadaPostRequest(env,destination(place,env),parcelFor(env,['OH-003']),'2026-11-09');
 assert.match(r.body,/<origin-postal-code>P6A1Z1<\/origin-postal-code>/);
 assert.match(r.body,/<expected-mailing-date>2026-11-09<\/expected-mailing-date>/);
});
test('FedEx API request packages exact measured parcel and parses CAD response',()=>{
 const r=fedexRequest({...env,FEDEX_ACCOUNT_NUMBER:'999'},destination({...place,country:'US',postal:'10001',city:'New York',state:'NY'},env),parcelFor(env,['OH-003']),'2026-11-09');
 assert.equal(r.requestedShipment.recipient.address.countryCode,'US');
 assert.equal(r.requestedShipment.requestedPackageLineItems[0].weight.value,.35);
 const out=parseFedex({output:{rateReplyDetails:[{serviceType:'INTERNATIONAL_ECONOMY',ratedShipmentDetails:[{rateType:'ACCOUNT',currency:'CAD',totalNetCharge:26.42}],commit:{dateDetail:{date:'2026-11-14'}}}]}});
 assert.equal(out[0].amount_cents,2642);assert.equal(out[0].estimated_date,'2026-11-14');
});
test('quote signs complete destination, parcel, service and price; tampering is rejected',async()=>{
 const value=goodRate();const token=await signQuote(env,value);
 assert.deepEqual(await verifyQuote(env,token,['OH-003']),value);
 const parts=token.split('.');const tampered=parts[0].slice(0,-4)+'AAAA.'+parts[1];
 await assert.rejects(()=>verifyQuote(env,tampered,['OH-003']),/changed|Invalid/);
 await assert.rejects(()=>verifyQuote({...env,SHIPPING_PACKAGES_JSON:JSON.stringify({'OH-003':{...pack,weightKg:.4}})},token,['OH-003']),/Packaging has changed/);
 await assert.rejects(()=>verifyQuote(env,token,['CC-010']),/no longer matches/);
 await assert.rejects(()=>verifyQuote({...env,SHIPPING_ALLOWED_COUNTRIES:'US'},token,['OH-003']),/not currently enabled/);
 await assert.rejects(()=>verifyQuote({...env,SHIPPING_MODE:'flat_rate'},token,['OH-003']),/not enabled/);
});
test('Stripe destination mismatch checks price, postal, city, province and country',()=>{
 const meta={bf_ship_carrier:'FedEx',bf_ship_country:'CA',bf_ship_postal:'P6B3T1',bf_ship_city:'Sault Ste. Marie',bf_ship_state:'ON',bf_ship_amount:'1272'};
 const delivery={country:'CA',postal_code:'P6B 3T1',city:'Sault Ste Marie',state:'ON'};
 assert.equal(shippingMismatch(meta,delivery,1272),false);
 assert.equal(shippingMismatch(meta,{...delivery,postal_code:'P6B 3T2'},1272),true);
 assert.equal(shippingMismatch(meta,{...delivery,city:'Toronto'},1272),true);
 assert.equal(shippingMismatch(meta,{...delivery,state:'QC'},1272),true);
 assert.equal(shippingMismatch(meta,{...delivery,country:'US'},1272),true);
 assert.equal(shippingMismatch(meta,delivery,1300),true);
 assert.equal(shippingMismatch(meta,{},1272),true);
});
test('shipping quote endpoint returns real mocked carrier quotes and signed selection, not fixed guesses',async()=>{
 const old=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{
  assert.match(url,/\.canadapost\.ca\/rs\/ship\/price$/);
  return new Response(cpXml,{status:200,headers:{'content-type':'application/xml'}});
 };
 try {
  const res=await getQuotes({request:fakeReq('/api/shipping-quotes',{skus:['OH-003'],destination:place}),env:{...env,CANADA_POST_USERNAME:'test_user',CANADA_POST_PASSWORD:'test_password',CANADA_POST_SANDBOX:'true'}});
  assert.equal(res.status,200);const body=await res.json();assert.equal(body.options.length,1);
  assert.equal(body.options[0].amount_cents,1272);assert.equal(body.options[0].carrier,'Canada Post');
  const verified=await verifyQuote(env,body.options[0].quote_token,['OH-003']);
  assert.equal(verified.to.city,'Sault Ste. Marie');assert.equal(verified.to.state,'ON');
 }finally{globalThis.fetch=old}
});
test('Stripe checkout accepts signed carrier rate but ignores forged browser amount',async()=>{
 const token=await signQuote(env,goodRate());const old=globalThis.fetch;let form;
 const backend={...env,SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_test',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',STRIPE_SECRET_KEY:'sk_test_testing',STRIPE_WEBHOOK_SECRET:'whsec_testing',LIVE_CHECKOUT_ENABLED:'true',TAX_CONFIGURATION_APPROVED:'true',CANADA_POST_USERNAME:'x',CANADA_POST_PASSWORD:'y'};
 globalThis.fetch=async(url,init)=>{
  if(url.includes('rpc/bf_hold_cart'))return new Response(JSON.stringify({id:'40b9bf73-7d03-48cc-8d51-907d039175b8',lines:[{sku:'OH-003',title:'Marlene Dietrich Portrait',price_cents:3995}]}));
  if(url.includes('rpc/bf_bind_stripe_session'))return new Response('true');
  if(url.includes('api.stripe.com')){form=new URLSearchParams(init.body);return new Response(JSON.stringify({id:'cs_test_abcdefgh',url:'https://checkout.stripe.com/c/pay/cs_test_abcdefgh'}));}
  throw Error('Unexpected fetch URL: '+url);
 };
 try {
  const r=await checkout({request:fakeReq('/api/checkout',{skus:['OH-003'],shipping_quote:token,shipping_cents:1}),env:backend});
  assert.equal(r.status,200);
  assert.equal(form.get('shipping_options[0][shipping_rate_data][fixed_amount][amount]'),'1272');
  assert.equal(form.get('metadata[bf_ship_city]'),'Sault Ste. Marie');
  assert.equal(form.get('metadata[bf_ship_state]'),'ON');
  assert.equal(form.get('shipping_address_collection[allowed_countries][0]'),'CA');
 }finally{globalThis.fetch=old}
});
test('invalid or absent signed quote never creates Stripe cart reservation',async()=>{
 const backend={...env,SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_test',STRIPE_SECRET_KEY:'sk_test_testing',STRIPE_WEBHOOK_SECRET:'whsec_testing',LIVE_CHECKOUT_ENABLED:'true',TAX_CONFIGURATION_APPROVED:'true',CANADA_POST_USERNAME:'x',CANADA_POST_PASSWORD:'y'};
 const r=await checkout({request:fakeReq('/api/checkout',{skus:['OH-003']}),env:backend});
 assert.equal(r.status,400);
});

test('live checkout activation requires at least one owner-verified parcel profile',()=>{
 const base={...env,SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_test',STRIPE_SECRET_KEY:'sk_test_test',STRIPE_WEBHOOK_SECRET:'whsec_test',TAX_CONFIGURATION_APPROVED:'true',LIVE_CHECKOUT_ENABLED:'true',CANADA_POST_USERNAME:'legacy',CANADA_POST_PASSWORD:'legacy',CANADA_POST_SANDBOX:'true'};
 assert.equal(hasVerifiedPackages(base),true);assert.equal(secure(base),true);
 const unverified={...base,SHIPPING_PACKAGES_JSON:JSON.stringify({'OH-003':{...pack,verified:false}})};
 assert.equal(hasVerifiedPackages(unverified),false);assert.equal(secure(unverified),false);
});
