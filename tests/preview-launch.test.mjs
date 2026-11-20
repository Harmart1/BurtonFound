import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
const root=process.cwd();
const file=p=>join(root,p);
const read=p=>readFileSync(file(p),'utf8');

test('release preview features accurate catalogue counts, collection entry points and public payment disclosure',()=>{
 const html=read('public/preview.html');
 const setup=JSON.parse(read('wrangler.jsonc'));
 assert.equal(setup.vars.LIVE_CHECKOUT_ENABLED,'false');
 assert.equal(setup.vars.LIVE_PAYMENTS_APPROVED,'false');
 assert.equal(setup.vars.TAX_CONFIGURATION_APPROVED,'false');
 assert.ok(html.includes('229</strong>'));
 assert.ok(html.includes('43</strong>'));
 assert.ok(html.includes('35</strong>'));
 assert.ok(html.includes('Online card payment is not yet active'));
 assert.ok(html.includes('id="prFeaturedGrid"'));
 assert.ok(html.includes('id="prFeaturedStatus"'));
 assert.ok(html.includes('id="featured"'));
 assert.ok(html.includes('href="#reviewMain"'));
 assert.ok(html.includes('id="reviewMain"'));
 assert.equal((html.match(/data-pr-collection=/g)||[]).length,4);
 for(const id of ['hollywood','sets','coca-cola','automobiles'])
   assert.ok(html.includes('data-pr-collection="'+id+'"'));
 for(const ref of ['preview-launch.css','preview-launch.js','preview.js','products.js',
   'old-hollywood-item-data.js','old-hollywood-sets-data.js','old-hollywood-products.js','coke-new-products.js','coke-archive-singles.js','vintage-cars-data.js','vintage-cars-sets.js','vintage-cars-products.js','featured-merchandising.js'])
   assert.ok(html.includes('src="'+ref+'"')||html.includes('href="'+ref+'"'),ref);
 assert.ok(html.indexOf('src="old-hollywood-products.js"')<html.indexOf('src="preview-launch.js"'));
 assert.ok(html.includes('name="robots"'));
 assert.ok(read('public/preview-launch.css').includes('@media(max-width:520px)'));
 assert.ok(read('public/preview-launch.css').includes('html[data-theme="dark"]'));
 for(const f of ['preview-launch.js','preview.js'])execFileSync(process.execPath,['--check',file('public/'+f)]);
});

test('interactive preview reads 229 catalogue items across four themes with recommended automobile asking prices',()=>{
 const buttons=['coca-cola','hollywood','sets','automobiles'].map(key=>({
   dataset:{prCollection:key},attrs:{},
   events:{},setAttribute(name,value){this.attrs[name]=value},
   addEventListener(name,callback){this.events[name]=callback}
 }));
 const grid={innerHTML:''},status={textContent:''};
 const document={
   getElementById(id){return id==='prFeaturedGrid'?grid:id==='prFeaturedStatus'?status:null},
   querySelectorAll(query){return query==='[data-pr-collection]'?buttons:[]}
 };
 const ctx={window:{},document,console:{warn(){}},Intl,encodeURIComponent};
 for(const f of ['products.js','old-hollywood-item-data.js','old-hollywood-sets-data.js',
   'old-hollywood-products.js','coke-new-products.js','coke-archive-singles.js','vintage-cars-data.js','vintage-cars-sets.js','vintage-cars-products.js','featured-merchandising.js','preview-launch.js'])
   runInNewContext(read('public/'+f),ctx,{filename:f});
 const all=ctx.window.BURTON_DATA.inventory;
 assert.equal(all.length,229);
 const raw=all.filter(x=>x.collection==='hollywood');
 assert.equal(raw.length,88);
 assert.equal(all.filter(x=>x.collection==='coca-cola').length,43);
 assert.equal((grid.innerHTML.match(/class="pr-product"/g)||[]).length,4);
 assert.ok(grid.innerHTML.includes('CC-NEW-001'));
 assert.ok(grid.innerHTML.includes('$24.95'));
 assert.equal(buttons[0].attrs['aria-pressed'],'true');
 buttons[1].events.click();
 assert.ok(grid.innerHTML.includes('OH-003'));
 assert.ok(grid.innerHTML.includes('$39.95'));
 assert.ok(grid.innerHTML.includes('index.html?item=OH-003#shop'));
 assert.equal(buttons[1].attrs['aria-pressed'],'true');
 buttons[2].events.click();
 assert.ok(grid.innerHTML.includes('OHS-003'));
 assert.ok(grid.innerHTML.includes('index.html?item=OHS-003#shop'));
 assert.equal(buttons[2].attrs['aria-pressed'],'true');
 assert.match(status.textContent,/curated Hollywood sets/);
 buttons[3].events.click();
 assert.ok(grid.innerHTML.includes('VA-049'));
 assert.doesNotMatch(grid.innerHTML,/Indicative|VERIFY STOCK/);
 assert.match(status.textContent,/Automobile advertisements display CAD asking prices/);
 assert.equal(buttons[3].attrs['aria-pressed'],'true');
});

test('preview sharing works without visitor reviews, forms or feedback menu items',()=>{
 const src=read('public/preview.js');
 const page=read('public/preview.html');
 const retired=read('public/review.html');
 assert.ok(src.includes("new URL('preview.html',location.href)"));
 assert.ok(src.includes("navigator.share"));
 assert.ok(src.includes("shareCopy"));
 assert.ok(src.includes("shareEmail"));
 assert.ok(src.includes("shareFacebook"));
 assert.ok(!/feedback\(|reviewForm|reviewStatus|emailFeedback|copyFeedback|saveFeedback/.test(src));
 assert.ok(!/href="#feedback"|id="feedback"|reviewForm|copyFeedback|emailFeedback|saveFeedback|Give feedback|Share your feedback/i.test(page));
 assert.ok(!/feedback/i.test(page),'No public-facing visitor feedback invitation should remain');
 assert.ok(page.includes('Share a good <em>find</em>'));
 assert.ok(page.includes('pr-collection-nav'));
 assert.ok(retired.includes('url=preview.html'),'Old review links should redirect to the presentation');
 assert.ok(!retired.includes('reviewForm'));
});
test('automobile preview scripts load synchronously before merchandising and visual rendering',()=>{
 const page=read('public/preview.html');
 const sources=[
   'products.js','old-hollywood-item-data.js','old-hollywood-sets-data.js',
   'old-hollywood-products.js','coke-new-products.js','coke-archive-singles.js',
   'vintage-cars-data.js','vintage-cars-sets.js','vintage-cars-products.js',
   'featured-merchandising.js','preview-launch.js'
 ];
 let previous=-1;
 for(const source of sources){
   const match=page.match(new RegExp('<script([^>]*)src="'+source.replaceAll('.','\\.')+'"([^>]*)><\\/script>'));
   assert.ok(match,'Missing '+source);
   assert.ok(!/\bdefer\b|\basync\b/i.test(match[1]+match[2]),'Must execute in order: '+source);
   const pos=page.indexOf('src="'+source+'"');
   assert.ok(pos>previous,'Source must run before preview renderer: '+source);
   previous=pos;
 }
 assert.equal((page.match(/data-pr-collection=/g)||[]).length,4);
 assert.ok(page.includes('Vintage automobiles'));
 assert.ok(page.includes('229</strong>'));
 assert.ok(page.includes('Online card payment is not yet active'));
 assert.ok(existsSync(file('public/assets/images/curated/vintage-cars/va-049.webp')));
});
