/* Full static storefront audit. No network, customer data, payments, or inventory writes. */
import {readFileSync,existsSync,statSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,relative,dirname,extname,sep} from 'node:path';
import {runInNewContext} from 'node:vm';
const root=resolve(import.meta.dirname,'..'),site=resolve(root,'public'),out=resolve(root,'marketing-output');
const vm={window:{},console,Intl};
for(const file of ['products.js','old-hollywood-item-data.js','old-hollywood-sets-data.js','old-hollywood-products.js','coke-new-products.js','coke-archive-singles.js','vintage-cars-data.js','vintage-cars-sets.js','vintage-cars-products.js','product-links.js']){
 runInNewContext(readFileSync(resolve(site,file),'utf8'),vm,{filename:file,timeout:3000});
}
const products=vm.window.BURTON_DATA.inventory,links=vm.window.BURTON_PRODUCT_LINKS||{};
const failures=[],review=[],assets=new Set(),collections={};
const fail=s=>failures.push(s),warn=s=>review.push(s);
function local(value,from,source,{image=false}={}){
 if(typeof value!=='string'||!value.trim()){fail(source+' missing path');return;}
 if(/^(?:https?:|data:|mailto:|tel:|#|\/\/)/i.test(value)){if(image)fail(source+' non-local catalogue photo');return;}
 let name=value.split(/[?#]/)[0];if(!name)return;
 try{name=decodeURIComponent(name)}catch{fail(source+' invalid URL encoding');return;}
 const file=name.startsWith('/')?resolve(site,name.slice(1)):resolve(dirname(from),name);
 if(file!==site&&!file.startsWith(site+sep)){fail(source+' reference escapes public directory');return;}
 if(!existsSync(file)){fail(source+' missing '+name);return;}
 if(image){
  if(!statSync(file).isFile()||!statSync(file).size){fail(source+' empty or non-file photo');return;}
  if(assets.has(file))return;
  assets.add(file);
  const h=readFileSync(file).subarray(0,16),ext=extname(file).toLowerCase();
  if(ext==='.webp'&&(h.toString('ascii',0,4)!=='RIFF'||h.toString('ascii',8,12)!=='WEBP'))fail(source+' invalid WebP signature '+name);
  if(['.jpg','.jpeg'].includes(ext)&&(h[0]!==255||h[1]!==216||h[2]!==255))fail(source+' invalid JPEG signature '+name);
  if(ext==='.png'&&h.toString('hex',0,8)!=='89504e470d0a1a0a')fail(source+' invalid PNG signature '+name);
  if(!['.webp','.jpg','.jpeg','.png','.gif','.svg','.avif'].includes(ext))warn(source+' unexpected photo format '+name);
 }
}
const ids=new Set();
for(const p of products){
 const id=p.sku,src='SKU '+id;
 if(!/^[A-Z0-9-]{2,45}$/.test(id||'')||ids.has(id))fail(src+' invalid or duplicate SKU');
 ids.add(id);
 const bucket=collections[p.collection]||={listings:0,enquiry:0,seo:0};
 bucket.listings++;
 const enquiry=p.requiresVerification===true||p.stockState==='verification_required'||p.availableForCheckout===false;
 if(enquiry)bucket.enquiry++;
 if(typeof p.title!=='string'||!p.title.trim())fail(src+' missing title');
 if(!Number.isFinite(p.price)||p.price<=0)fail(src+' invalid asking price');
 if(!p.shortDescription?.trim())warn(src+' missing short description');
 if(!p.condition?.trim())warn(src+' missing condition note');
 const units=p.catalogIds||[];
 if(!units.length||new Set(units).size!==units.length)fail(src+' missing or repeated physical catalogue identifiers');
 const photos=[p.image,...(Array.isArray(p.images)?p.images:[]),...(Array.isArray(p.memberDetails)?p.memberDetails.map(m=>m.image).filter(Boolean):[])];
 for(const photo of new Set(photos))local(photo,resolve(site,'index.html'),src,{image:true});
 if(links[id]){bucket.seo++;local(links[id],resolve(site,'index.html'),src+' product landing page');}
 else if(!enquiry)fail(src+' sale-catalogue landing page missing');
 if(enquiry&&links[id])warn(src+' enquiry-only landing page needs truthful stock labelling');
}
for(const id of Object.keys(links))if(!ids.has(id))fail('Product link points to unknown SKU '+id);
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(resolve(d,x.name)):[resolve(d,x.name)]);
const files=walk(site),htmlFiles=files.filter(f=>extname(f)==='.html'),cssFiles=files.filter(f=>extname(f)==='.css');
for(const file of htmlFiles){
 const s=readFileSync(file,'utf8'),src=relative(site,file);
 if(!/<title\b[^>]*>[^<]+<\/title>/i.test(s))warn(src+' missing page title');
 // Attributes only: no dynamic JavaScript or external links are executed.
 for(const m of s.matchAll(/\b(?:src|href|poster)\s*=\s*(['"])([^'"]+)\1/gi)){
  const v=m[2];if(/[{}<>]/.test(v)||v.startsWith('javascript:'))continue;
  local(v,file,src);
 }
}
for(const file of cssFiles){
 const s=readFileSync(file,'utf8'),src=relative(site,file);
 for(const m of s.matchAll(/url\(\s*(?:"([^"]+)"|'([^']+)'|([^\s)]+))\s*\)/gi)){
  const v=m[1]||m[2]||m[3];if(v&&!v.startsWith('var(')&&!v.startsWith('data:'))local(v,file,src);
 }
}
const report=['# Burton & Found full catalogue and site asset audit','', 'Local source/build validation only. No external URLs, runtime browser image decoding, customer data or physical stock inspected.','',
 '| Collection | Listings | Enquiry / verification required | Generated product pages |','|---|---:|---:|---:|',
 ...Object.entries(collections).map(([k,v])=>'| '+k+' | '+v.listings+' | '+v.enquiry+' | '+v.seo+' |'),'',
 'Total catalogue listings: '+products.length,'Unique catalogue image files checked: '+assets.size,'HTML files checked: '+htmlFiles.length,'CSS files checked: '+cssFiles.length,'Blocking issues: '+failures.length,'Review notes: '+review.length,'',
 '## Blocking issues',...(failures.length?failures.map(x=>'- '+x):['None.']),'','## Review notes',...(review.length?review.map(x=>'- '+x):['None.']),'',
 'Enquiry-only automobile items are intentionally not treated as verified inventory. Do not enable payments or publish availability claims from this audit.'].join('\n')+'\n';
mkdirSync(out,{recursive:true});writeFileSync(resolve(out,'full-site-quality-audit.md'),report);
console.log('Catalogue: '+products.length+' listings; '+assets.size+' unique images; '+htmlFiles.length+' HTML; '+cssFiles.length+' CSS. Blocking issues: '+failures.length+'; review notes: '+review.length);
for(const x of failures.slice(0,40))console.error('FAIL: '+x);
for(const x of review.slice(0,10))console.log('REVIEW: '+x);
if(failures.length)process.exitCode=1;
