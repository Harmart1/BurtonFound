import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cmsActor,isManager,isOwner,validateCmsInput} from '../functions/_lib/cms.js';
import {onRequestPost as manage} from '../functions/api/cms/manage.js';
import {onRequestPost as team} from '../functions/api/cms/team.js';
import {onRequestPost as media} from '../functions/api/cms/media.js';
import {onRequestGet as published} from '../functions/api/cms/published.js';
const read=(file)=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const env={SUPABASE_URL:'https://nyvdrgpcwfasajyncnhi.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_fake_for_local_tests'};
const req=(method='POST',path='/api/cms/manage',headers={})=>new Request('https://burtonfound.timharmar.workers.dev'+path,{method,headers:{origin:'https://burtonfound.timharmar.workers.dev',...headers},body:method==='POST'?'{}':undefined});
const example={title:'Example vintage car advertisement',summary:'A mint-green motor car in a period magazine advertisement.',description:'A collectible advertisement page shown in the photographs, with its physical condition still unverified.',brand:'Cadillac',year:null,image:'assets/images/curated/vintage-cars/va-001.webp',suggestedPriceCAD:19.95};

test('CMS validators allow descriptive content but never allow sales, stock, arbitrary external images or scripts',()=>{
 const clean=validateCmsInput('automobile','VA-001',example,env);
 assert.equal(clean.suggestedPriceCAD,19.95);
 assert.equal(clean.year,null);
 assert.ok(!('salesEnabled' in clean));
 assert.throws(()=>validateCmsInput('automobile','VA-001',{...example,salesEnabled:true},env),/restricted/);
 assert.throws(()=>validateCmsInput('automobile','VA-001',{...example,image:'javascript:alert(1)'},env),/Use an existing/);
 assert.throws(()=>validateCmsInput('automobile','VA-001',{...example,image:'https://other-site.example/unsafe.svg'},env),/Use an existing/);
 assert.throws(()=>validateCmsInput('automobile','VA-001',{...example,suggestedPriceCAD:-1},env),/valid CAD/);
 assert.throws(()=>validateCmsInput('set','CMS-SET-1',{title:'Set',description:'A short set',theme:'Cars',suggestedSetPriceCAD:40,componentSkus:['VA-001','VA-001']},env),/unique/);
 assert.throws(()=>validateCmsInput('page','admin-controls',{headline:'Tempting',body:'No'},env),/Unsupported/);
 const p=validateCmsInput('product','CC-001',{title:'Original Coke',shortDescription:'A period advertising page',description:'Paper collectible',priceCAD:29.95,collection:'coca-cola',image:'assets/images/polished/cc-001.webp',condition:'Good',year:1938},env);
 assert.equal(p.priceCAD,29.95);assert.equal(p.collection,'coca-cola');
 const media=env.SUPABASE_URL+'/storage/v1/object/public/bf-cms-media/catalogue/abc123.webp';
 assert.equal(validateCmsInput('automobile','CMS-VA-001',{...example,image:media},env).image,media);
});
test('Editor, manager and owner privileges are distinct',()=>{
 assert.equal(isOwner({role:'owner'}),true);
 assert.equal(isOwner({role:'manager'}),false);
 assert.equal(isManager({role:'editor'}),false);
 assert.equal(isManager({role:'manager'}),true);
 assert.equal(isManager({role:'owner'}),true);
});
test('Anonymous visitors cannot save, grant staff permissions or upload a photo',async()=>{
 for(const [handler,path] of [[manage,'manage'],[team,'team'],[media,'media']]){
  const r=await handler({request:req('POST','/api/cms/'+path),env});
  assert.equal(r.status,403,'Anonymous '+path+' must be denied');
 }
 const identity=await cmsActor(req('GET','/api/cms/studio'),env);
 assert.equal(identity,null);
});
test('Cross-origin CMS mutations are refused before authentication',async()=>{
 for(const handler of [manage,team,media]){
  const r=await handler({request:req('POST','/api/cms/manage',{origin:'https://attacker.example'}),env});
  assert.equal(r.status,403);
 }
});
test('Private CMS tables and publish RPC are not exposed to anonymous database clients',()=>{
 const schema=read('supabase/migrations/005_delegated_cms.sql');
 for(const table of ['bf_cms_members','bf_cms_entries','bf_cms_audit']){
  assert.match(schema,new RegExp('alter table public\\.'+table+' enable row level security'));
 }
 assert.match(schema,/revoke all on public.bf_cms_members,public.bf_cms_entries,public.bf_cms_audit from anon,authenticated/);
 assert.match(schema,/revoke all on function public.bf_cms_publish/);
 assert.match(schema,/update public.bf_products set price_cents/);
});
test('Private admin interface and public dynamic readers are registered and non-sale guards remain intact',()=>{
 const worker=read('src/worker.js');
 for(const path of ['/api/cms/published','/api/cms/manage','/api/cms/team','/api/cms/media','/api/cms/studio'])assert.ok(worker.includes(path));
 const studio=read('public/admin/studio.html'),js=read('public/admin/studio.js');
 for(const str of ['Content','entryForm','publishEntry','photoUpload','teamForm','loginPanel'])assert.ok(studio.includes(str));
 assert.match(js,/getData\(/);assert.match(js,/async function upload/);
 const store=read('public/store.js');
 assert.match(store,/loadPublishedCms/);assert.match(store,/cmsOnly/);
 const autos=read('public/vintage-cars-refined.js');
 assert.match(autos,/refreshPublishedEditorial/);assert.match(autos,/salesEnabled=false/);
 const wr=JSON.parse(read('wrangler.jsonc'));
 for(const k of ['LIVE_CHECKOUT_ENABLED','LIVE_PAYMENTS_APPROVED','TAX_CONFIGURATION_APPROVED','CARRIER_QUOTES_ENABLED'])assert.equal(wr.vars[k],'false');
});
