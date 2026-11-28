// Read-only. Uses approved merchant price settings, never invents packed measurements or postage.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
export const profiles=['Single paper item','Multiple paper items or set','Oversize flat item','Fragile or boxed item'];
export const destinations=[['CA','Ontario nearby'],['CA','Atlantic Canada'],['CA','Western Canada'],['CA','Northern / remote Canada'],['US','Northeastern US'],['US','Central US'],['US','Western US']];
export function plan(vars){
 if(vars.FLAT_RATE_PRICES_APPROVED!=='true'||vars.SHIPPING_MODE!=='flat_rate')throw Error('Approved flat rate setup required');
 return destinations.flatMap(([country,region])=>profiles.flatMap(profile=>['STANDARD','EXPRESS'].map(service=>{
  const raw=vars['SHIPPING_'+service+'_'+country+'_CENTS'];
  if(!/^\d{1,6}$/.test(String(raw))||Number(raw)<=0)throw Error('Invalid merchant rate');
  return {country,region,profile,service,charged:Number(raw),customs:country==='US'?'US orders blocked pending customs approval':'Domestic'};
 })));
}
export function costReview(charged,costs){
 if(!Number.isSafeInteger(charged)||charged<=0||!Array.isArray(costs)||costs.length!==4||costs.some(x=>!Number.isSafeInteger(x)||x<0||x>100000000))return null;
 const cost=costs.reduce((a,b)=>a+b,0);return {cost,contribution:charged-cost};
}
const csv=v=>'"'+String(v??'').replaceAll('"','""')+'"';
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const root=resolve(import.meta.dirname,'..'),vars=JSON.parse(readFileSync(resolve(root,'wrangler.jsonc'),'utf8')).vars,rows=plan(vars);
 const out=resolve(root,process.env.BF_LAUNCH_OUTPUT_DIR||'marketing-output');mkdirSync(out,{recursive:true});
 const header=['Country','Representative destination region','Package type','Service','Approved shipping charge CAD','Destination postal code','Packed kg','Length cm','Width cm','Height cm','Quoted postage CAD','Packaging CAD','Duties and fees CAD','Other shipping expense CAD','Actual contribution CAD','Review notes'];
 writeFileSync(resolve(out,'flat-rate-cost-review.csv'),[header,...rows.map(r=>[r.country,r.region,r.profile,r.service,(r.charged/100).toFixed(2),'','','','','','','','','','',''+r.customs+'; obtain actual quote and measurements'])].map(row=>row.map(csv).join(',')).join('\n')+'\n');
 writeFileSync(resolve(out,'flat-rate-cost-review.md'),'# Shipping price validation — owner worksheet\n\n'+rows.length+' comparison cases generated from approved rates. No weights, dimensions, postage or duties are assumed. Start with four representative packages and real destination postal codes. Use carrier quotes for the actual parcel and service. The shipping charge is the maximum total shipping expense for a zero contribution, before other order costs. Contribution = charged shipping minus postage, packaging, duties/fees and other shipping expenses. If negative, review the rate or require an individual quote. US orders remain blocked until customs and shipping approvals. Do not treat this worksheet as a carrier rate card.\n');
 console.log('Prepared '+rows.length+' shipping cost cases; no orders, carrier API requests or charges.');
}
