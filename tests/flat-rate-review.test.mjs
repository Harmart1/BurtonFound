import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {plan,costReview} from '../scripts/prepare-flat-rate-review.mjs';
const vars=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url))).vars;
test('plan covers all four package types and approved destination/service prices',()=>{
 const rows=plan(vars);assert.equal(rows.length,56);
 assert.equal(new Set(rows.map(r=>r.profile)).size,4);
 assert.ok(rows.every(r=>r.charged===Number(vars['SHIPPING_'+r.service+'_'+r.country+'_CENTS'])));
 assert.ok(rows.filter(r=>r.country==='US').every(r=>/blocked/.test(r.customs)));
 assert.throws(()=>plan({...vars,FLAT_RATE_PRICES_APPROVED:'false'}));
});
test('contribution requires every actual expense including zero',()=>{
 assert.deepEqual(costReview(1995,[1400,200,0,0]),{cost:1600,contribution:395});
 assert.equal(costReview(2995,[2000,200,null,0]),null);
 assert.equal(costReview(2995,[3000,200,100,0]).contribution,-305);
});
