import test from 'node:test';
import assert from 'node:assert/strict';
import {flatRateFor,flatRateOptions} from '../functions/_lib/flat-shipping.js';
import {shippingMismatch} from '../functions/api/stripe-webhook.js';
const env={SHIPPING_ALLOWED_COUNTRIES:'CA,US',SHIPPING_STANDARD_CA_CENTS:'1995',SHIPPING_STANDARD_US_CENTS:'2995',SHIPPING_EXPRESS_US_CENTS:'4995'};
test('US flat rates remain unavailable until cross-border and postal duty approvals',()=>{
 assert.deepEqual(flatRateOptions(env).map(x=>x.country),['CA']);
 assert.throws(()=>flatRateFor({...env,US_SHIPPING_APPROVED:'true'},'US'),/customs/);
 assert.equal(flatRateFor({...env,US_SHIPPING_APPROVED:'true',CANADA_POST_US_DUTIES_APPROVED:'true'},'US').standard,2995);
 assert.throws(()=>flatRateFor(env,'GB'),/not available/);
 assert.throws(()=>flatRateFor({...env,SHIPPING_STANDARD_CA_CENTS:'0'},'CA'),/not been configured/);
});
test('Flat rate webhook detects country and amount mismatch',()=>{
 const metadata={bf_flat_country:'US',bf_flat_standard:'2995',bf_flat_express:'4995'};
 assert.equal(shippingMismatch(metadata,{country:'US'},2995),false);
 assert.equal(shippingMismatch(metadata,{country:'US'},4995),false);
 assert.equal(shippingMismatch(metadata,{country:'CA'},2995),true);
 assert.equal(shippingMismatch(metadata,{country:'US'},1995),true);
 assert.equal(shippingMismatch(metadata,{},2995),true);
});

test('Proposed flat rates are staged and cannot become payable without price approval',()=>{
 assert.deepEqual(flatRateOptions({...env,FLAT_RATE_PRICES_APPROVED:'false'}),[]);
 assert.throws(()=>flatRateFor({...env,STRIPE_SECRET_KEY:'sk_live_fixture'},'CA'),/awaiting merchant approval/);
 assert.equal(flatRateFor({...env,STRIPE_SECRET_KEY:'sk_live_fixture',FLAT_RATE_PRICES_APPROVED:'true'},'CA').standard,1995);
});
