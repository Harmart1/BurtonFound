/* Dependency-free, repeatable marketing build for Burton & Found.
 * This script does NOT post on third-party networks, transmit personal data, or enable payment.
 * Crawl indexing and Merchant shopping feeds are separately gated by owner approvals.
 */
import {readFileSync,writeFileSync,mkdirSync,rmSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {runInNewContext} from 'node:vm';
const root=process.cwd(),publicRoot=join(root,'public'),out=join(root,'marketing-output');
const config=JSON.parse(readFileSync(join(root,'wrangler.jsonc'),'utf8'));
const vars=config.vars||{};
const base=String(vars.MARKETING_SITE_URL||'https://burtonfound.timharmar.workers.dev').replace(/\/+$/,'');
if(!/^https:\/\/[a-z0-9.-]+$/i.test(base))throw Error('MARKETING_SITE_URL must be an HTTPS origin');
const indexable=vars.MARKETING_INDEXING_APPROVED==='true';
const checkoutApproved=['LIVE_CHECKOUT_ENABLED','LIVE_PAYMENTS_APPROVED','TAX_CONFIGURATION_APPROVED'].every(k=>vars[k]==='true');
const context={window:{},console,Intl};
for(const file of ['products.js','old-hollywood-item-data.js','old-hollywood-sets-data.js','old-hollywood-products.js','coke-new-products.js','coke-archive-singles.js','featured-merchandising.js']){
 const src=readFileSync(join(publicRoot,file),'utf8');
 runInNewContext(src,context,{filename:file,timeout:2000});
}
const stock=context.window.BURTON_DATA.inventory;
if(stock.length!==131||new Set(stock.map(p=>p.sku)).size!==131)throw Error('Unexpected inventory; do not produce stale marketing links');
const items=[...stock].filter(p=>!p.cmsOnly&&p.price>0);
const clean=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const text=s=>String(s??'').replace(/\s+/g,' ').trim();
const short=(s,n)=>{const v=text(s);return v.length>n?v.slice(0,n-1).replace(/\s+\S*$/,'')+'…':v};
const slug=s=>text(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,67).replace(/-$/,'');
const dollar=n=>new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(n);
const abs=p=>base+'/'+String(p).replace(/^\/+/,'');
const urlOf=p=>'/products/'+slug(p.title)+'-'+p.sku.toLowerCase()+'.html';
const bySku=new Map(items.map(p=>[p.sku,p]));
const robots=indexable?'index,follow,max-image-preview:large':'noindex,follow';
const collection=[
 {id:'coca-cola',title:'Vintage Coca-Cola Advertising',description:'Explore photographed vintage Coca-Cola magazine advertising, individual paper pages and curated collector sets. All prices are in Canadian dollars.',keywords:'Coca-Cola magazine advertisements, vintage Coca-Cola paper, collectible advertising'},
 {id:'hollywood',title:'Old Hollywood Printed Collectibles',description:'Browse film advertising, star portraits and magazine paper from the golden age of Hollywood. Printing dates and physical attributes are described with care.',keywords:'Old Hollywood magazine portraits, classic cinema paper, vintage film advertisements'},
 {id:'sets',title:'Curated Vintage Paper Sets',description:'Discover themed vintage paper collections spanning Coca-Cola, old movies and nostalgic illustration. Sets share stock with their individual items.',keywords:'vintage Coca-Cola sets, Hollywood collector sets, vintage advertising bundles'}
];
const collectionUrl=id=>'/collections/'+id+'.html';
const collectionFor=p=>p.collection==='hollywood'?'hollywood':'coca-cola';
const mk=(path,data)=>{const full=join(publicRoot,path);mkdirSync(join(full,'..'),{recursive:true});writeFileSync(full,data,'utf8')};
const head=(title,desc,path,photo='',type='website',ld=null)=>{
 const img=photo||'assets/brand/burton-found-preview-social.jpg';
 const canonical=abs(path);
 return '<!doctype html><html lang="en-CA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
  '<meta name="robots" content="'+robots+'"><meta name="theme-color" content="#203730">'+
  '<title>'+clean(title)+' | Burton &amp; Found</title>'+
  '<meta name="description" content="'+clean(short(desc,155))+'"><link rel="canonical" href="'+clean(canonical)+'">'+
  '<meta property="og:type" content="'+type+'"><meta property="og:title" content="'+clean(title)+'">'+
  '<meta property="og:description" content="'+clean(short(desc,180))+'"><meta property="og:site_name" content="Burton &amp; Found">'+
  '<meta property="og:url" content="'+clean(canonical)+'"><meta property="og:image" content="'+clean(abs(img))+'">'+
  '<meta name="twitter:card" content="summary_large_image">'+
  '<link rel="icon" href="/assets/brand/favicon.svg" type="image/svg+xml">'+
  '<link rel="stylesheet" href="/marketing.css">'+
  (ld?'<script type="application/ld+json">'+JSON.stringify(ld).replace(/</g,'\\u003c')+'</script>':'')+'</head>';
};
const header='<header class="mk-head"><div class="mk-wrap mk-head-inner"><a class="mk-logo" href="/">B<span>&amp;</span>F <small>Burton &amp; Found</small></a><nav aria-label="Explore the collections"><a href="/collections/coca-cola.html">Coca-Cola</a><a href="/collections/hollywood.html">Old Hollywood</a><a href="/collections/sets.html">Curated sets</a><a href="/guides/collecting-vintage-ads.html">Collector guides</a><a href="/#shop">Shop</a></nav></div></header>';
const footer='<footer class="mk-foot"><div class="mk-wrap"><strong>Burton &amp; Found</strong><p>Thoughtfully catalogued vintage paper · Ontario, Canada · All prices CAD</p><p>Explore historical advertising, movie portraits and themed collector sets. Brand names identify the featured vintage material.</p><a href="/">Home</a> · <a href="/#shop">Main shop</a> · <a href="/guides/caring-for-vintage-paper.html">Caring for vintage paper</a></div></footer>';
const frame=(title,description,path,content,img='',kind='website',ld=null)=>head(title,description,path,img,kind,ld)+'<body><a class="mk-skip" href="#main">Skip to content</a>'+header+'<main class="mk-wrap" id="main">'+content+'</main>'+footer+'</body></html>';
const card=p=>'<a class="mk-card" href="'+urlOf(p)+'"><span class="mk-photo"><img src="/'+clean(p.image)+'" alt="'+clean(p.title)+' — photographed catalogue item" loading="lazy" decoding="async" width="380" height="480"></span><span class="mk-card-copy"><small>'+clean(p.type==='bundle'?'Curated collector set':p.collection==='hollywood'?'Old Hollywood':'Coca-Cola advertising')+'</small><strong>'+clean(p.title)+'</strong><span>'+dollar(p.price)+' CAD</span></span></a>';
const urls=['/'];
const productLinks=Object.fromEntries(items.map(p=>[p.sku,urlOf(p)]));
mk('product-links.js','/* Generated; map product SKUs to searchable permanent URLs. */\nwindow.BURTON_PRODUCT_LINKS = '+JSON.stringify(productLinks)+';\n');

rmSync(join(publicRoot,'products'),{recursive:true,force:true});mkdirSync(join(publicRoot,'products'),{recursive:true});
rmSync(join(publicRoot,'collections'),{recursive:true,force:true});mkdirSync(join(publicRoot,'collections'),{recursive:true});
mkdirSync(join(publicRoot,'feeds'),{recursive:true});
for(const p of items){
 const path=urlOf(p);
 const copy=text(p.cmsLongDescription||p.shortDescription);
 const imgs=[...new Set([p.image,...(p.images||[])].filter(Boolean))].slice(0,12);
 const photos=imgs.map((im,i)=>'<a href="/'+clean(im)+'" target="_blank" rel="noopener" aria-label="View photograph '+(i+1)+' of '+clean(p.title)+'"><img src="/'+clean(im)+'" alt="'+clean(p.title)+' — photograph '+(i+1)+'" '+(i?'loading="lazy"':'fetchpriority="high"')+' width="600" height="800"></a>').join('');
 const cat=collectionFor(p);
 const info='<nav class="mk-crumb" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="'+collectionUrl(cat)+'">'+(cat==='hollywood'?'Old Hollywood':'Coca-Cola')+'</a> / '+clean(p.title)+'</nav>'+
  '<div class="mk-detail"><div class="mk-gallery">'+photos+'</div><div class="mk-detail-info"><p class="mk-kicker">'+clean(p.type==='bundle'?'Curated set':p.collection==='hollywood'?'Old Hollywood printed paper':'Vintage Coca-Cola advertising')+'</p>'+
  '<h1>'+clean(p.title)+'</h1><p class="mk-price">'+dollar(p.price)+' <small>CAD asking price</small></p><p>'+clean(copy)+'</p>'+
  '<dl><div><dt>Catalogue reference</dt><dd>'+clean(p.sku)+'</dd></div><div><dt>Item format</dt><dd>'+clean(p.edition||'Vintage printed-paper item')+'</dd></div>'+
  (p.year&&Number(p.year)>1900?'<div><dt>Year indicated</dt><dd>'+p.year+' (verify publication date)</dd></div>':'')+
  '<div><dt>Condition</dt><dd>'+clean(p.conditionNotes||p.condition||'Ask for current physical condition and dimensions')+'</dd></div></dl>'+
  '<a class="mk-button" href="/index.html?item='+encodeURIComponent(p.sku)+'#shop">View in the shop / add to bag</a>'+
  '<p class="mk-fine">Online card checkout is not yet enabled. Items can be saved in a bag for a purchase enquiry. Ask for exact measurements, reverse images and shipping details before payment.</p>'+
  (p.type==='bundle'?'<p>Set contents: '+p.catalogIds.map(id=>bySku.has(id)?'<a href="'+urlOf(bySku.get(id))+'">'+clean(bySku.get(id).title)+'</a>':clean(id)).join(', ')+'.</p>':'')+
  '<p class="mk-fine">Burton &amp; Found is an independent vintage-paper seller. Brand and entertainment names describe the historical materials, not an endorsement.</p></div></div>';
 const related=items.filter(x=>x.sku!==p.sku&&x.collection===p.collection&&x.type===p.type).slice(0,3);
 const also='<section class="mk-related"><h2>Explore related finds</h2><div class="mk-grid">'+related.map(card).join('')+'</div></section>';
 const ld={'@context':'https://schema.org','@type':'Product',name:p.title,description:short(copy,600),sku:p.sku,image:imgs.map(abs),category:p.collection==='hollywood'?'Old Hollywood vintage printed paper':'Vintage Coca-Cola advertising',url:abs(path)};
 // Offers omitted until merchant checkout AND tax approvals are confirmed, to avoid implying online payments.
 if(checkoutApproved)ld.offers={'@type':'Offer',url:abs(path),priceCurrency:'CAD',price:p.price.toFixed(2),itemCondition:'https://schema.org/UsedCondition',availability:'https://schema.org/InStock',seller:{'@type':'Organization',name:'Burton & Found'}};
 mk(path.slice(1),frame(p.title,copy,path,info+also,p.image,'product',ld));urls.push(path);
}
for(const c of collection){
 const selected=items.filter(p=>c.id==='sets'?p.type==='bundle':p.collection===c.id);
 const path=collectionUrl(c.id);
 const intro='<nav class="mk-crumb"><a href="/">Home</a> / Collections</nav><p class="mk-kicker">Browse by interest</p><h1>'+clean(c.title)+'</h1><p class="mk-lead">'+clean(c.description)+'</p><p class="mk-count">'+selected.length+' listed finds · CAD prices · photographed items</p>'+
 '<div class="mk-collection-nav">'+collection.map(x=>'<a href="'+collectionUrl(x.id)+'">'+clean(x.title)+'</a>').join('')+'</div>';
 const schema={'@context':'https://schema.org','@type':'CollectionPage',name:c.title,description:c.description,url:abs(path)};
 const grid='<section class="mk-grid" aria-label="Collection products">'+selected.map(card).join('')+'</section>';
 mk(path.slice(1),frame(c.title,c.description,path,intro+grid,selected[0]?.image,'website',schema));urls.push(path);
}
const guides=[
 {path:'/guides/collecting-vintage-ads.html',title:'How to collect original vintage magazine advertisements',
 description:'A practical guide to judging vintage magazine-ad pages, reading publication dates, inspecting paper condition and choosing meaningful advertising subjects.',
 paragraphs:[
  ['Start with the actual paper','Collecting vintage advertising begins with the physical object, not just its image. A printed magazine page, a loose advertising insert, a poster and a later reproduction can depict the same design but have very different histories and asking prices. Read the listing description closely and ask for images of both sides, full edges and scale.'],
  ['Treat dates as evidence, not certainty','A campaign slogan or a movie release can establish when an image was used, but it does not by itself prove when a specific sheet was printed. Look for issue mastheads, copyright statements and magazine page context. If the source is unknown, prefer an appropriately qualified date to an unsupported definitive claim.'],
  ['Look at condition and presentation','Examine corners, folds, trimming, staples, discoloration, damp staining, tears and adhesive residue. A beautiful image may still have issues hidden by a tight crop. For fragile paper, request a complete unfiltered scan and measurements before buying.'],
  ['Collect around a theme','Themes help an affordable collection feel intentional. Consider soda-fountain imagery, travel-related advertising, Western settings, holidays or classic cinema portraits. A themed set can be attractive when the constituent pages are known and stock is tracked individually.'],
  ['Decide what to display','Compare the dimensions against standard frames and choose conservation-minded materials. Separate the collectible from any adhesive or glass contact, and preserve details on its origin for future reference.']
 ]},
 {path:'/guides/caring-for-vintage-paper.html',title:'How to store and display vintage magazine pages',
 description:'Straightforward conservation-minded handling, display and storage advice for vintage advertisements, movie paper and magazine pages.',
 paragraphs:[
  ['Handle less, support more','Clean, dry hands are often appropriate for ordinary stable paper; use a clean flat workspace and support the entire sheet when lifting. Avoid repeated bending and never peel old tape without specialist advice. For delicate or valuable materials, ask a qualified conservator.'],
  ['Protect from light and moisture','Extended direct sunlight, damp spaces and frequent temperature swings accelerate fading, mould risk and paper deterioration. Choose a stable interior location and rotate displayed pieces when possible.'],
  ['Use protective, reversible display methods','Choose archival-quality, acid-free or appropriately buffered mounting materials suited to the paper. Keep the object off direct glass contact with a mat or spacer, and avoid pressure-sensitive tape, spray adhesives and permanent lamination.'],
  ['Keep documentation with the item','Record any visible publication details, condition, dimensions and provenance separately. Photograph both sides before storing, and avoid writing directly on the collectible.'],
  ['When buying online','Check whether a listing shows the actual front and back, whether the page is trimmed, whether the item is sold framed or unframed, and how it will be shipped. A rigid mailer and weather protection can help prevent transit damage.']
 ]},
 {path:'/guides/old-hollywood-printed-paper.html',title:'Collecting Old Hollywood magazine portraits and film ads',
 description:'An introduction to Old Hollywood film advertising and magazine portraits, with tips for recognizing printed material and reading qualified attributions.',
 paragraphs:[
  ['Different kinds of movie paper','Vintage magazine pages, publicity reproductions, fan-magazine portraits and studio still photographs are not interchangeable. A printed portrait may show a famous performer without being an original photographic print issued by the studio.'],
  ['A movie year is not necessarily a print year','A film release date is an excellent research clue but does not establish the printing year of an undated magazine clipping. Look for the publication source, issue, printer marks and contextual text.'],
  ['What makes a useful collection','Consider performers, movie genres, studio publicity style, design themes, and cohesive period color or typography. The visual story is often stronger with a small curated set than with unrelated paper.'],
  ['Inspect the whole page','Check for fold lines, cropping, margins, printer marks and printing on the reverse. Ask for size and condition details if not supplied.'],
  ['Preserve the history','Retain the original paper and document its known source. When displaying a sheet, favor reversible materials and careful light exposure.']
 ]}
];
for(const g of guides){
 const sections=g.paragraphs.map(([h,t])=>'<section><h2>'+clean(h)+'</h2><p>'+clean(t)+'</p></section>').join('');
 const related='<p><a href="/collections/coca-cola.html">Explore Coca-Cola originals</a> · <a href="/collections/hollywood.html">Browse Old Hollywood</a> · <a href="/collections/sets.html">View curated sets</a></p>';
 const ld={'@context':'https://schema.org','@type':'Article',headline:g.title,description:g.description,author:{'@type':'Organization',name:'Burton & Found'},publisher:{'@type':'Organization',name:'Burton & Found'},mainEntityOfPage:abs(g.path)};
 mk(g.path.slice(1),frame(g.title,g.description,g.path,'<nav class="mk-crumb"><a href="/">Home</a> / Collector guides</nav><p class="mk-kicker">The collector desk</p><article class="mk-article"><h1>'+clean(g.title)+'</h1><p class="mk-lead">'+clean(g.description)+'</p>'+sections+related+'</article>','','article',ld));
 urls.push(g.path);
}
// Public read-only JSON Feed for future authorized Pinterest/social syndication.
const feedItems=available.map(p=>({
 id:abs(urlOf(p)),url:abs(urlOf(p)),title:p.title,
 summary:short(p.shortDescription,320),image:abs(p.image),
 tags:[p.collection,p.type],_burton:{sku:p.sku,asking_price_cad:p.price}
}));
mk('feeds/collectibles.json',JSON.stringify({
 version:'https://jsonfeed.org/version/1.1',
 title:'Burton & Found · Collectible Paper Catalogue',
 home_page_url:base+'/',feed_url:abs('/feeds/collectibles.json'),
 description:'Photographed vintage advertising and Old Hollywood printed-paper items',
 items:feedItems
},null,2)+'\n');
mk('sitemap.xml','<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+urls.map(u=>'  <url><loc>'+clean(abs(u))+'</loc></url>').join('\n')+'\n</urlset>\n');
mk('robots.txt','User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin/\nDisallow: /checkout-success.html\nDisallow: /account.html\nDisallow: /preview.html\nSitemap: '+abs('/sitemap.xml')+'\n');
if(indexable){
 // Main-shop indexing is an explicit separate approval; never change checkout flags.
 for(const name of ['index.html','storefront.html']){
  const file=join(publicRoot,name);
  let html=readFileSync(file,'utf8');
  html=html.replace(/<meta content="noindex,\s*nofollow" name="robots"\s*\/?>/i,'<meta name="robots" content="index,follow,max-image-preview:large">');
  writeFileSync(file,html);
 }
}
mkdirSync(out,{recursive:true});
const csv=x=>'"'+String(x??'').replace(/"/g,'""').replace(/[\r\n]+/g,' ')+'"';
const rows=items.map(p=>[p.sku,p.title,p.collection,p.type,dollar(p.price),abs(urlOf(p)),abs(p.image),
 short('Original vintage paper: '+p.shortDescription,410),
 'Burton & Found · '+p.title+' · Vintage '+(p.collection==='hollywood'?'cinema':'advertising')+' · Catalogue photograph'].map(csv).join(','));
writeFileSync(join(out,'pinterest-and-social-catalog.csv'),['sku,title,collection,type,asking_cad,product_url,image_url,pin_description,image_alt',...rows].join('\n')+'\n');
// Deterministic weekly rotation across real Coca-Cola singles, Old Hollywood pieces and sets.
const weekNumber=Math.floor(Date.now()/(7*86400*1000));
const available=items.filter(p=>p.stockState!=='unavailable'&&p.status!=='unavailable');
const buckets={
 coke:available.filter(p=>p.collection==='coca-cola'&&p.type==='original'),
 hollywood:available.filter(p=>p.collection==='hollywood'&&p.type==='original'),
 sets:available.filter(p=>p.type==='bundle')
};
if(Object.values(buckets).some(x=>x.length<5))throw Error('Marketing rotation needs active inventory from each collection');
const offsets={coke:weekNumber*3,hollywood:weekNumber*5,sets:weekNumber};
const picks=[];
const seen=new Set();
for(let i=0;i<14;i++){
 const key=i%7===6?'sets':i%2===0?'coke':'hollywood';
 const list=buckets[key],seed=(offsets[key]+Math.floor(i/2))%list.length;
 let candidate;
 for(let shift=0;shift<list.length;shift++){const c=list[(seed+shift)%list.length];if(!seen.has(c.sku)){candidate=c;break}}
 if(!candidate)throw Error('Not enough distinct products for 14-day organic plan');
 picks.push(candidate);seen.add(candidate.sku);
}
const tagUrl=(p,source,slot)=>abs(urlOf(p))+'?utm_source='+source+'&utm_medium=organic&utm_campaign=collector_weekly&utm_content='+encodeURIComponent(p.sku.toLowerCase()+'-'+slot);
writeFileSync(join(out,'14-day-social-calendar.md'),
 '# Burton & Found · 14 post ideas (editorial drafts)\n\nThese drafts are not scheduled or published. Check condition and claims; follow each community\'s promotion rules.\n\n'+picks.map((p,i)=>'### Day '+(i+1)+' — '+p.title+'\n\n'+short(p.shortDescription,230)+'\n\nView item photographs and CAD asking price: '+tagUrl(p,'pinterest','day'+(i+1))+'\n\nSuggested tags: #VintageAdvertising #BurtonAndFound '+(p.collection==='hollywood'?'#OldHollywood':'#CocaColaCollectibles')+'\n').join('\n'));
writeFileSync(join(out,'weekly-social-queue.csv'),
 ['day,sku,collection,product_title,image_url,product_url,caption,pinterest_link',
 ...picks.map((p,i)=>[i+1,p.sku,p.collection,p.title,abs(p.image),abs(urlOf(p)),
 short(p.shortDescription,220)+' View this find at Burton & Found.',
 tagUrl(p,'pinterest','day'+(i+1))].map(csv).join(','))].join('\n')+'\n');
writeFileSync(join(out,'marketing-utm-links.csv'),
 ['sku,pinterest_url,facebook_url,instagram_bio_url',...items.map(p=>[p.sku,
 tagUrl(p,'pinterest','catalog'),tagUrl(p,'facebook','organic'),tagUrl(p,'instagram','bio')].map(csv).join(','))].join('\n')+'\n');
writeFileSync(join(out,'collector-newsletter-draft.md'),
 '# Subject: Three paper finds worth a closer look\n\nHello collectors,\n\nThis edition of Burton & Found highlights three vintage-paper finds:\n\n'+picks.slice(0,3).map(p=>'- '+p.title+' — '+dollar(p.price)+' CAD\n  '+abs(urlOf(p))).join('\n')+
 '\n\nA paper-collecting tip: always ask about the back of a vintage ad, the dimensions and any trimming before deciding to buy.\n\nBrowse the collection: '+base+'/collections/coca-cola.html?utm_source=newsletter&utm_medium=email&utm_campaign=collector_weekly\n\nThis is a DRAFT, not a sent email. Send only to subscribers with valid consent and include merchant identification and a working unsubscribe mechanism.\n');
writeFileSync(join(out,'marketing-readiness.json'),JSON.stringify({
 timestamp:new Date().toISOString(),base,productPages:items.length,collectionPages:collection.length,guidePages:guides.length,indexable,weeklyRotation:weekNumber,weeklyDraftItems:picks.map(p=>p.sku),jsonFeedItems:feedItems.length,
 checkoutApproved,merchantFeedCreated:false,productLinksCreated:true,socialPostsPublished:false,newsletterSent:false,
 nextSteps:['Approve search indexing after seller content review','Connect Google Search Console and submit sitemap','Connect Pinterest business account to import CSV or create Pins','Confirm live checkout and shipping before Merchant Center','Connect a consent-managed email platform before collecting newsletter subscribers']
},null,2));
console.log('Marketing build: '+items.length+' product pages, '+collection.length+' collections, '+guides.length+' guides, sitemap; indexing '+(indexable?'APPROVED':'BLOCKED pending owner launch approval')+'. No merchant feed or social/email sending.');
