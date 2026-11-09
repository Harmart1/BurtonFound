import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname,join} from 'node:path';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFileSync(join(ROOT,path),'utf8');
const parse=path=>JSON.parse(read(path).slice(read(path).indexOf('=')+1).trim().replace(/;\s*$/,''));
test('Product-photo workflow cannot overwrite originals or activate payments',()=>{
 const workflow=read('.github/workflows/photo-polish.yml');
 const script=read('scripts/photo-polish.py');
 for(const key of ['LIVE_CHECKOUT_ENABLED','LIVE_PAYMENTS_APPROVED','TAX_CONFIGURATION_APPROVED','CARRIER_QUOTES_ENABLED'])
  assert.ok(workflow.includes(key),'Missing safety guard '+key);
 assert.match(script,/MAX_SIDE=1900/);
 assert.match(script,/MIN_SIDE=160/);
 assert.match(script,/assets\/images\/polished\//);
 assert.match(script,/manual_review/);
 assert.match(script,/no.*artwork|No artwork/i);
 assert.doesNotMatch(script,/DROP TABLE|DELETE FROM|Stripe\.checkout/);
});
test('Photo-display derivatives preserve 22 existing sale products and 93 non-sale automobile previews',()=>{
 const products=parse('public/products.js').inventory;
 const cars=parse('public/vintage-cars-data.js');
 assert.equal(products.length,22);
 assert.equal(cars.length,93);
 assert.ok(cars.every(c=>c.salesEnabled===false&&!('price' in c)));
 assert.ok(products.every(p=>!p.sku.startsWith('VA-')));
 const manifest=join(ROOT,'reports/photo-polish-audit.json');
 if(!existsSync(manifest))return; // Output not generated until the guarded workflow runs.
 const m=JSON.parse(read('reports/photo-polish-audit.json'));
 assert.equal(m.source_image_count,141);
 assert.equal(m.existing_listing_image_count,48);
 assert.equal(m.automobile_scan_image_count,93);
 assert.equal(m.images.length,141);
 for(const item of m.images){
  assert.ok(existsSync(join(ROOT,'public',item.source)),'Missing original '+item.source);
  assert.ok(existsSync(join(ROOT,'public',item.display)),'Missing derivative '+item.display);
  assert.ok(item.display.startsWith('assets/images/polished/'));
  assert.ok(statSync(join(ROOT,'public',item.display)).size>2000);
 }
 assert.ok(products.every(p=>p.image.includes('/polished/')));
 assert.ok(cars.every(p=>p.image.includes('/polished/')));
});
