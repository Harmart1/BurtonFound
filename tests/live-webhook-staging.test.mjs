import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {onRequestPost} from '../functions/api/stripe-webhook.js';
const env={STRIPE_WEBHOOK_MODE:'test',STRIPE_WEBHOOK_SECRET:'whsec_test_fixture',STRIPE_LIVE_WEBHOOK_SECRET:'whsec_live_fixture',SUPABASE_SECRET_KEY:'fixture'};
const probe={id:'evt_live_probe',type:'bf.integration.live_probe',livemode:true};
async function call(event,key){
 const payload=JSON.stringify(event),t=Math.floor(Date.now()/1000),sig=createHmac('sha256',key).update(t+'.'+payload).digest('hex');
 return onRequestPost({env,request:new Request('https://burtonandfound.ca/api/stripe-webhook',{method:'POST',headers:{'Stripe-Signature':'t='+t+',v1='+sig},body:payload})});
}
test('independent live signature accepts harmless probe while test signature cannot authorize live events',async()=>{
 const valid=await call(probe,env.STRIPE_LIVE_WEBHOOK_SECRET);
 assert.equal(valid.status,200);assert.deepEqual(await valid.json(),{received:true,live_probe:true});
 assert.equal((await call(probe,env.STRIPE_WEBHOOK_SECRET)).status,400);
 assert.equal((await call(probe,'wrong')).status,400);
 assert.equal((await call({...probe,livemode:false},env.STRIPE_LIVE_WEBHOOK_SECRET)).status,400);
 const sandbox=await call({id:'evt_test_probe',type:'bf.integration.isolation_probe',livemode:false,data:{object:{id:'cs_test_fixture_probe',livemode:false,metadata:{bf_isolated_qa:'burtonfound-sandbox-v1'}}}},env.STRIPE_WEBHOOK_SECRET);
 assert.equal(sandbox.status,200);assert.equal((await sandbox.json()).qa_isolated,true);
});
