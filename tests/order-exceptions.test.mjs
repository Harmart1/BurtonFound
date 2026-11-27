import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const ctx={window:{}};runInNewContext(readFileSync(new URL('../public/admin/operations-core.js',import.meta.url),'utf8'),ctx);
const O=ctx.window.BURTON_OPERATIONS;
const row={id:'r1',created_at:'2026-11-27',stripe_session_id:'cs_live_fixture',payment_status:'paid',fulfillment_status:'processing',subtotal_cents:1000,shipping_cents:500,total_cents:1500,email:'private@example.invalid'};
test('exception report excludes clean paid and other-mode rows; never guesses refund amounts',()=>{
 const orders=[row,{...row,id:'r2',payment_status:'refunded'},{...row,id:'r3',payment_status:'review'},{...row,id:'r4',stripe_session_id:'cs_test_fixture',payment_status:'refunded'},{...row,id:'r5',total_cents:10}];
 const rows=O.exceptions(orders,'live');assert.deepEqual(rows.map(r=>r.id).sort().join(','),'r2,r3,r5');assert.ok(rows.every(r=>r.reported===null));
 const csv=O.exceptionCsv(rows,'live');assert.doesNotMatch(csv,/private@example|cs_test/);assert.match(csv,/not settled/);
 const testRows=O.exceptions(orders,'test');assert.equal(testRows.length,1);assert.match(testRows[0].action,/no real refund/);
});
test('Stripe reported refunds and disputes are review flags, not confirmed settled totals',()=>{
 const rows=O.exceptions([row],'live',[{id:'r1',refund_reported_cents:500,issues:['Disputed charge — manual review']}]);
 assert.equal(rows.length,1);assert.equal(rows[0].reported,500);assert.match(rows[0].flags.join(' '),/settlement not verified/);assert.match(rows[0].flags.join(' '),/Disputed charge/);
});
