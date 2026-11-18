/* Curated previews only: every group is editorial and NOT in cart, checkout, or Supabase stock. */
(()=>{
  "use strict";
  const catalog=window.BURTON_HOLLYWOOD_CURATED_SETS;
  const items=window.BURTON_NEW_HOLLYWOOD_ITEMS;
  const grid=document.getElementById("setsGrid"),selector=document.getElementById("setCategory"),count=document.getElementById("setsCount");
  if(!catalog||!Array.isArray(catalog.sets)||!Array.isArray(items)||!grid||!selector||!count)return;
  const bySku=new Map(items.map(x=>[x.sku,x]));
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const money=n=>new Intl.NumberFormat("en-CA",{style:"currency",currency:"CAD"}).format(n);
  const urlFor=sku=>"old-hollywood-new.html?item="+encodeURIComponent(sku)+"#"+encodeURIComponent(sku);
  function render(){
    const selected=selector.value;
    const list=catalog.sets.filter(s=>selected==="all"||s.category===selected);
    count.textContent=list.length+" curated set"+(list.length===1?"":"s");
    grid.innerHTML=list.map(set=>{
      const members=set.memberSkus.map(sku=>bySku.get(sku)).filter(Boolean);
      const mosaic=members.slice(0,4).map(item=>
        '<a href="'+urlFor(item.sku)+'" aria-label="View '+esc(item.title)+'"><img src="'+esc(item.image)+'" loading="lazy" decoding="async" alt="'+esc(item.title)+'" width="320" height="410"></a>'
      ).join("");
      const membersHtml=members.map(item=>
        '<li><a href="'+urlFor(item.sku)+'"><img src="'+esc(item.image)+'" loading="lazy" decoding="async" alt="" width="49" height="65"><span><strong>'+esc(item.title)+'</strong><small>'+esc(item.sku)+' · Recommended '+money(item.suggestedPriceCad)+' CAD</small></span></a></li>'
      ).join("");
      return '<article class="bf-set-card" id="set-'+esc(set.slug)+'" aria-labelledby="set-title-'+esc(set.slug)+'">'+
        '<div class="bf-set-mosaic">'+mosaic+'</div>'+
        '<div class="bf-set-content">'+
          '<span class="bf-set-category">'+esc(set.category)+' · '+members.length+' scans</span>'+
          '<h3 id="set-title-'+esc(set.slug)+'">'+esc(set.title)+'</h3>'+
          '<p class="bf-set-subtitle">'+esc(set.subtitle)+'</p>'+
          '<p class="bf-set-description">'+esc(set.description)+'</p>'+
          '<div class="bf-set-price"><div><small>Proposed set asking price · CAD</small><strong>'+money(set.proposedSetPriceCad)+'</strong></div>'+
          '<div><small>Combined draft individual prices</small><strong class="bf-set-reference">'+money(set.individualDraftTotalCad)+'</strong><small>About '+esc(set.indicativeDiscountPercent)+'% below draft singles total</small></div></div>'+
          '<span class="bf-set-status">Curated preview · not for sale yet</span>'+
          '<p class="bf-set-note">These are scans, not confirmed distinct physical sale units. Set membership and price depend on condition and stock checks.</p>'+
          '<details class="bf-set-details"><summary>Explore all '+members.length+' included scans</summary><ul class="bf-set-items">'+membersHtml+'</ul></details>'+
        '</div></article>';
    }).join("")||'<p>No matching sets.</p>';
  }
  selector.addEventListener("change",render);
  render();
  const requested=new URLSearchParams(location.search).get("set");
  if(requested&&catalog.sets.some(x=>x.slug===requested)){
    const setCard=document.getElementById("set-"+requested);
    if(setCard){const details=setCard.querySelector("details");if(details)details.open=true;setCard.scrollIntoView({block:"start"});}
  }
})();
