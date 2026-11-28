import test from 'node:test';
import assert from 'node:assert/strict';
import {validate} from '../scripts/validate-owner-stock-review.mjs';
const now=Date.parse('2026-11-28T04:00:00Z');
const snapshot={configured:true,items:[{sku:'CC-010',price_cents:3995,available:true}]};
const row={sku:'CC-010',physical_unit:'CC-010',price_cents:3995,owner_reports:{located:true,condition_matches:true,unit_confirmed:true,approved_candidate:true},packed:{kg:.15,length_cm:35,width_cm:28,height_cm:1}};
const review={schema:'burton-found-stock-review-v1',scope:'CA',planning_only:true,requires_independent_recheck:true,stock_snapshot_checked_at:'2026-11-28T03:50:00Z',review_exported_at:'2026-11-28T03:55:00Z',reviewed_candidates:[row]};
test('valid completed review produces only a proposed SKU list and never authorizes production',()=>{
 const r=validate(review,snapshot,now);assert.equal(r.reviewed_count,1);assert.deepEqual(r.proposed_skus,['CC-010']);assert.equal(r.production_authorized,false);
});
test('reject stale, duplicated, incomplete and changed inventory reviews',()=>{
 for(const invalid of [{...review,stock_snapshot_checked_at:'2026-11-01T00:00:00Z'},{...review,reviewed_candidates:[row,row]},{...review,reviewed_candidates:[{...row,packed:{...row.packed,kg:0}}]},{...review,reviewed_candidates:[{...row,physical_unit:'OTHER'}]},{...review,scope:'US'}])assert.throws(()=>validate(invalid,snapshot,now));
 assert.throws(()=>validate(review,{...snapshot,items:[{...snapshot.items[0],available:false}]},now));
 assert.throws(()=>validate(review,{...snapshot,items:[{...snapshot.items[0],price_cents:4095}]},now));
});
