import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const ctx={window:{}};runInNewContext(read('public/admin/launch-wizard.js'),ctx);
const W=ctx.window.BURTON_LAUNCH_WIZARD;
test('domestic first has seven steps; US scope adds explicit customs review',()=>{
 const ca=W.plan('CA'),us=W.plan('CA,US');
 assert.equal(ca.length,7);assert.equal(us.length,8);
 assert.equal(ca.some(x=>x.id==='us'),false);assert.equal(us.some(x=>x.id==='us'),true);
 assert.equal(ca[0].id,'contact');assert.equal(ca.at(-1).id,'approve');
});
test('unknown or incomplete configuration is never represented as verified',()=>{
 assert.ok(W.checks({},{}).every(x=>!x.ok));
 const v={checkout:'preview_only',approvals:{checkoutEnabled:false,livePaymentApproved:false,physicalStockApproved:true,domesticPostageVerified:true,customerEmailDeliveryApproved:true,sellerTermsApproved:true,productionWebhookReady:true},supabase:{connected:true},shipping:{flatRates:{approved:true,CA:{standard:1995,express:3495},US:{standard:2995,express:4995}},crossBorderCheckoutApproved:false,canadaPostUsDutiesApproved:false}};
 assert.ok(W.checks(v,{sellerEmail:'support@example.invalid'}).every(x=>x.ok));
 assert.equal(W.checks({...v,checkout:'live_mode'},{}).find(x=>x.label==='Checkout locked').ok,false);
 assert.equal(W.checks({...v,shipping:{...v.shipping,crossBorderCheckoutApproved:true}},{}).find(x=>x.label==='US checkout remains blocked').ok,false);
});
test('review marks do not count as actual verification or payment authorization',()=>{
 const report=W.report('CA',new Set(['contact','approve']),{},{});assert.match(report,/NOT authorization/);assert.match(report,/Owner marked reviewed \(not independently verified\): Verify customer email/);assert.match(report,/Outstanding: Confirm physical originals/);
 assert.doesNotMatch(read('public/admin/launch-wizard.js'),/\bfetch\s*\(|localStorage\.|sessionStorage\.|sendBeacon\(/);
 const html=read('public/admin/orders.html'),admin=read('public/admin/admin.js');
 assert.ok(html.indexOf('launch-wizard.js')<html.indexOf('src="admin.js"'));
 assert.match(admin,/BURTON_LAUNCH_WIZARD\?\.render\(v/);
 assert.ok(html.indexOf('id="launchWizard"')>html.indexOf('id="dashboard"'));
});
