import test from 'node:test';
import assert from 'node:assert/strict';
import {validActivity,onRequestPost} from '../functions/api/activity.js';
import worker from '../src/worker.js';
const base='https://burtonandfound.ca';
test('only fixed aggregate activity fields accepted',()=>{
 assert.equal(validActivity({event:'page_view',collection:'automobiles'}),true);
 assert.equal(validActivity({event:'checkout_open',collection:'other'}),true);
 for(const v of [{event:'page_view',collection:'home',email:'x'},{event:'page_view',collection:'CC-001'},{event:'purchase',collection:'home'},null,[]])assert.equal(validActivity(v),false);
});
test('cross-origin analytics blocked, preview and privacy signals do not count',async()=>{
 const req=(headers={})=>new Request(base+'/api/activity',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:'{"event":"page_view","collection":"home"}'});
 assert.equal((await onRequestPost({request:req({Origin:'https://example.org'}),env:{}})).status,403);
 assert.equal((await onRequestPost({request:req({Origin:base,'Sec-GPC':'1'}),env:{}})).status,204);
 assert.equal((await onRequestPost({request:req({Origin:base}),env:{}})).status,204);
 assert.equal((await worker.fetch(new Request(base+'/api/admin/activity'),{},{})).status,403);
});
