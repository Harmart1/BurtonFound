import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=resolve(import.meta.dirname,'..');
const files=['products.js','old-hollywood-item-data.js','old-hollywood-sets-data.js','old-hollywood-products.js','coke-new-products.js','coke-archive-singles.js','vintage-cars-data.js','vintage-cars-sets.js','vintage-cars-products.js'];
export function eligible(products,snapshot){
 if(!Array.isArray(products)||products.length!==229||snapshot?.configured!==true||!Array.isArray(snapshot.items)||!snapshot.items.length)throw Error('Incomplete stock snapshot');
 const rows=new Map(),seen=new Set(),out=[];
 for(const d of snapshot.items){
  if(!/^[A-Z0-9-]{2,24}$/.test(d?.sku||'')||rows.has(d.sku)||typeof d.available!=='boolean'||!Number.isSafeInteger(d.price_cents)||d.price_cents<=0)throw Error('Invalid stock record');
  rows.set(d.sku,d);
 }
 for(const p of products){
  if(!/^[A-Z0-9-]{2,24}$/.test(p?.sku||'')||seen.has(p.sku))throw Error('Invalid catalogue record');seen.add(p.sku);
  if(!['coca-cola','hollywood'].includes(p.collection)||p.cmsOnly||p.requiresVerification===true||p.availableForCheckout===false||['unavailable','verification_required'].includes(p.stockState))continue;
  const r=rows.get(p.sku);
  if(r?.available!==true||r.price_cents!==Math.round(p.price*100)||!Array.isArray(p.catalogIds)||!p.catalogIds.length||p.catalogIds.some(x=>typeof x!=='string'||!x.trim())||new Set(p.catalogIds).size!==p.catalogIds.length)continue;
  out.push({sku:p.sku,price_cents:r.price_cents,physical_units:[...p.catalogIds]});
 }
 if(!out.length)throw Error('No eligible listings');
 return out.sort((a,b)=>a.sku.localeCompare(b.sku));
}
async function main(){
 const ctx={window:{},console,Intl};for(const f of files)runInNewContext(readFileSync(resolve(root,'public',f),'utf8'),ctx,{filename:f,timeout:3000});
 const r=await fetch('https://burtonandfound.ca/api/catalog',{headers:{Accept:'application/json'},signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw Error('Public stock unavailable');
 const records=eligible(ctx.window.BURTON_DATA?.inventory,await r.json());
 const manifest={schema:'burtonfound-canada-release-review-v1',created_at:new Date().toISOString(),scope:'CA',owner_confirmations:{available_coca_cola_and_hollywood_inventory:true,flat_rate_cost_risk_accepted:true,unregistered_small_supplier_eligibility:true,existing_policies_approved:true},legal_seller_confirmed:false,production_authorized_by_manifest:false,proposed_skus:records.map(r=>r.sku),records,shipping_cents:{standard:1995,express:3495},automatic_tax:false,guest_email_deferred:true};
 mkdirSync(resolve(root,'release-review'),{recursive:true});writeFileSync(resolve(root,'release-review/canada-live-candidates.json'),JSON.stringify(manifest,null,2)+'\n');
 console.log('Eligible owner-confirmed Canadian listing candidates: '+records.length+'; individual units and bundles remain subject to database overlap and stock checks.');
 console.log('No inventory, payment gates, credentials or deployed settings changed. Legal seller and production verification remain required.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{await main()}catch(e){console.error(e.message);process.exitCode=1}}
