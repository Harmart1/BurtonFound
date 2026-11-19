/* Browse curated sets that share physical stock with their individual items in the shop. */
(()=>{
  "use strict";
  const catalog=window.BURTON_HOLLYWOOD_CURATED_SETS;
  const items=window.BURTON_NEW_HOLLYWOOD_ITEMS;
  const grid=document.getElementById("setsGrid"),selector=document.getElementById("setCategory"),count=document.getElementById("setsCount");
  if(!catalog||!Array.isArray(catalog.sets)||!Array.isArray(items)||!grid||!selector||!count)return;
  const bySku=new Map(items.map(x=>[x.sku,x]));
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const money=n=>new Intl.NumberFormat("en-CA",{style:"currency",currency:"CAD"}).format(n);
  const urlFor=sku=>"index.html?item="+encodeURIComponent(sku)+"#shop";
  function render(){
    const selected=selector.value;
    const list=catalog.sets.filter(s=>selected==="all"||s.category===selected);
    const priorities=window.BURTON_FEATURED?.orders?.['hollywood:bundle']||[];
    const order=new Map(priorities.map((sku,index)=>[sku,index]));
    list.sort((a,b)=>(order.get(a.id)??999)-(order.get(b.id)??999));
    count.textContent=list.length+" curated set"+(list.length===1?"":"s");
    grid.innerHTML=list.map(set=>{
      const members=set.memberSkus.map(sku=>bySku.get(sku)).filter(Boolean);
      const visualMembers=[...members].sort((a,b)=>Number(b.image===set.image)-Number(a.image===set.image));
      const mosaic=visualMembers.slice(0,4).map(item=>
        '<a href="'+urlFor(item.sku)+'" aria-label="View '+esc(item.title)+'"><img src="'+esc(item.image)+'" loading="lazy" decoding="async" alt="'+esc(item.title)+'" width="320" height="410"></a>'
      ).join("");
      const membersHtml=members.map(item=>
        '<li><a href="'+urlFor(item.sku)+'"><img src="'+esc(item.image)+'" loading="lazy" decoding="async" alt="" width="49" height="65"><span><strong>'+esc(item.title)+'</strong><small>'+esc(item.sku)+' · '+money(item.suggestedPriceCad)+' CAD</small></span></a></li>'
      ).join("");
      return '<article class="bf-set-card" id="set-'+esc(set.slug)+'" aria-labelledby="set-title-'+esc(set.slug)+'">'+
        '<div class="bf-set-mosaic">'+mosaic+'</div>'+
        '<div class="bf-set-content">'+
          '<span class="bf-set-category">'+esc(set.category)+' · '+members.length+' pieces</span>'+
          '<h3 id="set-title-'+esc(set.slug)+'">'+esc(set.title)+'</h3>'+
          '<p class="bf-set-subtitle">'+esc(set.subtitle)+'</p>'+
          '<p class="bf-set-description">'+esc(set.description)+'</p>'+
          '<div class="bf-set-price"><div><small>Collector set price · CAD</small><strong>'+money(set.proposedSetPriceCad)+'</strong></div>'+
          '<div><small>Individual item totals</small><strong class="bf-set-reference">'+money(set.individualDraftTotalCad)+'</strong><small>About '+esc(set.indicativeDiscountPercent)+'% below individual asking prices</small></div></div>'+
          '<span class="bf-set-status">Curated set · shop the collection</span>'+
          '<p class="bf-set-note">Pieces are linked to their individual listings. Availability is shared; ask for measurements or additional condition photographs if needed.</p>'+
          '<details class="bf-set-details"><summary>Explore all '+members.length+' included pieces</summary><ul class="bf-set-items">'+membersHtml+'</ul></details>'+
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
