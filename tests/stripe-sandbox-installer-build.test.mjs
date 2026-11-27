import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('sandbox installer builds generated assets and enforces preview guard before credentials',()=>{
 const y=readFileSync(new URL('../.github/workflows/install-stripe-sandbox-secrets.yml',import.meta.url),'utf8');
 for(const marker of ['npm run build:marketing','node scripts/assert-preview-release.mjs','npm run check:deploy','npm test','Confirm sandbox API key is valid','Install only test Stripe secrets'])assert.ok(y.includes(marker),marker);
 const sequence=['npm run build:marketing','node scripts/assert-preview-release.mjs','npm run check:deploy','npm test','Confirm sandbox API key is valid','Install only test Stripe secrets'];
 assert.deepEqual(sequence.map(x=>y.indexOf(x)),sequence.map(x=>y.indexOf(x)).sort((a,b)=>a-b));
});
