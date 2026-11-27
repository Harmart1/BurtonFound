import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('Four visual collection choices include priced automobile listings without checkout claims',()=>{
 const html=read('public/index.html');
 for(const cls of ['spotlight-coke','spotlight-hollywood','spotlight-sets','spotlight-cars'])assert.match(html,new RegExp('class="spotlight '+cls+'"'));
 assert.equal((html.match(/class="spotlight spotlight-/g)||[]).length,4);
 assert.match(html,/href="vintage-cars\.html"/);assert.match(html,/href="\/collections\/automobiles\.html"/);
 assert.match(html,/AUTOMOTIVE ARCHIVE/);
 assert.match(html,/Add your favourites to the bag/);
 assert.match(html,/data-shop-hollywood-sets/);
 assert.doesNotMatch(html,/class="vintage-cars-promo"/);
 assert.match(html,/editorial-refresh\.css/);
 assert.match(html,/noindex, nofollow/);
});
test('Primary store promotes automobile catalogue while original backend sale inventory stays separate',()=>{
 const html=read('public/storefront.html');
 assert.match(html,/class="editorial-archive-band"/);
 assert.match(html,/id="editorialArchiveTitle"/);
 assert.match(html,/published Canadian-dollar price, detailed descriptions and Add to Bag/);
 assert.match(html,/editorial-refresh\.css/);
 const products=read('public/products.js');
 const obj=JSON.parse(products.slice(products.indexOf('=')+1).trim().replace(/;\s*$/,''));
 assert.equal(obj.inventory.length,22);
 assert.equal(obj.inventory.some(x=>x.sku.startsWith('VA-')),false);
});
test('Vintage archive preserves enquiry-only and responsive filter controls',()=>{
 const html=read('public/vintage-cars.html');
 assert.match(html,/noindex, nofollow/);
 assert.match(html,/Shop vintage automobile advertising/);
 for(const id of ['archiveHeroTitle','archiveGalleryTitle','cards','search','brand','era','sort','showMore','imageDialog','viewComfort','viewCompact','clearFilters','showAllSets','toggleOriginal'])
  assert.match(html,new RegExp('id="'+id+'"'),'Missing UI control: '+id);
 assert.match(html,/vintage-cars-refined\.js/);
 assert.match(html,/vintage-cars-refined\.css/);
 const script=read('public/vintage-cars-refined.js');
 assert.match(script,/shown=24/);
 assert.match(script,/dialog\.showModal/);
 assert.match(script,/burton_found_theme/);
 assert.doesNotMatch(script,/api\/checkout|Stripe|addToBag|bf_units/);
 assert.match(script,/Add to bag/);
 const subprocess=spawnSync(process.execPath,['--check',new URL('../public/vintage-cars-refined.js',import.meta.url).pathname],{encoding:'utf8'});
 assert.equal(subprocess.status,0,subprocess.stderr);
});
test('Storefront CSS is responsive and dark theme colors come from established accessible variables',()=>{
 const css=read('public/editorial-refresh.css');
 assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/);
 assert.match(css,/html\[data-theme="dark"\]/);
 assert.match(css,/@media\(max-width:590px\)/);
 assert.match(css,/var\(--ui-ink/);
 assert.match(css,/filter:none!important/);
 const galleryCss=read('public/vintage-cars-refined.css');
 assert.match(galleryCss,/archive-masthead/);
 assert.match(galleryCss,/@media\(max-width:550px\)/);
 assert.match(galleryCss,/archive-dialog/);
});
