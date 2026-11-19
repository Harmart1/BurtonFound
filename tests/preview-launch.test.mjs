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
 assert.ok(html.includes('104</strong>'));
 assert.ok(html.includes('88</strong>'));
 assert.ok(html.includes('11</strong>'));
 assert.ok(html.includes('Online card payment is not yet active'));
 assert.ok(html.includes('id="prFeaturedGrid"'));
 assert.ok(html.includes('id="prFeaturedStatus"'));
 assert.ok(html.includes('id="featured"'));
 assert.ok(html.includes('href="#reviewMain"'));
 assert.ok(html.includes('id="reviewMain"'));
 assert.equal((html.match(/data-pr-collection=/g)||[]).length,3);
 for(const id of ['hollywood','sets','coca-cola'])
   assert.ok(html.includes('data-pr-collection="'+id+'"'));
 for(const ref of ['preview-launch.css','preview-launch.js','preview.js','products.js',
   'old-hollywood-item-data.js','old-hollywood-sets-data.js','old-hollywood-products.js','featured-merchandising.js'])
   assert.ok(html.includes('src="'+ref+'"')||html.includes('href="'+ref+'"'),ref);
 assert.ok(html.indexOf('src="old-hollywood-products.js"')<html.indexOf('src="preview-launch.js"'));
 assert.ok(html.includes('name="robots"'));
 assert.ok(read('public/preview-launch.css').includes('@media(max-width:520px)'));
 assert.ok(read('public/preview-launch.css').includes('html[data-theme="dark"]'));
 for(const f of ['preview-launch.js','preview.js'])execFileSync(process.execPath,['--check',file('public/'+f)]);
});

test('interactive preview reads the same 104 real products, switches all three groups, and links to real SKUs',()=>{
 const buttons=['hollywood','sets','coca-cola'].map(key=>({
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
   'old-hollywood-products.js','featured-merchandising.js','preview-launch.js'])
   runInNewContext(read('public/'+f),ctx,{filename:f});
 const all=ctx.window.BURTON_DATA.inventory;
 assert.equal(all.length,104);
 const raw=all.filter(x=>x.collection==='hollywood');
 assert.equal(raw.length,88);
 assert.equal(all.filter(x=>x.collection==='coca-cola').length,16);
 assert.equal((grid.innerHTML.match(/class="pr-product"/g)||[]).length,4);
 assert.ok(grid.innerHTML.includes('OH-003'));
 assert.ok(grid.innerHTML.includes('$39.95'));
 assert.equal(buttons[0].attrs['aria-pressed'],'true');
 buttons[1].events.click();
 assert.ok(grid.innerHTML.includes('OHS-003'));
 assert.ok(grid.innerHTML.includes('$156.95'));
 assert.ok(grid.innerHTML.includes('index.html?item=OHS-003#shop'));
 assert.equal(buttons[1].attrs['aria-pressed'],'true');
 buttons[2].events.click();
 assert.ok(grid.innerHTML.includes('CC-010'));
 assert.ok(grid.innerHTML.includes('index.html?item=CC-010#shop'));
 assert.equal(buttons[2].attrs['aria-pressed'],'true');
 assert.match(status.textContent,/Coca-Cola vintage advertising/);
});

test('preview sharing goes to preview page and merchant feedback without email never falsely claims submission',()=>{
 const src=read('public/preview.js');
 assert.ok(src.includes("new URL('preview.html',location.href)"));
 assert.ok(src.includes("if(!address){try{await copy(feedback())"));
 assert.ok(!src.includes("new URL('./',location.href).href"));
 assert.ok(!src.includes("Your email application should open; choose the owner"));
});
