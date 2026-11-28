#!/usr/bin/env node
/* Burton & Found pre-launch stock review.
 * Read-only: never mutates Supabase, marks stock verified, or creates orders.
 * The website catalogue is NOT proof of a physical sellable original.
 * Live database fields are only the public /api/catalog SKU/price/availability view.
 */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {runInNewContext} from 'node:vm';

const root=resolve(import.meta.dirname,'..');
const outDir=resolve(root,process.env.BF_LAUNCH_OUTPUT_DIR||'marketing-output');
const offline=process.argv.includes('--offline');
const fixtureArg=process.argv.find(x=>x.startsWith('--fixture='));
const sources=[
 'products.js','old-hollywood-item-data.js','old-hollywood-sets-data.js',
 'old-hollywood-products.js','coke-new-products.js','coke-archive-singles.js',
 'vintage-cars-data.js','vintage-cars-sets.js','vintage-cars-products.js'
];
const vm={window:{},console,Intl};
for(const file of sources){
 runInNewContext(readFileSync(resolve(root,'public',file),'utf8'),vm,{filename:file,timeout:3000});
}
const products=vm.window.BURTON_DATA?.inventory;
if(!Array.isArray(products)||products.length!==229)throw Error('Unexpected storefront inventory: audit catalogue changes first');
const vars=JSON.parse(readFileSync(resolve(root,'wrangler.jsonc'),'utf8')).vars;
const sellerEmailUnset=/sellerEmail\s*:\s*["']\s*["']/.test(readFileSync(resolve(root,'public/config.js'),'utf8'));
const site=new URL(vars.MARKETING_SITE_URL);
if(site.protocol!=='https:')throw Error('Expected HTTPS storefront');
const bySku=new Map();
for(const p of products){
 if(!/^[A-Z0-9-]{2,45}$/.test(p.sku||'')||bySku.has(p.sku))throw Error('Invalid or duplicate storefront SKU');
 if(!Number.isFinite(p.price)||p.price<=0)throw Error('Missing storefront asking price: '+p.sku);
 bySku.set(p.sku,p);
}
let api=null,liveError=null;
if(fixtureArg){
 const json=JSON.parse(readFileSync(resolve(fixtureArg.slice('--fixture='.length)),'utf8'));
 if(json.configured!==true||!Array.isArray(json.items))throw Error('Invalid local test fixture');
 api=json.items;
}else if(!offline){
 try{
  const response=await fetch(new URL('/api/catalog',site),{
   headers:{Accept:'application/json','User-Agent':'BurtonFound-LaunchAudit/1.0'},
   signal:AbortSignal.timeout(20000)
  });
  if(!response.ok)throw Error('HTTP '+response.status);
  const json=await response.json();
  if(json.configured!==true||!Array.isArray(json.items))throw Error('Public stock API unavailable');
  api=json.items;
 }catch(e){liveError=String(e?.message||'Stock API unavailable').slice(0,100);}
}
const backend=new Map();
if(api!==null){
 for(const p of api){
  if(!/^[A-Z0-9-]{2,45}$/.test(p?.sku||'')||backend.has(p.sku)
    ||!Number.isInteger(p.price_cents)||p.price_cents<0
    ||typeof p.available!=='boolean')
   throw Error('Public database response failed validation; do not use partial results');
  backend.set(p.sku,p);
 }
}
const all=[...bySku.values()].sort((a,b)=>
 String(a.collection||'').localeCompare(String(b.collection||''))||
 a.sku.localeCompare(b.sku));
const cols=[
 'SKU','Collection','Storefront title','Storefront asking CAD','Database price CAD',
 'Database record','Database available','Original physical item verified by site',
 'Web checkout eligible flag','Shared physical unit identifiers',
 'Review priority','Owner next action','Owner inspected','Owner approved','Owner notes'
];
const rows=[],counts={storefront:all.length,backend:api===null?null:backend.size,
 storeOnly:0,dbOnly:0,priceMismatch:0,availableDb:0,unverified:0,
 unverifiedAndAvailable:0,dbUnavailable:0,matching:0,frontendCheckoutDisabled:0};
for(const p of all){
 const db=backend.get(p.sku);
 const unverified=p.requiresVerification===true||p.stockState==='verification_required';
 const frontDisabled=p.availableForCheckout===false;
 if(unverified)counts.unverified++;
 if(frontDisabled)counts.frontendCheckoutDisabled++;
 const price=Math.round(p.price*100);
 let priority='Owner physical inspection',action='Confirm actual original piece, condition and available quantity before authorizing paid sale';
 if(api===null){
  priority='Unknown: database not checked';
  action='Restore public stock API audit, then inspect physical piece';
 }else if(!db){
  counts.storeOnly++;
  priority=unverified?'Unverified & absent from database':'Storefront SKU absent from database';
  action='Do not create available inventory until physically confirmed; then reconcile SKU, price and underlying unit IDs';
 }else if(db.price_cents!==price){
  counts.priceMismatch++;
  priority='PRICE MISMATCH — review before payment';
  action='Reconcile seller-approved CAD price across storefront and database; confirm physical stock';
 }else if(db.available!==true){
  counts.dbUnavailable++;
  priority=unverified?'Unverified; checkout off':'Database not available to buy';
  action='Verify original physical piece and its unit availability before enabling sale';
 }else{
  counts.availableDb++;
  counts.matching++;
  if(unverified){
   counts.unverifiedAndAvailable++;
   priority='CRITICAL — unverified item shows available in backend';
   action='Keep checkout disabled; confirm ownership and unit availability before further launch steps';
  }
 }
 rows.push([
  p.sku,p.collection||'',p.title||'',(price/100).toFixed(2),
  db?(db.price_cents/100).toFixed(2):'',
  api===null?'Not checked':db?'Present':'Absent',
  api===null?'Not checked':db?String(db.available):'Not present',
  unverified?'No — seller verification needed':'Not established by website audit',
  frontDisabled?'Disabled by storefront':'Not explicitly disabled',
  (p.catalogIds||[]).join(' + '),priority,action,'','',''
 ]);
}
if(api!==null)counts.dbOnly=[...backend.keys()].filter(sku=>!bySku.has(sku)).length;
const csvCell=x=>'"'+String(x??'').replaceAll('"','""')+'"';
const csv=[cols,...rows].map(r=>r.map(csvCell).join(',')).join('\n')+'\n';
const line=(key,v)=>'| '+key+' | '+String(v)+' |';
const report=[
 '# Burton & Found — launch inventory reconciliation',
 '',
 'Generated from the storefront JavaScript and '+
 (offline?'**offline-only** reference data. Database not queried.':
 fixtureArg?'a **local test fixture**, not a live database.':
 api===null?'an attempted live public /api/catalog query which was **unavailable**.':'the live public /api/catalog stock view.'),
 '',
 '**This is a review worksheet, not proof of physical possession or saleability. No stock, prices or payments were changed.**',
 '',
 '| Metric | Observed |','|---|---:|',
 line('Published storefront listing records',counts.storefront),
 line('Database SKU records',api===null?'Not verified':counts.backend),
 line('Storefront SKUs absent from database',api===null?'Unknown':counts.storeOnly),
 line('Backend SKUs absent from storefront',api===null?'Unknown':counts.dbOnly),
 line('Storefront/backend price disagreements',api===null?'Unknown':counts.priceMismatch),
 line('Backend SKUs with matching price and available=true',api===null?'Unknown':counts.availableDb),
 line('Storefront products explicitly awaiting physical verification',counts.unverified),
 line('Storefront products with checkout explicitly disabled',counts.frontendCheckoutDisabled),
 line('Unverified storefront products marked available in backend',api===null?'Unknown':counts.unverifiedAndAvailable),
 '',
 ...(liveError?['**Live stock check failed:** '+liveError+'; do not conclude that absent database records were found.','']:[]),
 '## Other launch prerequisites (static source-code checks)',
 '',
 '| Prerequisite | Static configuration |','|---|---|',
 line('Seller enquiry email',sellerEmailUnset?'Not configured in public/config.js':'Present in public/config.js — delivery untested'),
 line('Live checkout feature',vars.LIVE_CHECKOUT_ENABLED==='true'?'Enabled (requires approval)':'Disabled'),
 line('Stripe payout verification flag',vars.STRIPE_PAYOUTS_VERIFIED==='true'?'Owner-approved flag — Stripe status not independently checked':'Not approved'),
 line('Tax approval',vars.TAX_CONFIGURATION_APPROVED==='true'?'Approved flag — legal status not independently checked':'Not approved'),
 line('Customer carrier quote feature',vars.CARRIER_QUOTES_ENABLED==='true'?'Enabled (requires actual verified rates)':'Disabled'),
 line('Public search indexing',vars.MARKETING_INDEXING_APPROVED==='true'?'Approved':'Disabled'),
 '',
 'Note: these are GitHub configuration defaults. The running Cloudflare environment and Stripe account need separate checks.',
 '',
'## Seller review workflow',
 '',
 '1. Open the accompanying **launch-inventory-review.csv** and inspect the flagged SKUs.',
 '2. Physically verify originals, dimensions, condition, saleable quantity and whether any item is part of a bundle.',
 '3. Check prices against the storefront display; do not rely on suggested values as evidence of stock.',
 '4. Preserve overlapping physical unit IDs across individual products and sets to prevent selling the same piece twice.',
 '5. Only after owner sign-off, apply reviewed catalogue/stock edits through controlled database updates.',
 '6. Re-run this audit and verify zero outstanding price conflicts before contemplating payments.',
 '',
 '**Payments and customer carrier quotes remain disabled in production.**',
 ''
].join('\n');
mkdirSync(outDir,{recursive:true});
writeFileSync(resolve(outDir,'launch-inventory-review.csv'),csv,'utf8');
writeFileSync(resolve(outDir,'launch-inventory-reconciliation.md'),report,'utf8');
 // Suggested starting subset: only available, matching-price individual records.
 // Never equate a database record with physical verification. No flags are written.
 const chosen=[],units=new Set();
 if(api!==null)for(const collection of ['coca-cola','hollywood']){
  let n=0;
  for(const p of all){
   if(n>=8)break;
   const d=backend.get(p.sku),ids=p.catalogIds;
   if(p.collection!==collection||p.type!=='original'||p.requiresVerification===true||p.availableForCheckout===false||p.stockState==='verification_required'||p.stockState==='unavailable'||d?.available!==true||d.price_cents!==Math.round(p.price*100)||!Array.isArray(ids)||ids.length!==1||typeof ids[0]!=='string'||!ids[0]||units.has(ids[0]))continue;
   units.add(ids[0]);chosen.push([p.sku,p.collection,p.title,(d.price_cents/100).toFixed(2),ids[0],p.image||'','','','','','','','','']);n++;
  }
 }
 const shortHeader=['SKU','Collection','Listing title','Asking CAD','Physical unit ID','Catalogue image path','Original physically located (yes/no)','Condition matches description (yes/no)','Quantity and unit ID confirmed (yes/no)','Packed kg','Packed length cm','Packed width cm','Packed height cm','Owner notes and approval'];
 writeFileSync(resolve(outDir,'canada-first-shortlist.csv'),[shortHeader,...chosen].map(row=>row.map(csvCell).join(',')).join('\n')+'\n','utf8');
 console.log('Canada-first suggested inspection shortlist:',chosen.length,'listings; no physical stock approvals granted.');
console.log('Storefront SKU count:',counts.storefront,
  '| public database:',counts.backend??'not checked',
  '| missing database:',api===null?'unknown':counts.storeOnly,
  '| price conflicts:',api===null?'unknown':counts.priceMismatch,
  '| unverified originals:',counts.unverified);
console.log('Wrote owner review CSV and Markdown report; no database updates or charges made.');
