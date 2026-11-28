/* Validate the owner's exported inspection notes before any separate launch approval.
 * No secrets, DB writes, changes to wrangler.jsonc, or payment operations. */
import {readFileSync,statSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=resolve(import.meta.dirname,'..');
const sources=['products.js','old-hollywood-item-data.js','old-hollywood-sets-data.js','old-hollywood-products.js','coke-new-products.js','coke-archive-singles.js','vintage-cars-data.js','vintage-cars-sets.js','vintage-cars-products.js','admin/stock-review.js'];
function load(){
 const ctx={window:{},document:{getElementById:()=>null},Intl,console};
 for(const f of sources)runInNewContext(readFileSync(resolve(root,'public',f),'utf8'),ctx,{filename:f,timeout:3000});
 return ctx.window;
}
const W=load(),S=W.BURTON_STOCK_REVIEW;
export function validate(review,snapshot,now=Date.now()){
 if(review?.schema!=='burton-found-stock-review-v1'||review.scope!=='CA'||review.planning_only!==true||review.requires_independent_recheck!==true||!Array.isArray(review.reviewed_candidates)||!review.reviewed_candidates.length||review.reviewed_candidates.length>500)throw Error('Not a valid Canada-first owner review export.');
 const checked=Date.parse(review.stock_snapshot_checked_at),exported=Date.parse(review.review_exported_at);
 if(!Number.isFinite(checked)||!Number.isFinite(exported)||checked>exported||exported>now+300000||now-checked>7*86400000)throw Error('Review snapshot is stale or date is invalid; refresh and export again.');
 const available=new Map(S.candidates(W.BURTON_DATA.inventory,snapshot,500).map(r=>[r.sku,r]));
 const seen=new Set(),units=new Set(),accepted=[];
 for(const row of review.reviewed_candidates){
  const actual=available.get(row?.sku);
  if(!actual||seen.has(row.sku)||units.has(actual.unit)||actual.unit!==row.physical_unit||actual.price_cents!==row.price_cents)throw Error('Reviewed SKU is duplicated, unavailable, changed, or no longer matches the catalogue.');
  const checks=row.owner_reports||{},p=row.packed||{};
  if(!['located','condition_matches','unit_confirmed','approved_candidate'].every(k=>checks[k]===true)||![p.kg,p.length_cm,p.width_cm,p.height_cm].every(v=>typeof v==='number'&&S.measure(v)!==null))throw Error('Incomplete physical review or invalid packed measurements.');
  seen.add(row.sku);units.add(actual.unit);accepted.push(row.sku);
 }
 return {reviewed_count:accepted.length,proposed_skus:accepted.sort(),planning_only:true,production_authorized:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const file=process.argv[2];if(!file||statSync(file).size>1000000)throw Error('Supply a valid owner review JSON file (maximum 1 MB).');
  const review=JSON.parse(readFileSync(file,'utf8'));
  const response=await fetch('https://burtonandfound.ca/api/catalog',{headers:{Accept:'application/json'},signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error('Current public inventory could not be checked.');
  const result=validate(review,await response.json());
  console.log(JSON.stringify(result,null,2));
  console.log('Validated owner-reported candidates only. No stock updates or checkout approval.');
 }catch(e){console.error('Review rejected: '+e.message);process.exitCode=1;}
}
