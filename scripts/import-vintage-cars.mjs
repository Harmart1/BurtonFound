// Install only a browse-only vintage automobiles collection from a validated image package.
// Existing checkout, database, product prices and physical stock are intentionally untouched.
import {readFileSync,writeFileSync,copyFileSync,mkdirSync,readdirSync,statSync} from 'node:fs';
import {join,resolve} from 'node:path';
const stage=resolve(process.argv[2]||'_vintage_import'),dryRun=process.argv.includes('--dry-run');
const input=join(stage,'public'),output=resolve('public');
const inputImages=join(input,'assets','images','vintage-cars');
const outputImages=join(output,'assets','images','vintage-cars');
const filenames=['vintage-cars.html','vintage-cars.css','vintage-cars.js','vintage-cars-data.js'];
const read=p=>readFileSync(p,'utf8');
const check=(test,reason)=>{if(!test)throw Error('Vintage preview import refused: '+reason);};
for(const f of filenames)check(statSync(join(input,f)).isFile(),'missing '+f);
const raw=read(join(input,'vintage-cars-data.js'));
check(raw.startsWith('window.BURTON_VINTAGE_CARS='),'unexpected data format');
const items=JSON.parse(raw.substring(raw.indexOf('=')+1).trim().replace(/;$/,''));
check(Array.isArray(items)&&items.length===93,'expected 93 records');
check(new Set(items.map(x=>x.sku)).size===93,'duplicate draft SKUs');
const files=readdirSync(inputImages).filter(x=>x.endsWith('.webp')).sort();
check(files.length===93,'expected 93 WebP assets');
let totalBytes=0;
for(let i=1;i<=93;i++){
 const sku='VA-'+String(i).padStart(3,'0'),filename=sku.toLowerCase()+'.webp',x=items[i-1];
 check(x.sku===sku&&x.image==='assets/images/vintage-cars/'+filename,'invalid mapping '+sku);
 check(files.includes(filename),'missing '+filename);
 check(x.salesEnabled===false&&!('price' in x)&&!('quantity' in x),'saleable preview item '+sku);
 check(typeof x.title==='string'&&x.title.length>2&&x.title.length<180,'invalid title '+sku);
 check(typeof x.brand==='string'&&x.brand.length>=2&&x.brand.length<90,'invalid brand '+sku);
 check(x.year===null||(Number.isInteger(x.year)&&x.year>=1900&&x.year<=2000),'invalid year '+sku);
 check(x.duplicateGroup===null||(typeof x.duplicateGroup==='string'&&/^DUP-[0-9]{2}$/.test(x.duplicateGroup)),'invalid repeat flag '+sku);
 const b=readFileSync(join(inputImages,filename));
 check(b.length>=2500&&b.length<=500000,'invalid size '+sku);
 check(b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP','invalid image format '+sku);
 totalBytes+=b.length;
}
check(totalBytes<30000000,'images too large');
const publicItems=items.map(x=>({sku:x.sku,title:x.title,brand:x.brand,year:x.year,image:x.image,duplicateGroup:x.duplicateGroup,salesEnabled:false}));
const browserJs=read(join(input,'vintage-cars.js')),html=read(join(input,'vintage-cars.html'));
check(!browserJs.includes('x.source')&&!browserJs.includes('drive.google.com'),'private Drive references in public script');
check(!html.includes('drive.google.com'),'private Drive references in public HTML');
check(html.includes('not yet for sale')&&html.includes('noindex'),'missing non-sale disclaimer');
check(!browserJs.includes('/api/checkout'),'preview checkout prohibited');
function addNav(source,homepage){
 const anchor='<a data-shop-hollywood="" href="#shop">Old Hollywood</a>';
 check(source.split(anchor).length>=3,'desktop/mobile nav anchors not found');
 let s=source.replaceAll(anchor,anchor+'<a href="vintage-cars.html">Vintage Automobiles</a>');
 const rail='<a class="market-dept market-dept-soon" href="books.html">';
 check(s.includes(rail),'shop department rail missing');
 s=s.replace(rail,'<a class="market-dept market-dept-soon" href="vintage-cars.html">Vintage automobiles <small>93 scans · Coming soon ↗</small></a>'+rail);
 if(homepage){
  const spot='</div>\n</section><nav aria-label="Shop by department"';
  check(s.includes(spot),'homepage spotlight anchor missing');
  const promo='<a class="vintage-cars-promo" href="vintage-cars.html"><img src="assets/images/vintage-cars/va-049.webp" alt="Vintage automobile magazine advertisement, preview image" width="150" height="180" loading="lazy"><span><small>NEW ARCHIVE PREVIEW · 93 SCANNED PAGES</small><strong>Vintage Automobiles</strong><span>Explore historical motoring artwork · Coming soon, not for sale</span><b>Browse the collection ↗</b></span></a>';
  s=s.replace(spot,'</div>\n'+promo+'\n</section><nav aria-label="Shop by department"');
  const cssAnchor='<link href="storefront-first.css" rel="stylesheet"/>';
  check(s.includes(cssAnchor),'homepage stylesheet anchor missing');
  s=s.replace(cssAnchor,'<link href="vintage-cars-promo.css" rel="stylesheet"/>'+cssAnchor);
 }
 return s;
}
const home=addNav(read(join(output,'index.html')),true);
const storefront=addNav(read(join(output,'storefront.html')),false);
const css='.vintage-cars-promo{display:flex;gap:clamp(14px,3vw,30px);align-items:center;border:1px solid var(--ui-line,#aaa);color:var(--ui-ink,#203730);background:var(--ui-surface,#fffdf7);padding:clamp(13px,2vw,24px);margin:28px 0 0;text-decoration:none;border-radius:10px;min-height:160px}.vintage-cars-promo:hover,.vintage-cars-promo:focus-visible{outline-offset:3px;border-color:var(--ui-accent,#b04f35)}.vintage-cars-promo>img{width:150px;aspect-ratio:5/6;height:auto;object-fit:cover;border:1px solid var(--ui-line,#aaa);background:var(--ui-soft,#eee)}.vintage-cars-promo>span{display:grid;gap:7px}.vintage-cars-promo small{font-size:.72rem;letter-spacing:.1em;font-weight:750;color:var(--ui-muted,#52655c)}.vintage-cars-promo strong{font:normal clamp(1.45rem,2.5vw,2.35rem)/1.1 Georgia,serif}.vintage-cars-promo b{font-weight:750;color:var(--ui-link,#8a3a31)}@media(max-width:500px){.vintage-cars-promo>img{width:92px}.vintage-cars-promo{align-items:flex-start}}';
if(!dryRun){
 mkdirSync(outputImages,{recursive:true});
 for(const f of files)copyFileSync(join(inputImages,f),join(outputImages,f));
 for(const f of filenames.filter(x=>x!=='vintage-cars-data.js'))copyFileSync(join(input,f),join(output,f));
 writeFileSync(join(output,'vintage-cars-data.js'),'window.BURTON_VINTAGE_CARS='+JSON.stringify(publicItems)+';\n');
 writeFileSync(join(output,'index.html'),home);
 writeFileSync(join(output,'storefront.html'),storefront);
 writeFileSync(join(output,'vintage-cars-promo.css'),css+'\n');
}
console.log('Verified 93 non-saleable vintage car previews, '+totalBytes+' image bytes. '+(dryRun?'Dry run only.':'Copied images and integrated navigation without changing sale inventory.'));
