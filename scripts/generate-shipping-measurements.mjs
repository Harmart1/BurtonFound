#!/usr/bin/env node
/* Regenerate a measurement worksheet from every current website SKU.
 * No weight/size is inferred; all new rows remain unverified.
 * Existing measured CSV rows and custom combined-cart keys are preserved. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {resolve,dirname} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const existing=resolve(root,'SHIPPING_PACKAGE_MEASUREMENTS.csv');
const defaultOutput=resolve(root,'marketing-output','shipping-measurements-to-complete.csv');
const output=process.argv[2]?resolve(process.argv[2]):defaultOutput;
const sources=[
 'products.js','old-hollywood-item-data.js','old-hollywood-sets-data.js',
 'old-hollywood-products.js','coke-new-products.js','coke-archive-singles.js',
 'vintage-cars-data.js','vintage-cars-sets.js','vintage-cars-products.js'
];
const env={window:{},console,Intl};
for(const file of sources){
 runInNewContext(readFileSync(resolve(root,'public',file),'utf8'),env,{filename:file,timeout:3000});
}
const inventory=env.window.BURTON_DATA.inventory;
if(inventory.length!==229)throw Error('Unexpected product count; inspect catalogue before generating measurements');
const headings=['SKU','Title','Packed weight kg','Packed length cm','Packed width cm','Packed height cm','Measured and verified (true/false)','Notes'];
function parseCsv(content){
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<content.length;i++){
  const ch=content[i];
  if(quoted){
   if(ch==='"'&&content[i+1]==='"'){cell+='"';i++}
   else if(ch==='"')quoted=false;
   else cell+=ch;
  }else if(ch==='"')quoted=true;
  else if(ch===','){row.push(cell);cell=''}
  else if(ch==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell=''}
  else cell+=ch;
 }
 if(cell||row.length){row.push(cell.replace(/\r$/,''));rows.push(row)}
 if(quoted)throw Error('Malformed source CSV');
 return rows;
}
const source=parseCsv(readFileSync(existing,'utf8').replace(/^\uFEFF/,''));
if(JSON.stringify(source[0])!==JSON.stringify(headings))throw Error('Measurement CSV columns have changed');
const previous=new Map();
for(const values of source.slice(1)){
 const sku=String(values[0]||'').trim().toUpperCase();
 if(!sku)continue;
 if(previous.has(sku))throw Error('Duplicate existing row: '+sku);
 previous.set(sku,values);
}
const current=new Map();
for(const p of inventory){
 if(current.has(p.sku))throw Error('Duplicate catalogue SKU: '+p.sku);
 const old=previous.get(p.sku),row=old?[...old]:[p.sku,p.title,'','','','','false','Measure complete protected parcel in kg and cm; do not verify from photograph'];
 row[0]=p.sku;row[1]=p.title;current.set(p.sku,row);
}
// Retain existing custom combined-cart profiles and legacy rows for owner review.
for(const [sku,values] of previous)if(!current.has(sku))current.set(sku,values);
const printable=s=>'"'+String(s??'').replaceAll('"','""')+'"';
const csv=[headings,...[...current.values()].sort((a,b)=>a[0].localeCompare(b[0]))]
  .map(row=>row.map(printable).join(',')).join('\n')+'\n';
mkdirSync(dirname(output),{recursive:true});
writeFileSync(output,csv,'utf8');
const checked=[...current.values()].filter(r=>r[6]==='true').length;
console.log('Generated',output,'from',inventory.length,'catalogue products;',checked,'rows previously verified; new rows are unverified.');
