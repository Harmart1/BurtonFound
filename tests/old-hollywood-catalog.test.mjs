import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
const root=process.cwd();
const file=p=>join(root,p);
test('Old Hollywood intake includes 73 real image scans, 71 review prices, 9 groups, no stock',()=>{
 const js=readFileSync(file('public/old-hollywood-catalog.js'),'utf8');
 const raw=js.split('window.BURTON_HOLLYWOOD_DRAFT_CATALOG = ')[1]?.trim().replace(/;$/,'');
 assert.ok(raw,'missing catalogue assignment');
 const c=JSON.parse(raw);
 assert.equal(c.currency,'CAD'); assert.equal(c.groups.length,9); assert.equal(c.entries.length,73);
 assert.equal(new Set(c.entries.map(x=>x.id)).size,73);
 assert.equal(c.entries.filter(x=>x.suggestedCad===null).length,2);
 for(const item of c.entries){
  assert.ok(item.description.length>45,item.id);
  assert.ok(item.title.length>10,item.id);
  assert.ok(item.availableForCheckout===false,item.id);
  assert.ok(/^assets\/images\/old-hollywood\/ohnew-\d{3}-\d{2}\.webp$/.test(item.image),item.id);
  assert.ok(existsSync(file('public/'+item.image)),item.image);
  if(item.suggestedCad!==null)assert.ok(item.suggestedCad>=14&&item.suggestedCad<=35,item.id);
 }
 assert.ok(c.entries.find(x=>x.id==='OHN-005-08').suggestedCad===null);
 assert.ok(c.entries.find(x=>x.id==='OHN-007-08').suggestedCad===null);
 const html=readFileSync(file('public/old-hollywood-new.html'),'utf8');
 assert.ok(html.includes('old-hollywood-catalog.js'));
 assert.ok(html.includes('id="cards"'));
 for(const p of ['public/old-hollywood-catalog.js','public/old-hollywood-intake.js'])execFileSync(process.execPath,['--check',file(p)]);
 const productSource=readFileSync(file('public/products.js'),'utf8');
 const main=JSON.parse(productSource.slice(productSource.indexOf('=')+1).trim().replace(/;$/,''));
 assert.equal(main.inventory.length,22,'live checkout inventory must not be changed by archive');
});
