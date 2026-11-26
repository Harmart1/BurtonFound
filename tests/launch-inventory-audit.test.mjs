import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';

const script=new URL('../scripts/audit-launch-inventory.mjs',import.meta.url).pathname;
function audit(args=[]){
 const dir=mkdtempSync(join(tmpdir(),'bf-launch-audit-'));
 const env={...process.env,BF_LAUNCH_OUTPUT_DIR:dir};
 const fixture=join(dir,'fixture.json');
 if(args.includes('--fixture')){
   writeFileSync(fixture,JSON.stringify({configured:true,items:[
     {sku:'CC-001',price_cents:1,available:true},
     {sku:'DB-ORPHAN',price_cents:899,available:false}
   ]}),'utf8');
   args=args.filter(x=>x!=='--fixture');
   args.push('--fixture='+fixture);
 }
 try{
   const log=execFileSync(process.execPath,[script,...args],{env,timeout:30000,encoding:'utf8'});
   const csv=readFileSync(join(dir,'launch-inventory-review.csv'),'utf8');
   const report=readFileSync(join(dir,'launch-inventory-reconciliation.md'),'utf8');
   return {log,csv,report};
 }finally{rmSync(dir,{recursive:true,force:true})}
}
test('offline launch inventory review enumerates 229 actual storefront SKUs without guessing stock',()=>{
 const {csv,report}=audit(['--offline']);
 assert.equal(csv.trimEnd().split('\n').length,230);
 for(const sku of ['VA-001','BF-VA-SET01','CC-001','OH-003'])assert.ok(csv.includes('"'+sku+'"'),sku);
 assert.match(report,/offline-only/);
 assert.match(report,/Published storefront listing records \| 229/);
 assert.match(report,/Database SKU records \| Not verified/);
 assert.match(report,/Seller enquiry email \| Not configured/);
 assert.match(report,/Stripe payout verification flag \| Not approved/);
 assert.ok(csv.includes('Not checked'));
 assert.ok(csv.includes('Owner inspected'));
 assert.ok(!csv.includes('"Owner inspected","true"'));
});
test('live SKU comparison fixture finds absent backend SKUs, backend-only SKU and price discrepancies',()=>{
 const {csv,report,log}=audit(['--fixture']);
 assert.match(report,/Database SKU records \| 2/);
 assert.match(report,/Storefront SKUs absent from database \| 228/);
 assert.match(report,/Backend SKUs absent from storefront \| 1/);
 assert.match(report,/Storefront\/backend price disagreements \| 1/);
 assert.match(csv,/PRICE MISMATCH — review before payment/);
 assert.match(csv,/Unverified & absent from database/);
 assert.match(report,/local test fixture/);
 assert.match(log,/no database updates or charges made/i);
});
test('read-only workflow runs weekly and only uploads owner review report',()=>{
 const workflow=readFileSync(new URL('../.github/workflows/launch-inventory-audit.yml',import.meta.url),'utf8');
 assert.match(workflow,/workflow_dispatch/);
 assert.match(workflow,/schedule:/);
 assert.match(workflow,/audit-launch-inventory\.mjs/);
 assert.match(workflow,/actions\/upload-artifact/);
 assert.doesNotMatch(workflow,/STRIPE_SECRET_KEY|SUPABASE_SECRET_KEY/);
});
