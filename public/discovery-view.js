/* Render product discovery from public catalogue data and explicit watchlist choices. */
(()=>{
'use strict';
const D=window.BURTON_DISCOVERY,A=window.BURTON_ACCOUNT,$=id=>document.getElementById(id);
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(n);
let stock=null,selected=null,lastUser=null;
const products=()=>window.BURTON_DATA?.inventory||[];
function image(p){const raw=String(p.image||'');return /^assets\/images\/[a-z0-9/_ .-]+\.(webp|jpe?g|png)$/i.test(raw)?raw:'';}
function tile(r){
 const {p,state:s}=r,src=image(p),href='index.html?item='+encodeURIComponent(p.sku)+'#shop';
 return '<article class="bf-find-card"><a href="'+safe(href)+'">'+(src?'<img src="'+safe(src)+'" alt="" loading="lazy" width="100" height="130">':'')+'<strong>'+safe(p.title)+'</strong></a><small>'+safe(D.collection(p))+' · '+safe(p.sku)+'</small><span>'+safe(money(s.price))+' CAD</span><span class="bf-find-state">'+safe(s.label)+'</span>'+(r.why?'<small>'+safe(r.why)+'</small>':'')+'</article>';
}
function related(){
 const host=$('relatedFinds');if(!host||!selected)return;
 const r=D.recommendations(products(),[selected],stock,4,A?.getLocalBag?.()||[]);
 host.hidden=!r.length;host.innerHTML=r.length?'<h3>Related finds</h3><p>Other catalogue pieces with similar subjects or eras. These do not reserve stock.</p><div class="bf-find-grid">'+r.map(tile).join('')+'</div>':'';
}
function saved(){
 const host=$('savedFindsShelf');if(!host)return;
 if(A?.isLoading?.()){host.hidden=true;if($('savedFindsJump'))$('savedFindsJump').hidden=true;$('savedFindsList').replaceChildren();$('savedFindsRecommendations').replaceChildren();return;}
 const ids=A?.watchedSkus?.()||[],rows=D.watchlist(products(),ids,stock);
 host.hidden=!rows.length;if($('savedFindsJump')){$('savedFindsJump').hidden=!rows.length;$('savedFindsJump').textContent='Saved finds ('+rows.length+') ↓';}
 $('savedFindsSummary').textContent=(A?.user?.()?'Your account':'Saved in this browser')+' · '+rows.length+' saved '+(rows.length===1?'find':'finds')+' · '+rows.filter(x=>x.state.kind==='unavailable').length+' sold or reserved. Saving does not reserve an item.';
 $('savedFindsList').innerHTML=rows.slice(0,6).map(tile).join('');
 $('savedFindsMore').textContent=rows.length>6?'Showing the first six of '+rows.length+' saved finds. Open your collector account to manage the full watchlist.':'';
 const recs=$('savedFindsPersonal').checked?D.recommendations(products(),rows.map(x=>x.p),stock,4,A?.getLocalBag?.()||[]):[];
 $('savedFindsRecommendations').innerHTML=recs.length?'<h3>Based on your saved finds</h3><div class="bf-find-grid">'+recs.map(tile).join('')+'</div>':'';
}
window.BURTON_DISCOVERY_VIEW=Object.freeze({setStock:body=>{stock=D.stockMap(body);related();saved();},showRelated:p=>{selected=p;related();},clearRelated:()=>{selected=null;},renderSaved:saved});
document.addEventListener('bf:watch-change',saved);document.addEventListener('bf:auth-change',()=>{const next=A?.user?.()?.id||null;if(next!==lastUser){if($('savedFindsPersonal'))$('savedFindsPersonal').checked=false;lastUser=next;}saved();});
document.addEventListener('bf:bag-sync',()=>{related();saved();});
document.addEventListener('DOMContentLoaded',()=>{$('savedFindsPersonal')?.addEventListener('change',saved);saved();},{once:true});
})();
