import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=resolve(new URL('..',import.meta.url).pathname);
const importer=join(root,'scripts/import-vintage-cars.mjs');
function makeFixture(overrides={}){
 const dir=mkdtempSync(join(tmpdir(),'bf-vintage-test-'));
 const base=join(dir,'public'),images=join(base,'assets','images','vintage-cars');
 mkdirSync(images,{recursive:true});
 const items=[];
 for(let i=1;i<=93;i++){
  const suffix=String(i).padStart(3,'0'),sku='VA-'+suffix;
  const name='va-'+suffix+'.webp';
  items.push({sku,title:'Vintage automobile ad '+suffix,brand:'Dodge',year:1948,image:'assets/images/vintage-cars/'+name,duplicateGroup:null,salesEnabled:false});
  const bytes=Buffer.alloc(2800);
  bytes.write('RIFF',0,'ascii');bytes.write('WEBP',8,'ascii');
  writeFileSync(join(images,name),bytes);
 }
 if(overrides.price)items[10].price=0;
 if(overrides.sale)items[10].salesEnabled=true;
 if(overrides.missing)items.pop();
 writeFileSync(join(base,'vintage-cars-data.js'),'window.BURTON_VINTAGE_CARS='+JSON.stringify(items)+';');
 writeFileSync(join(base,'vintage-cars.html'),'<meta name="robots" content="noindex"><h1>not yet for sale</h1>');
 writeFileSync(join(base,'vintage-cars.js'),'(()=>{const items=[];})();');
 writeFileSync(join(base,'vintage-cars.css'),'body { color: #111; }');
 return dir;
}
function run(stage){return spawnSync(process.execPath,[importer,stage,'--dry-run'],{cwd:root,encoding:'utf8'});}
test('Vintage automobile importer validates 93 non-purchasable WebPs without writing public files',()=>{
 const dir=makeFixture();
 try {
  const result=run(dir);
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/Verified 93 non-saleable vintage car previews/);
  assert.match(result.stdout,/Dry run only/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('Vintage automobile importer rejects priced or saleable drafts',()=>{
 for(const bad of [{price:true},{sale:true},{missing:true}]){
  const dir=makeFixture(bad);
  try {
   const result=run(dir);
   assert.notEqual(result.status,0,'bad input should not pass validation');
  }finally{rmSync(dir,{recursive:true,force:true});}
 }
});
test('Site import workflow cannot activate checkout or silently insert Supabase saleable records',()=>{
 const yaml=readFileSync(join(root,'.github','workflows','import-vintage-cars.yml'),'utf8');
 const script=readFileSync(importer,'utf8');
 assert.match(yaml,/LIVE_CHECKOUT_ENABLED/);
 assert.match(yaml,/TAX_CONFIGURATION_APPROVED/);
 assert.match(yaml,/deploy-worker.yml/);
 assert.match(script,/salesEnabled===false/);
 assert.match(script,/publicItems=items\.map/);
 assert.doesNotMatch(script,/bf_products|bf_units|bf_hold_cart|checkout\/sessions/);
});
