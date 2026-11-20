/* Actual inventory-driven preview, no duplicate product data or simulated checkout */
(()=>{
'use strict';
const D=window.BURTON_DATA||{inventory:[]},items=Array.isArray(D.inventory)?D.inventory:[];
const box=document.getElementById('prFeaturedGrid'),tabs=[...document.querySelectorAll('[data-pr-collection]')],status=document.getElementById('prFeaturedStatus');
if(!box||!tabs.length||!status)return;
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(n);
const featureSku=window.BURTON_FEATURED?.preview||{
  hollywood:['OH-003','OH-NEW-004-10','OH-NEW-002-05','OH-NEW-007-01'],
  sets:['OHS-003','OHS-011','OHS-001','OHS-007'],
  'coca-cola':['CC-010','CC-023','CC-034','CC-027'],
  automobiles:['VA-049','VA-022','VA-016','VA-002']
};
const bySku=new Map(items.map(p=>[p.sku,p]));
const card=p=>{
  const type=p.collection==='automobiles'?'VINTAGE AUTOMOBILE · VERIFY STOCK':p.type==='bundle'?'CURATED COLLECTOR SET':p.collection==='hollywood'?'OLD HOLLYWOOD ORIGINAL':'VINTAGE ADVERTISING';
  const note=p.type==='bundle'?(p.catalogIds?.length||0)+' included pieces':p.collection==='automobiles'?'Advertising print design · physical stock unverified':p.collection==='hollywood'?'Printed-paper collectible':'Original magazine advertising';
  return '<a class="pr-product" href="index.html?item='+encodeURIComponent(p.sku)+'#shop" aria-label="View '+safe(p.title)+' in the shop, '+money(p.price)+' Canadian">'+
    '<span class="pr-product-photo"><img src="'+safe(p.image)+'" alt="'+safe(p.title)+' vintage paper artwork" loading="lazy" decoding="async" width="500" height="625"></span>'+
    '<div class="pr-product-info"><span class="pr-product-kicker">'+type+'</span>'+
    '<h3>'+safe(p.title)+'</h3><p>'+safe(p.shortDescription||note)+'</p>'+
    '<div class="pr-product-bottom"><strong class="pr-product-price">'+(p.requiresVerification?'Indicative ':'')+money(p.price)+' <small>CAD</small></strong><span class="pr-product-view">View product ↗</span></div></div></a>';
};
function render(collection){
  const chosen=(featureSku[collection]||featureSku.hollywood).map(s=>bySku.get(s)).filter(Boolean);
  box.innerHTML=chosen.map(card).join('')||'<p>Items temporarily unavailable. Browse the full catalogue.</p>';
  for(const tab of tabs){const selected=tab.dataset.prCollection===collection;tab.setAttribute('aria-pressed',String(selected));}
  const names={'hollywood':'Old Hollywood individual finds','sets':'curated Hollywood sets','coca-cola':'Coca-Cola vintage advertising','automobiles':'vintage automobile advertising scans'};
  status.textContent=chosen.length+' photographed product selections from '+(names[collection]||names.hollywood)+'. Prices in Canadian dollars. '+(collection==='automobiles'?'Automobile prices are indicative and physical paper stock must be confirmed before purchase. ':'')+'Each card opens its full listing in the shop.';
}
tabs.forEach(tab=>tab.addEventListener('click',()=>render(tab.dataset.prCollection)));
render('coca-cola');
})();
