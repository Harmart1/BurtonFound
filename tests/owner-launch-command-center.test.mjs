import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../public/admin/launch-readiness.js',import.meta.url),'utf8');
const ctx={window:{},location:{hostname:'burtonfound.timharmar.workers.dev'},console};
runInNewContext(source,ctx,{timeout:2000});
const {build}=ctx.window.BURTON_LAUNCH_READINESS;
const sample={
 checkout:'preview_only',
 supabase:{connected:true,listings:131,available:114},
 stripe:{sandboxKeyPresent:true,webhookSigningKeyPresent:true,taxSettings:'pending',missingTaxFields:['head_office']},
 shipping:{
  mode:'flat_rate',
  canadaPost:{credentialsPresent:false,productionRatesVerified:false,testApp:true},
  fedex:{credentialsPresent:false,productionRatesVerified:false,sandbox:true},
  verifiedPackagesAvailable:false,crossBorderCheckoutApproved:false,canadaPostUsDutiesApproved:false
 },
 approvals:{payoutsVerifiedByOwner:false,taxApproved:false}
};
test('launch command center identifies each real blocker without changing payment state',()=>{
 const m=build(sample,{sellerEmail:''},'burtonfound.timharmar.workers.dev');
 assert.equal(m.storefrontBaseline,229);
 assert.equal(m.backendListings,131);
 assert.equal(m.items.length,11);
 assert.equal(m.actionCount,11);
 assert.equal(m.checkout,'preview_only');
 assert.match(m.headline,/Payments are safely disabled/);
 const catalog=m.items.find(x=>x.id==='stock');
 assert.equal(catalog.status,'attention');
 assert.match(catalog.detail,/98 published listings have no matching checkout SKU/);
 for(const name of ['payouts','tax','flat-rate','canada-post','fedex','parcels','customs','email','domain'])
  assert.equal(m.items.find(x=>x.id===name).status,'attention',name);
 assert.match(m.items.find(x=>x.id==='stripe').detail,/validity must be checked separately/);
 assert.match(m.items.find(x=>x.id==='email').detail,/not configured/);
});
test('credential flags are never interpreted as actual real-money approval',()=>{
 const modified=JSON.parse(JSON.stringify(sample));
 modified.approvals.payoutsVerifiedByOwner=true;
 modified.approvals.taxApproved=true;
 modified.stripe.taxSettings='active';
 modified.shipping.canadaPost={credentialsPresent:true,productionRatesVerified:true,testApp:false};
 modified.shipping.fedex={credentialsPresent:true,productionRatesVerified:true,sandbox:false};
 modified.checkout='test_mode';
 const m=build(modified,{sellerEmail:'support@example.org'},'store.example.org');
 assert.equal(m.items.find(x=>x.id==='payouts').status,'review');
 assert.equal(m.items.find(x=>x.id==='tax').status,'review');
 assert.equal(m.items.find(x=>x.id==='canada-post').status,'review');
 assert.equal(m.items.find(x=>x.id==='fedex').status,'review');
 assert.equal(m.items.find(x=>x.id==='domain').status,'review');
 assert.equal(m.items.find(x=>x.id==='email').status,'attention','Test email is not evidence of actual delivery');
 assert.match(m.headline,/Sandbox checkout/);
});
test('unknown data never fabricates database inventory or confirmation',()=>{
 const m=build({}, {sellerEmail:''},'burtonfound.timharmar.workers.dev');
 assert.equal(m.backendListings,null);
 assert.match(m.items.find(x=>x.id==='stock').detail,/could not be checked/);
 assert.match(m.items.find(x=>x.id==='stripe').detail,/presence alone/);
});
test('private dashboard loads and renders launch module with authenticated readiness endpoint',()=>{
 const html=readFileSync(new URL('../public/admin/orders.html',import.meta.url),'utf8');
 const admin=readFileSync(new URL('../public/admin/admin.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../public/admin/admin.css',import.meta.url),'utf8');
 assert.match(html,/Launch command center/);
 assert.ok(html.indexOf('launch-readiness.js')<html.indexOf('src="admin.js"'));
 assert.match(admin,/BURTON_LAUNCH_READINESS\?\.render/);
 assert.match(admin,/\/api\/admin\/readiness/);
 assert.match(css,/\.launch-overview/);
 assert.match(css,/--ui-surface/);
 assert.doesNotMatch(source,/sk_live_[A-Za-z0-9]{8,}|sb_secret_[A-Za-z0-9]{8,}|whsec_[A-Za-z0-9]{8,}/);
});

test('owner sees provisional shipping rates without representing them as approved',()=>{
 const v=JSON.parse(JSON.stringify(sample));v.shipping.flatRates={approved:false,CA:{standard:1995,express:3495},US:{standard:2995,express:4995}};
 const row=build(v).items.find(x=>x.id==='flat-rate');
 assert.equal(row.status,'attention');assert.match(row.detail,/CAD 19\.95/);assert.match(row.detail,/CAD 29\.95/);assert.match(row.detail,/Draft amounts only/);
});
