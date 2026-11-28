import test from 'node:test';
import assert from 'node:assert/strict';
import {eligible} from '../scripts/prepare-canada-live-release.mjs';
const product={sku:'CC-010',price:39.95,collection:'coca-cola',type:'original',catalogIds:['unit-1']};
const catalogue=[product,{...product,sku:'OH-001',collection:'hollywood',catalogIds:['unit-2']},{...product,sku:'VA-001',collection:'automobiles'},...Array.from({length:226},(_,i)=>({...product,sku:'VA-'+(i+100),collection:'automobiles'}))];
const snapshot={configured:true,items:[{sku:'CC-010',price_cents:3995,available:true},{sku:'OH-001',price_cents:3995,available:true},{sku:'VA-001',price_cents:3995,available:true}]};
test('eligible Canadian candidates exclude automotive and include approved ordinary items',()=>{
 const result=eligible(catalogue,snapshot);assert.equal(result.length,2);assert.equal(result[0].sku,'CC-010');assert.equal(result[1].sku,'OH-001');
});
test('changed price, missing or unavailable stock and invalid snapshots fail closed',()=>{
 assert.equal(eligible(catalogue,{...snapshot,items:snapshot.items.map(r=>r.sku==='OH-001'?{...r,available:false}:r)}).length,1);
 assert.equal(eligible(catalogue,{...snapshot,items:snapshot.items.map(r=>r.sku==='OH-001'?{...r,price_cents:4095}:r)}).length,1);
 assert.throws(()=>eligible(catalogue,{configured:false}));
 assert.throws(()=>eligible(catalogue,{...snapshot,items:[...snapshot.items,snapshot.items[0]]}));
 assert.throws(()=>eligible(catalogue.slice(1),snapshot));
});
