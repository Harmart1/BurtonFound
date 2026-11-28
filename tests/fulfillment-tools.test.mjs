import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {execFileSync} from 'node:child_process';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const c={window:{},Intl};runInNewContext(read('public/admin/fulfillment-tools.js'),c);
const F=c.window.BURTON_FULFILLMENT;
const row={id:'order-fixture',record_mode:'live',payment_status:'paid',fulfillment_status:'processing',subtotal_cents:5000,shipping_cents:1995,total_cents:6995,email:'buyer@example.invalid',customer_name:'<script>alert(1)</script>',created_at:'2026-11-27T12:00:00Z',item_lines:[{sku:'OH-003',title:'<img src=x>',price_cents:5000}]};
test('documents and customer drafts exclude sandbox, unknown, unpaid, inconsistent and unresolved orders',()=>{
 for(const o of [{...row,record_mode:'test'},{...row,record_mode:'unknown'},{...row,payment_status:'refunded'},{...row,shipping_review_reason:'Mismatch'},{...row,total_cents:1},{...row,subtotal_cents:4999},{...row,fulfillment_status:'needs_attention'}]){
 assert.equal(F.ready(o),false);assert.equal(F.summary(o,'support@example.invalid'),null);assert.equal(F.draft(o,'confirmation','support@example.invalid'),null);
 }
 assert.equal(F.ready(row),true);
 const html=F.summary(row,'support@example.invalid');assert.match(html,/&lt;script&gt;/);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<script>|<img src=x>/);assert.match(html,/not a GST\/HST tax invoice/);
});
test('dispatch message needs saved carrier and tracking; no email header injection',()=>{
 assert.equal(F.draft(row,'dispatch','support@example.invalid'),null);
 assert.equal(F.draft({...row,email:'buyer@example.invalid\nBcc:x'},'confirmation','support@example.invalid'),null);
 const sent={...row,fulfillment_status:'shipped',carrier:'Canada Post',tracking_number:'TESTTRACK'};
 assert.match(F.draft(sent,'dispatch','support@example.invalid').body,/TESTTRACK/);
 assert.match(F.draft(row,'confirmation','support@example.invalid').body,/payment received/);
});
test('shipping expenses are exact cents and reject incomplete or negative values',()=>{
 assert.equal(F.parseCAD('19.95'),1995);assert.equal(F.parseCAD(''),null);assert.equal(F.parseCAD('-1'),null);assert.equal(F.parseCAD('1.005'),null);
 const a=F.contribution(1995,1200,200,0,100);assert.equal(a.costs,1500);assert.equal(a.contribution,495);
 assert.equal(F.contribution(1995,2200,200,0,0).contribution,-405);
 assert.equal(F.contribution(1995,1200,null,0,0),null);
});
test('new tools are integrated into owner dashboard without a new public order endpoint',()=>{
 const html=read('public/admin/orders.html'),admin=read('public/admin/admin.js');
 assert.ok(html.indexOf('fulfillment-tools.js')<html.indexOf('src="admin.js"'));
 assert.match(admin,/F\?\.shippingReady/);assert.match(admin,/case 'summary'/);assert.match(admin,/case 'shipping-cost'/);assert.match(admin,/nothing has been sent by this website/);
 execFileSync(process.execPath,['--check',new URL('../public/admin/admin.js',import.meta.url).pathname]);
});

test('batch picking sheet excludes unsafe and dispatched orders, escapes listing data and omits buyer details',()=>{
 const good={...row,customer_name:'PRIVATE CUSTOMER',email:'private@example.invalid',shipping_address:{address:{line1:'PRIVATE ADDRESS'}},id:'eligible-first',created_at:'2026-11-26T12:00:00Z'};
 const packed={...good,id:'eligible-second',created_at:'2026-11-27T12:00:00Z',fulfillment_status:'packed'};
 const excluded=[
 {...good,id:'excluded-sandbox',record_mode:'test'},
 {...good,id:'excluded-unknown',record_mode:'unknown'},
 {...good,id:'excluded-unpaid',payment_status:'refunded'},
 {...good,id:'excluded-review',shipping_review_reason:'Mismatch'},
 {...good,id:'excluded-shipped',fulfillment_status:'shipped'},
 {...good,id:'excluded-delivered',fulfillment_status:'delivered'},
 {...good,id:'excluded-attention',fulfillment_status:'needs_attention'},
 {...good,id:'excluded-inconsistent',total_cents:1}
 ];
 assert.equal(F.pickSheet(excluded),null);assert.equal(F.pickSheet([]),null);
 const sheet=F.pickSheet([packed,...excluded,good]);
 assert.match(sheet,/2 eligible order\(s\)/);
 assert.ok(sheet.indexOf('eligible-first')<sheet.indexOf('eligible-second'));
 assert.doesNotMatch(sheet,/excluded-|PRIVATE CUSTOMER|PRIVATE ADDRESS|private@example\.invalid|<img src=x>/);
 assert.match(sheet,/&lt;img src=x&gt;/);
 assert.match(sheet,/Sets may contain multiple physical pieces/);
 assert.match(read('public/admin/admin.js'),/F\?\.pickSheet\(filtered\(\)\)/);
});
