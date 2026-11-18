/* Owner-supplied Old Hollywood archive; no checkout availability or prices. */
(()=>{'use strict';
const items=[{"sku":"OH-NEW-001","title":"Modern Screen — vintage magazine pages","pages":9,"category":"Fan magazines","note":"Scanned vintage film-magazine pages and studio publicity. A second PDF copy was excluded from this collection intake."},{"sku":"OH-NEW-002","title":"Dorothy — vintage Hollywood portraits and clippings","pages":6,"category":"Studio portraits","note":"Mixed portrait and film-publicity scans; printed dates, issue and original dimensions still require verification."},{"sku":"OH-NEW-003","title":"Priscilla Lane — Warner Bros.–First National","pages":9,"category":"Studio portraits","note":"Portrait and related magazine/publicity scans. Verify each page and whether individual pieces are physically separate."},{"sku":"OH-NEW-004","title":"Robert Montgomery — Metro-Goldwyn-Mayer","pages":10,"category":"Studio portraits","note":"Portrait and promotional film-paper scans including the named MGM star."},{"sku":"OH-NEW-005","title":"Ruth Chatterton — studio-era publicity","pages":10,"category":"Studio portraits","note":"Mixed classic-Hollywood photography and film-advertising scans; Ruth Chatterton appears in the source material."},{"sku":"OH-NEW-006","title":"What Happened — vintage film paper","pages":9,"category":"Film advertising","note":"Mixed publicity and vintage magazine scans; the source title alone does not establish the film, publisher or date."},{"sku":"OH-NEW-007","title":"Here's Proof He — film advertising and clippings","pages":8,"category":"Film advertising","note":"Includes advertising copy and assorted classic film-era prints; item boundaries are unverified."},{"sku":"OH-NEW-008","title":"Rock, Pretty Baby / Hot Rod — film-era advertising","pages":10,"category":"Film advertising","note":"Film advertising, studio portraits and related printed ephemera from the source scan."},{"sku":"OH-NEW-009","title":"Rock, Pretty Baby / Hot Rod — supplementary scans","pages":2,"category":"Film advertising","note":"Two additional scans; likely overlaps with the longer advertising group, so not treated as a separate saleable physical item."}];
const photosReady=window.BURTON_NEW_HOLLYWOOD_IMAGES_READY===true;
const root=document.getElementById('cards'),query=document.getElementById('search'),category=document.getElementById('category'),count=document.getElementById('count');
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function visual(x){
 if(!photosReady)return '<div class="visual" role="img" aria-label="Actual scan preview being prepared"><span class="reel" aria-hidden="true">✦</span><small>Silver screen archive</small><small>Actual scan preview in preparation</small></div>';
 return '<div class="visual" style="padding:8px"><img loading="lazy" decoding="async" style="width:100%;height:205px;object-fit:contain" alt="Preview of actual source scan: '+esc(x.title)+'" src="'+imagePath(x,1)+'"></div>';
}
function imagePath(x,n){return 'assets/images/old-hollywood/ohnew-'+x.sku.slice(-3)+'-'+String(n).padStart(2,'0')+'.webp';}
function gallery(x){
 if(!photosReady)return '';
 return '<details><summary>View '+x.pages+' scanned pages</summary><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:12px 0">'+Array.from({length:x.pages},(_,i)=>'<a href="'+imagePath(x,i+1)+'" target="_blank" rel="noopener" aria-label="Open scan '+(i+1)+' of '+esc(x.title)+'"><img src="'+imagePath(x,i+1)+'" loading="lazy" alt="Scan page '+(i+1)+'" style="width:100%;height:135px;object-fit:contain;border:1px solid var(--line)"></a>').join('')+'</div></details>';
}
function render(){
 const q=query.value.trim().toLowerCase(),cat=category.value;
 const list=items.filter(x=>(cat==='all'||x.category===cat)&&[x.title,x.category,x.note].join(' ').toLowerCase().includes(q));
 count.textContent=list.length+' archive group'+(list.length===1?'':'s');
 root.innerHTML=list.map(x=>'<article class="card">'+visual(x)+'<div class="body"><div class="cat">'+esc(x.category)+'</div><h2>'+esc(x.title)+'</h2><p>'+esc(x.note)+'</p><div class="meta">'+x.pages+' scanned pages · '+esc(x.sku)+'</div>'+gallery(x)+'<div class="cardfooter"><span class="pill">Under review · no price</span></div></div></article>').join('')||'<p>No matching archive groups.</p>';
}
query.addEventListener('input',render);
category.addEventListener('change',render);
document.getElementById('theme').addEventListener('click',()=>document.body.classList.toggle('dark'));
render();
})();
