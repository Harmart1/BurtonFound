/* Burton & Found — Old Hollywood previews inside the main Shop.
 * 73 source scans and 11 proposed sets; NEVER commercial checkout inventory.
 * The live store in store.js remains the sole owner of shopping bags and SKU sales.
 */
(()=>{
'use strict';
const singles=Array.isArray(window.BURTON_NEW_HOLLYWOOD_ITEMS)?window.BURTON_NEW_HOLLYWOOD_ITEMS:[];
const sets=Array.isArray(window.BURTON_HOLLYWOOD_CURATED_SETS?.sets)?window.BURTON_HOLLYWOOD_CURATED_SETS.sets:[];
const bySingle=new Map(singles.map(x=>[x.sku,x]));
const previews=[
 ...sets.map((x,i)=>({sku:x.id,title:x.title,description:x.description,image:x.image,
   price:x.proposedSetPriceCad,type:'bundle',kind:'set',category:x.category,source:x,rank:i})),
 ...singles.map((x,i)=>({sku:x.sku,title:x.title,description:x.description,image:x.image,
   price:x.suggestedPriceCad,type:'original',kind:'scan',category:x.category,source:x,rank:i}))
];
const byPreview=new Map(previews.map(x=>[x.sku,x]));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(n);
const isPrice=n=>typeof n==='number'&&Number.isFinite(n);
const linkToItem=sku=>'old-hollywood-new.html?item='+encodeURIComponent(sku)+'#'+encodeURIComponent(sku);
const linkToSet=slug=>'old-hollywood-new.html?set='+encodeURIComponent(slug)+'#sets';
function matching(options){
 const {collection='all',type='all',decade='all',search='',sort='featured'}=options||{};
 if(!['all','hollywood'].includes(collection)||decade!=='all')return [];
 const q=String(search).trim().toLowerCase();
 const list=previews.filter(x=>
   (type==='all'||x.type===type)&&
   (!q||[x.sku,x.title,x.description,x.category,
     ...(x.kind==='set'?x.source.memberSkus.flatMap(id=>{
       const item=bySingle.get(id);
       return item?[item.title,item.sku,item.category]:[];
     }):[])
   ].join(' ').toLowerCase().includes(q))
 );
 if(sort==='low')list.sort((a,b)=>(a.price??Infinity)-(b.price??Infinity));
 else if(sort==='high')list.sort((a,b)=>(b.price??-Infinity)-(a.price??-Infinity));
 else if(sort==='featured')list.sort((a,b)=>
   a.kind!==b.kind?(a.kind==='set'?-1:1):a.rank-b.rank
 );
 return list;
}
function card(p){
 const set=p.kind==='set',duplicate=!set&&!isPrice(p.price);
 const top=set?'OLD HOLLYWOOD · CURATED SET':duplicate?'ALTERNATE SCAN · REVIEW':'OLD HOLLYWOOD · PREVIEW';
 const meta=set?p.source.memberSkus.length+' scanned prints · '+p.category:
   p.category+' · Publication date unverified';
 const price=set?'Proposed set · '+money(p.price)+' CAD':
   duplicate?'Possible duplicate · no separate price':'Suggested '+money(p.price)+' CAD';
 return '<article class="product-card bf-new-hollywood-card'+(duplicate?' bf-alternate-scan':'')+
   '" data-preview-sku="'+esc(p.sku)+'">'+
   '<button type="button" class="product-media" data-preview-view="'+esc(p.sku)+'" '+
   'aria-label="View Old Hollywood details for '+esc(p.title)+'">'+
   '<span class="media-kicker">'+esc(top)+'</span>'+
   '<img loading="lazy" decoding="async" width="800" height="900" src="'+esc(p.image)+
   '" alt="Digitized vintage paper: '+esc(p.title)+'">'+
   '<span class="media-view" aria-hidden="true">↗</span></button>'+
   '<div class="product-info"><p class="product-meta">'+esc(meta)+'</p>'+
   '<h3 class="product-title">'+esc(p.title)+'</h3>'+
   '<p class="product-desc">'+esc(p.description)+'</p>'+
   '<p class="bf-hollywood-unverified">Source scan · Physical item not yet verified</p>'+
   '<div class="product-price-row"><div class="product-price bf-preview-asking">'+esc(price)+'</div>'+
   '<button type="button" class="add-small bf-preview-details-button" data-preview-view="'+esc(p.sku)+
   '" aria-label="Read details for '+esc(p.title)+'">VIEW DETAILS</button></div>'+
   '</div></article>';
}
function renderCards(options){
 const m=matching(options);
 return {html:m.map(card).join(''),count:m.length,sets:m.filter(x=>x.kind==='set').length,
   scans:m.filter(x=>x.kind==='scan').length};
}
function openDetails(sku){
 const p=byPreview.get(sku);
 if(!p)return false;
 const dialog=document.getElementById('productDialog'),body=document.getElementById('productDetails');
 if(!dialog||!body)return false;
 const set=p.kind==='set',members=set?p.source.memberSkus.map(id=>bySingle.get(id)).filter(Boolean):[];
 const price=isPrice(p.price)?money(p.price)+' CAD':'Not individually priced';
 const condition=set?'Each component needs physical condition verification':
   p.source.physicalCondition||'Inspect actual paper before sale';
 const medium=set?'Proposed set of vintage paper images':
   p.source.format||'Vintage paper source scan · medium unverified';
 const extra=set?
   '<section class="bf-preview-set-members" aria-label="Proposed set contents">'+
   '<h3>Included scans ('+members.length+')</h3><div class="bf-preview-member-grid">'+
   members.map(m=>'<a href="'+linkToItem(m.sku)+'"><img src="'+esc(m.image)+
     '" alt="" loading="lazy" width="70" height="90"><span>'+esc(m.title)+
     '<small>'+esc(m.sku)+'</small></span></a>').join('')+
   '</div><p><a href="'+linkToSet(p.source.slug)+'">Explore the complete curated set</a></p></section>':
   '<p><a class="bf-preview-archive-link" href="'+linkToItem(p.sku)+'">View complete source listing</a></p>';
 const memberOf=!set?sets.find(x=>x.memberSkus.includes(p.sku)):null;
 const other=memberOf?'<p><a class="bf-preview-archive-link" href="'+linkToSet(memberOf.slug)+
    '">Part of the proposed '+esc(memberOf.title)+' set</a></p>':'';
 body.innerHTML=
   '<div class="detail-media"><img class="detail-hero-img" id="detailHeroImage" src="'+esc(p.image)+
   '" alt="Scanned paper: '+esc(p.title)+'" width="1050" height="1394">'+
   '<button type="button" class="detail-zoom" id="detailZoom">⤢ View image larger</button>'+
   '<p class="detail-photo-note">Source scan of printed material · Details pending verification</p></div>'+
   '<div class="detail-copy"><p class="eyebrow small">OLD HOLLYWOOD · '+esc(p.sku)+
   ' · CATALOGUE PREVIEW</p><h2>'+esc(p.title)+'</h2>'+
   '<div class="detail-price">'+esc(price)+'<small>CAD · '+(set?'PROPOSED BUNDLE PRICE':'SUGGESTED PRICE ONLY')+'</small></div>'+
   '<p class="detail-intro">'+esc(p.description)+'</p>'+
   '<dl class="detail-grid"><div><dt>STATUS</dt><dd>Not yet for sale</dd></div>'+
   '<div><dt>PRINT DATE</dt><dd>Unverified</dd></div>'+
   '<div><dt>PHYSICAL FORMAT</dt><dd>'+esc(medium)+'</dd></div>'+
   '<div><dt>CONDITION</dt><dd>'+esc(condition)+'</dd></div></dl>'+
   '<div class="detail-note"><strong>ARCHIVE NOTICE.</strong> Printed format, condition and stock are still being verified. Some scans may be alternate views of a single physical item. No payment is available for this entry.</div>'+
   extra+other+
   '<div class="detail-purchase"><p class="bf-preview-purchase-notice">Preview only · Not available to add to bag or checkout</p></div></div>';
 dialog.showModal();
 return true;
}
window.BF_HOLLYWOOD_SHOP=Object.freeze({renderCards,openDetails,
  stats:Object.freeze({scans:singles.length,sets:sets.length,pricedScans:singles.filter(x=>isPrice(x.suggestedPriceCad)).length})});
})();