import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {webcrypto} from 'node:crypto';
import {canadaPostJsonRequest,parseCanadaPostJson,canadaPostJsonRates} from '../functions/_lib/canada-post-json.js';
import {destination,signQuote,verifyQuote} from '../functions/_lib/shipping.js';
import {onRequestPost as ratesEndpoint} from '../functions/api/shipping-quotes.js';
import {secure} from '../functions/_lib/core.js';
globalThis.crypto ||= webcrypto;
const origin='https://burtonfound.example';
const pack={weightKg:.35,lengthCm:33,widthCm:26,heightCm:4,verified:true};
const env={SHIPPING_MODE:'live_carrier',SHIPPING_ALLOWED_COUNTRIES:'CA,US',CARRIER_QUOTES_ENABLED:'true',
 SHIPPING_PACKAGES_JSON:JSON.stringify({'OH-003':pack}),
 SHIPPING_QUOTE_SECRET:'dedicated-test-shipping-quote-secret-0123456789',
 CANADA_POST_API_MODE:'json'};
const ca={country:'CA',postal:'K1A 0B1',city:'Ottawa',state:'ON'};
const us={country:'US',postal:'10001',city:'New York',state:'NY'};
const sample=[
 {serviceCode:'DOM.EP',serviceName:'Expedited Parcel',priceDetails:{base:12,duе:12,due:15.78},serviceStandard:{expectedTransitTime:3,expectedDeliveryDate:'2026-12-04T00:00:00.000Z',guaranteedDelivery:false}},
 {serviceCode:'DOM.XP',serviceName:'Xpresspost',priceDetails:{due:26.50},serviceStandard:{expectedTransitTime:1,guaranteedDelivery:true}},
 {serviceCode:'USA.SP.AIR',serviceName:'Untracked',priceDetails:{due:11.99}},
 {serviceCode:'DOM.RP',serviceName:'No confirmed amount',priceDetails:{base:5}},
 {serviceCode:'DOM.PC',serviceName:'Invalid amount',priceDetails:{due:0}}
];
test('Canada Post 2026 JSON request follows published field names and location-specific destination schema',()=>{
 const canadian=canadaPostJsonRequest({...env,CANADA_POST_CUSTOMER_NUMBER:'123456789',CANADA_POST_CONTRACT_ID:'1234567'},destination(ca,env),pack,'2026-12-01');
 assert.equal(canadian.customerNumber,'123456789');
 assert.equal(canadian.contractId,'1234567');
 assert.equal(canadian.quoteType,'commercial');
 assert.deepEqual(canadian.destination,{domestic:{postalCode:'K1A0B1'}});
 assert.equal(canadian.originPostalCode,'P6A1Z1');
 assert.equal(canadian.parcelCharacteristics.weight,.35);
 assert.deepEqual(canadian.parcelCharacteristics.dimensions,{length:33,width:26,height:4});
 const american=canadaPostJsonRequest(env,destination(us,env),pack,'2026-12-01');
 assert.equal(american.quoteType,'counter');
 assert.deepEqual(american.destination,{unitedStates:{zipCode:'10001'}});
 assert.ok(!('customerNumber' in american));
 assert.throws(()=>destination({...ca,country:'GB',postal:'SW1A1AA',state:'LN'},env),/not currently enabled/);
});
test('Only actual priced service replies in CAD become quotes; no imputed missing prices or untracked post',()=>{
 assert.deepEqual(parseCanadaPostJson(sample,'CA').map(x=>x.code),['DOM.EP','DOM.XP']);
 const [first]=parseCanadaPostJson(sample,'CA');
 assert.equal(first.amount_cents,1578);
 assert.equal(first.estimated_date,'2026-12-04');
 assert.equal(first.transit_days,3);
 assert.equal(parseCanadaPostJson({priceQuotes:sample},'CA').length,0,'New API returns a top-level array, not the old XML envelope');
 assert.equal(parseCanadaPostJson([{serviceCode:'USA.TP',serviceName:'Tracked Packet USA',priceDetails:{due:23.51}}],'US')[0].amount_cents,2351);
 assert.equal(parseCanadaPostJson([{serviceCode:'USA.SP.AIR',priceDetails:{due:8}}],'US').length,0);
});
test('Canada Post JSON connector exchanges OAuth token using server-only credentials and never sets platform-id',async()=>{
 const before=globalThis.fetch,calls=[];
 globalThis.fetch=async(url,options)=>{
  calls.push({url:String(url),options});
  if(String(url).endsWith('/oauth2/token')){
    assert.match(options.headers.Authorization,/^Basic /);
    const params=new URLSearchParams(options.body);
    assert.equal(params.get('scope'),'merchant');
    assert.equal(params.get('grant_type'),'client_credentials');
    return new Response(JSON.stringify({access_token:'fictional_access_token_for_unit_tests'}),{status:200});
  }
  assert.match(String(url),/\/rating\/v1\/prices$/);
  assert.equal(options.headers.Authorization,'Bearer fictional_access_token_for_unit_tests');
  assert.ok(!('platform-id' in options.headers));
  const body=JSON.parse(options.body);
  assert.equal(body.destination.domestic.postalCode,'K1A0B1');
  return new Response(JSON.stringify(sample),{status:200});
 };
 try{
  const result=await canadaPostJsonRates({...env,CANADA_POST_CLIENT_ID:'test-id',CANADA_POST_CLIENT_SECRET:'test-secret'},destination(ca,env),pack,'2026-12-01');
  assert.equal(result[0].amount_cents,1578);
  assert.equal(calls.length,2);
 }finally{globalThis.fetch=before}
});
test('Public rate endpoint never presents Canada Post Test app or FedEx sandbox stub prices to shoppers',async()=>{
 const previous=globalThis.fetch;let called=0;
 globalThis.fetch=async()=>{called++;throw Error('No external API must be invoked')};
 try{
  const request=new Request(origin+'/api/shipping-quotes',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({skus:['OH-003'],destination:ca})});
  const r=await ratesEndpoint({request,env:{...env,CANADA_POST_TEST_APP:'true',CANADA_POST_CLIENT_ID:'fake',CANADA_POST_CLIENT_SECRET:'fake',FEDEX_SANDBOX:'true',FEDEX_CLIENT_ID:'fake',FEDEX_CLIENT_SECRET:'fake',FEDEX_ACCOUNT_NUMBER:'fake'}});
  assert.equal(r.status,503);
  assert.equal(called,0);
 }finally{globalThis.fetch=previous}
});
test('Signed US rates cannot become paid orders before customs approvals; Canada remains possible',async()=>{
 const basis={v:2,skus:['OH-003'],to:destination(us,env),packed:[.35,33,26,4],ship_date:'2026-12-01',carrier:'FedEx',code:'FEDEX_GROUND',amount_cents:2299,expires:Math.floor(Date.now()/1000)+600,name:'FedEx Ground'};
 const signed=await signQuote(env,basis);
 await assert.rejects(()=>verifyQuote(env,signed,['OH-003']),/US checkout is not enabled/);
 assert.equal((await verifyQuote({...env,US_SHIPPING_APPROVED:'true'},signed,['OH-003'])).to.country,'US');
 const cp={...basis,carrier:'Canada Post',code:'USA.TP'};
 const cpToken=await signQuote(env,cp);
 await assert.rejects(()=>verifyQuote({...env,US_SHIPPING_APPROVED:'true'},cpToken,['OH-003']),/duty\/declaration workflow/);
 assert.equal((await verifyQuote({...env,US_SHIPPING_APPROVED:'true',CANADA_POST_US_DUTIES_APPROVED:'true'},cpToken,['OH-003'])).carrier,'Canada Post');
 const live={...env,STRIPE_SECRET_KEY:'sk_live_test_placeholder',US_SHIPPING_APPROVED:'true'};
 await assert.rejects(()=>verifyQuote(live,signed,['OH-003']),/FedEx production rates/);
 assert.equal((await verifyQuote({...live,FEDEX_PRODUCTION_VERIFIED:'true'},signed,['OH-003'])).carrier,'FedEx');
});
test('Readiness flags default off and no invented packed sizes are shipped to Cloudflare',()=>{
 const vars=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8')).vars;
 assert.equal(vars.SHIPPING_ALLOWED_COUNTRIES,'CA,US');
 assert.equal(vars.CANADA_POST_API_MODE,'json');
 for(const k of ['LIVE_CHECKOUT_ENABLED','LIVE_PAYMENTS_APPROVED','TAX_CONFIGURATION_APPROVED','CARRIER_QUOTES_ENABLED','US_SHIPPING_APPROVED','CANADA_POST_US_DUTIES_APPROVED','CANADA_POST_PRODUCTION_VERIFIED','FEDEX_PRODUCTION_VERIFIED'])
  assert.equal(vars[k],'false',k);
 assert.equal(vars.CANADA_POST_TEST_APP,'true');
 assert.equal(vars.FEDEX_SANDBOX,'true');
 assert.equal(secure({...env,SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_abc',STRIPE_SECRET_KEY:'sk_live_abc',STRIPE_WEBHOOK_SECRET:'whsec_abc',LIVE_CHECKOUT_ENABLED:'false'}),false);
});
test('Measurement worksheet covers website inventory without making any product look measured',()=>{
 const dir=mkdtempSync(join(tmpdir(),'bf-carrier-'));
 try{
  const output=join(dir,'shipping.csv');
  const script=new URL('../scripts/generate-shipping-measurements.mjs',import.meta.url);
  execFileSync(process.execPath,[script.pathname,output],{stdio:'pipe'});
  const data=readFileSync(output,'utf8');
  for(const sku of ['VA-001','VA-049','CC-010','OH-003','BF-VA-SET01'])assert.ok(data.includes('"'+sku+'"'),sku);
  assert.equal((data.match(/,"true",/g)||[]).length,0);
  assert.ok(data.split('\\n').length>230);
 }finally{rmSync(dir,{recursive:true,force:true})}
});
