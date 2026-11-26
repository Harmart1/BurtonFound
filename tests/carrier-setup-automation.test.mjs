import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {secure} from '../functions/_lib/core.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('read-only carrier setup audit uses existing Cloudflare connection and never writes Worker bindings',()=>{
 const src=read('.github/workflows/carrier-readiness.yml');
 assert.match(src,/workflow_dispatch/);
 assert.match(src,/CLOUDFLARE_API_TOKEN/);
 assert.match(src,/\/workers\/scripts\/burtonfound\/settings/);
 assert.match(src,/carrier-readiness-report\.md/);
 assert.match(src,/actions\/upload-artifact@v4/);
 assert.match(src,/print\(line\)/);
 assert.doesNotMatch(src,/request\(base_path\+"\/secrets","PUT"/);
 assert.doesNotMatch(src,/\/rating\/v1\/prices/);
});
test('shipping quote signing key setup is idempotent and requires three disabled commerce gates',()=>{
 const src=read('.github/workflows/carrier-secret-init.yml');
 assert.match(src,/secrets\.token_urlsafe\(48\)/);
 assert.match(src,/\/secrets\/SHIPPING_QUOTE_SECRET/);
 assert.match(src,/existing\.get\("type"\) not in \("secret_text","secret_key"\)/);
 for(const name of ['LIVE_CHECKOUT_ENABLED','LIVE_PAYMENTS_APPROVED','CARRIER_QUOTES_ENABLED'])
  assert.ok(src.includes('"'+name+'"'),name);
 assert.match(src,/b\.get\("text"\)!="false"/);
 assert.match(src,/generated=None/);
 assert.doesNotMatch(src,/print\(generated\)/);
});
test('real-money carrier checkout requires explicit production rate verification',()=>{
 const env={
  SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_test',
  STRIPE_SECRET_KEY:'sk_live_synthetic_fixture',STRIPE_WEBHOOK_SECRET:'whsec_synthetic_fixture',
  SHIPPING_MODE:'live_carrier',SHIPPING_ALLOWED_COUNTRIES:'CA,US',
  CARRIER_QUOTES_ENABLED:'true',SHIPPING_QUOTE_SECRET:'an-ephemeral-fixture-strong-enough-12345678',
  SHIPPING_PACKAGES_JSON:JSON.stringify({'OH-003':{verified:true,weightKg:.35,lengthCm:33,widthCm:26,heightCm:4}}),
  CANADA_POST_API_MODE:'json',CANADA_POST_CLIENT_ID:'synthetic-client',CANADA_POST_CLIENT_SECRET:'synthetic-secret',
  CANADA_POST_TEST_APP:'false',FEDEX_SANDBOX:'false',
  LIVE_CHECKOUT_ENABLED:'true',LIVE_PAYMENTS_APPROVED:'true',TAX_CONFIGURATION_APPROVED:'true'
 };
 assert.equal(secure(env),false,'Do not accept live money merely because a carrier API key was entered');
 assert.equal(secure({...env,CANADA_POST_PRODUCTION_VERIFIED:'true'}),false,'Verified carrier rates alone cannot bypass outstanding payout verification');
 assert.equal(secure({...env,CANADA_POST_PRODUCTION_VERIFIED:'true',LIVE_PAYMENTS_APPROVED:'false'}),false);
 const endpoint=read('functions/api/shipping-quotes.js');
 assert.match(endpoint,/CANADA_POST_PRODUCTION_VERIFIED/);
 assert.match(endpoint,/FEDEX_PRODUCTION_VERIFIED/);
});
test('deployed Worker retains all explicit safety flags disabled',()=>{
 const vars=JSON.parse(read('wrangler.jsonc')).vars;
 for(const v of ['LIVE_CHECKOUT_ENABLED','LIVE_PAYMENTS_APPROVED','TAX_CONFIGURATION_APPROVED','CARRIER_QUOTES_ENABLED','CANADA_POST_PRODUCTION_VERIFIED','FEDEX_PRODUCTION_VERIFIED','US_SHIPPING_APPROVED','CANADA_POST_US_DUTIES_APPROVED'])
  assert.equal(vars[v],'false',v);
});
