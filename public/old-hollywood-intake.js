/* Burton & Found: searchable image index linked to real Old Hollywood shop listings. */
(()=>{
  'use strict';
  const items=Array.isArray(window.BURTON_NEW_HOLLYWOOD_ITEMS)?window.BURTON_NEW_HOLLYWOOD_ITEMS:[];
  const ready=window.BURTON_NEW_HOLLYWOOD_IMAGES_READY===true;
  const setMembership=new Map();
  for(const set of (window.BURTON_HOLLYWOOD_CURATED_SETS?.sets||[]))for(const sku of set.memberSkus)setMembership.set(sku,set);
  const $=id=>document.getElementById(id);
  const root=$('cards'),query=$('search'),category=$('category'),group=$('group'),sort=$('sort'),count=$('count');
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=x=>new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(x);
  const sources=['Modern Screen magazine pages','Dorothy Sebastian & contemporaries','Priscilla Lane & contemporaries','Robert Montgomery & contemporaries','Ruth Chatterton & magazine finds','What Happened / vintage film-paper','Hollywood film ads and portraits','Rock, Pretty Baby & mixed ephemera','Rock, Pretty Baby supplemental pages'];
  const isPrice=x=>typeof x.suggestedPriceCad==='number'&&Number.isFinite(x.suggestedPriceCad);
  const requested=new URLSearchParams(window.location.search).get('item');
  const requestSku=requested?.replace(/^OHN-/, 'OH-NEW-')||'';
  function render(){
    const term=query.value.trim().toLocaleLowerCase('en-CA');
    const c=category.value,g=group.value,order=sort.value;
    const data=items.filter(x=>{
      if(c!=='all'&&x.category!==c)return false;
      if(g!=='all'&&String(x.sourceGroup)!==g)return false;
      return !term||[x.title,x.description,x.category,x.sku,sources[x.sourceGroup-1]].join(' ').toLocaleLowerCase('en-CA').includes(term);
    });
    if(order==='featured'){
      const best=window.BURTON_FEATURED?.orders?.['hollywood:original']||[];
      const rank=new Map(best.map((sku,index)=>[sku,index]));
      data.sort((a,b)=>Number(!isPrice(a))-Number(!isPrice(b))||
        (rank.get(a.sku)??999)-(rank.get(b.sku)??999));
    }
    if(order==='price-asc')data.sort((a,b)=>(a.suggestedPriceCad??Infinity)-(b.suggestedPriceCad??Infinity));
    else if(order==='price-desc')data.sort((a,b)=>(b.suggestedPriceCad??-1)-(a.suggestedPriceCad??-1));
    else if(order==='title')data.sort((a,b)=>a.title.localeCompare(b.title,'en-CA'));
    count.textContent=`${data.length} of ${items.length} scans · ${data.filter(isPrice).length} have listed asking prices`;
    root.innerHTML=data.map(item=>{
      const img=ready?`<a href="${esc(item.image)}" target="_blank" rel="noopener" aria-label="View full scan of ${esc(item.title)}"><img src="${esc(item.image)}" width="520" height="680" alt="Actual scanned paper: ${esc(item.title)}" loading="lazy" decoding="async" style="width:100%;height:260px;object-fit:contain"></a>`:'<div class="reel" aria-hidden="true">✦</div><small>Actual scan in preparation</small>';
      const price=isPrice(item)?`<span class="review-price">${money(item.suggestedPriceCad)} CAD · Asking price</span>`:'<span class="pill">Alternate scan · no separate price</span>';
      const set=setMembership.get(item.sku);
      const shopLink=isPrice(item)?`<a class="bf-item-set-link" href="index.html?item=${encodeURIComponent(item.sku)}#shop">View product in the shop</a>`:item.sku==="OH-NEW-003-05"?`<a class="bf-item-set-link" href="index.html?item=OH-NEW-003-04#shop">See matching product and both photographs</a>`:item.sku==="OH-NEW-007-08"?`<a class="bf-item-set-link" href="index.html?item=OH-NEW-007-07#shop">See matching movie advertisement product</a>`:"";
      const setLink=set?`<a class="bf-item-set-link" href="index.html?item=${encodeURIComponent(set.id)}#shop">Part of curated set: ${esc(set.title)}</a>`:'';
      return `<article class="card" id="${esc(item.sku)}" aria-labelledby="title-${esc(item.sku)}"><div class="visual" style="padding:8px">${img}</div><div class="body"><div class="cat">${esc(item.category)}</div><h2 id="title-${esc(item.sku)}">${esc(item.title)}</h2><p>${esc(item.description)}</p><div class="meta">${esc(sources[item.sourceGroup-1])}<span class="sku">${esc(item.sku)}</span></div><div class="price-row">${price}</div>${shopLink}${setLink}<div class="cardfooter">Print date and photographic process are not authenticated; see product details for more information.</div></div></article>`;
    }).join('')||'<p role="status">No matching scans. Try a different category or search term.</p>';
  }
  for(const element of [query,category,group,sort])element.addEventListener(element===query?'input':'change',render);
  $('theme').addEventListener('click',()=>{const dark=document.body.classList.toggle('dark');$('theme').setAttribute('aria-pressed',String(dark));});
  if(requestSku&&items.some(x=>x.sku===requestSku)){query.value='';category.value='all';group.value='all';sort.value='group';}
  render();
  if(requestSku){const el=document.getElementById(requestSku);if(el){el.style.outline='2px solid var(--gold)';el.style.outlineOffset='3px';el.scrollIntoView({block:'center'});}}
})();