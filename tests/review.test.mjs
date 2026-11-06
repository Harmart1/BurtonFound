import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestPost as resolve} from '../functions/api/admin/review-shipping.js';
import {parseFedex} from '../functions/_lib/shipping.js';
const origin='https://burton.example';
const uuid='55555555-1111-4111-8111-123456789012';
const env={SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SUPABASE_SECRET_KEY:'sb_secret_test'};
const request=(data,auth=true)=>new Request(origin+'/api/admin/review-shipping',{method:'POST',headers:{origin,'content-type':'application/json',...(auth?{Authorization:'Bearer mock_auth'}:{})},body:JSON.stringify(data)});
const ok=d=>new Response(JSON.stringify(d),{status:200,headers:{'content-type':'application/json'}});
test('unauthorized visitors cannot resolve shipping address mismatches',async()=>{
 const response=await resolve({request:request({id:uuid,note:'Verified customer delivery details and current quote'},false),env});assert.equal(response.status,403);
});
test('owner can record detailed review note, and short notes are rejected',async()=>{
 const old=globalThis.fetch;let calls=0;let args;
 globalThis.fetch=async(url,options={})=>{
  if(url.includes('/auth/v1/user'))return ok({id:uuid});
  if(url.includes('/rest/v1/bf_admin_users'))return ok([{user_id:uuid}]);
  if(url.includes('/rest/v1/rpc/bf_resolve_shipping_review')){calls++;args=JSON.parse(options.body);return ok({id:uuid,payment_status:'paid',fulfillment_status:'processing'})}
  throw Error(`Unexpected fetch ${url}`);
 };
 try{
  let response=await resolve({request:request({id:uuid,note:'bad'}),env});assert.equal(response.status,400);assert.equal(calls,0);
  response=await resolve({request:request({id:uuid,note:'Confirmed actual shipping destination and price with the customer'}),env});assert.equal(response.status,200);assert.equal(calls,1);assert.equal(args.p_admin_id,uuid);
 }finally{globalThis.fetch=old}
});
test('FedEx parser handles operationalDetail.deliveryDate format',()=>{
 const rates=parseFedex({output:{rateReplyDetails:[{serviceType:'FEDEX_GROUND',ratedShipmentDetails:[{rateType:'ACCOUNT',totalNetCharge:42.12,shipmentRateDetail:{currency:'CAD'}}],operationalDetail:{deliveryDate:'2026-11-18T12:00:00'}}]}});
 assert.equal(rates.length,1);assert.equal(rates[0].estimated_date,'2026-11-18');assert.equal(rates[0].amount_cents,4212);
});

test('estimated dispatch date uses Ontario local day, skips weekends',async()=>{
 const {mailingDate}=await import('../functions/_lib/shipping.js');
 const date=new Date('2026-11-07T02:00:00.000Z'); // Friday evening in Ontario
 assert.equal(mailingDate(1,date),'2026-11-09');
 assert.equal(mailingDate(2,date),'2026-11-10');
});


test('FedEx returns named transit days when a calendar date is absent',()=>{
 const rates=parseFedex({output:{rateReplyDetails:[{serviceType:'INTERNATIONAL_ECONOMY',ratedShipmentDetails:[{rateType:'ACCOUNT',totalNetCharge:35,shipmentRateDetail:{currency:'CAD'}}],operationalDetail:{transitTime:'THREE_DAYS'}}]}});
 assert.equal(rates[0].transit_days,3);assert.equal(rates[0].estimated_date,null);
});
