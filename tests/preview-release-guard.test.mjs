import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assertPreviewRelease,expectedPreviewVars} from '../scripts/assert-preview-release.mjs';
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const fixture=()=>({name:'burtonfound',vars:{...expectedPreviewVars}});
test('current committed preview release meets every safety requirement',()=>{
 assert.equal(assertPreviewRelease(JSON.parse(source('wrangler.jsonc'))),true);
});
test('every approval, environment and shipping gate independently fails closed',()=>{
 for(const [key,value] of Object.entries(expectedPreviewVars)){
  for(const bad of [undefined,value==='false'?'true':value==='true'?'false':'unexpected',false]){
   const c=fixture();c.vars[key]=bad;
   assert.throws(()=>assertPreviewRelease(c),new RegExp(key));
  }
 }
 assert.throws(()=>assertPreviewRelease({name:'wrong-worker',vars:fixture().vars}),/wrong Worker/);
 assert.throws(()=>assertPreviewRelease({}),/unsafe settings/);
});
test('production deployment only runs from main and checks preview gates before credentials',()=>{
 const y=source('.github/workflows/deploy-worker.yml');
 assert.ok(y.includes("if: github.ref == 'refs/heads/main'"));
 assert.ok(y.indexOf('node scripts/assert-preview-release.mjs')<y.indexOf('Resolve Cloudflare account'));
 assert.ok(y.includes('node scripts/assert-preview-release.mjs'));
});
