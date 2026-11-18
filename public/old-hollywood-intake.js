/* Burton & Found · individually curated Old Hollywood archive and provisional CAD suggestions. */
(()=>{'use strict';
const catalog=window.BURTON_HOLLYWOOD_DRAFT_CATALOG;
const cards=document.getElementById('cards'),search=document.getElementById('search'),type=document.getElementById('category'),group=document.getElementById('group'),sort=document.getElementById('sort'),count=document.getElementById('count');
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=x=>new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(x);
if(!catalog||!Array.isArray(catalog.entries)){cards.textContent='The preview catalogue could not be loaded. Please reload the page.';return;}
const sourceNames=new Map(catalog.groups.map(x=>[x.id,x.name]));
for(const g of catalog.groups){const el=document.createElement('option');el.value=g.id;el.textContent=g.name;group.appendChild(el);}
const photosReady=window.BURTON_NEW_HOLLYWOOD_IMAGES_READY===true;
const itemFromLink=new URLSearchParams(location.search).get('item');
if(itemFromLink&&/^OHN-\d{3}-\d{2}$/.test(itemFromLink))search.value=itemFromLink;

function render(){
 const q=search.value.trim().toLocaleLowerCase('en'),cat=type.value,g=group.value,s=sort.value;
 let list=catalog.entries.filter(x=>(cat==='all'||x.type===cat)&&(g==='all'||x.group===g)&&[x.title,x.description,x.id,sourceNames.get(x.group),x.type].join(' ').toLocaleLowerCase('en').includes(q));
 if(s==='title')list=[...list].sort((a,b)=>a.title.localeCompare(b.title));
 if(s==='price-low')list=[...list].sort((a,b)=>(a.suggestedCad??Infinity)-(b.suggestedCad??Infinity));
 if(s==='price-high')list=[...list].sort((a,b)=>(b.suggestedCad??-Infinity)-(a.suggestedCad??-Infinity));
 const priced=list.filter(x=>Number.isFinite(x.suggestedCad)).length;
 count.textContent=list.length+' scans · '+priced+' with draft CAD prices';
 cards.innerHTML=list.map(x=>{
 const name=esc(x.title),id=esc(x.id),photo=esc(x.image),price=Number.isFinite(x.suggestedCad)?'<span class="suggested">'+money(x.suggestedCad)+'</span><div class="price-label">Suggested asking price · CAD</div>':'<div class="price-label"><strong>Price withheld</strong> · possible duplicate scan</div>';
 const image=photosReady?'<a class="card-picture" href="'+photo+'" target="_blank" rel="noopener" aria-label="Open image for '+name+'"><img src="'+photo+'" alt="'+name+' — photograph of the source paper scan" loading="lazy" decoding="async"></a>':'<div class="visual" role="img" aria-label="Scanned photograph pending publication">Archival image under review</div>';
 return '<article class="card">'+image+'<div class="body"><div class="item-id">'+id+' · '+esc(x.type)+'</div><h2>'+name+'</h2><p>'+esc(x.description)+'</p><div class="meta">Source: '+esc(sourceNames.get(x.group))+' · Page '+x.page+'</div><div>'+price+'</div><div class="draftnote">Photographed paper, not a digital print listing. Physical inventory, age, paper, size and condition to be verified.</div><div class="cardfooter"><span class="pill">'+(x.suggestedCad===null?'Duplicate review':'Not yet available to buy')+'</span>'+(photosReady?'<a class="preview-link" href="'+photo+'" target="_blank" rel="noopener">View actual scan</a>':'')+'</div></div></article>';
 }).join('')||'<p>No matching archive scans. Try another search or filter.</p>';
}
for(const el of [search,type,group,sort])el.addEventListener(el===search?'input':'change',render);
document.getElementById('theme').addEventListener('click',()=>document.body.classList.toggle('dark'));
render();
})();
