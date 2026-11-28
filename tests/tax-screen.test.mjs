import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const ctx={window:{},document:{getElementById:()=>null}};
runInNewContext(readFileSync(new URL('../public/admin/tax-screen.js',import.meta.url),'utf8'),ctx);
const T=ctx.window.BURTON_TAX_SCREEN;
test('five UTC quarter periods include four completed quarters and current partial period',()=>{
 const q=T.quarters(new Date('2026-11-27T20:00:00Z'));
 assert.equal(q.length,5);assert.equal(q[0].from,'2025-10-01');assert.equal(q[3].to,'2026-09-30');assert.equal(q[4].from,'2026-10-01');assert.equal(q[4].to,'2026-11-27');assert.equal(q[4].partial,true);
});
test('screen tests exact statutory threshold, rolling quarters and incomplete amounts',()=>{
 assert.equal(T.screen([0,0,0,0,3000000]).exceeded,false);
 assert.equal(T.screen([0,0,0,0,3000001]).exceeded,true);
 assert.equal(T.screen([750001,750000,750000,750000,0]).exceeded,true);
 assert.equal(T.screen([0,750001,750000,750000,750000]).exceeded,true);
 assert.equal(T.screen([0,0,0,0,2400000]).near,true);
 assert.equal(T.screen([0,0,0,0,null]),null);
});
