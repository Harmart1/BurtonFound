/* Page-local catalogue tools, no network, persistence, checkout or personal data. */
(()=>{
'use strict';
const D=window.BURTON_DISCOVERY;
const units=p=>Array.isArray(p?.catalogIds)&&p.catalogIds.length?p.catalogIds:[p?.sku];
const overlaps=(a,b)=>units(a).some(x=>units(b).includes(x));
function giftMatches(products,stock,{interest='all',budget=50,format='all',includeEnquiry=false}={}){
 if(!Number.isFinite(budget)||budget<=0)return [];
 const candidates=products.filter(p=>p?.sku&&!p.cmsOnly&&(interest==='all'||p.collection===interest)&&(format==='all'||p.type===format)).map(p=>({p,state:D.state(p,stock)})).filter(({state:s})=>Number.isFinite(s.price)&&s.price>0&&s.price<=budget&&s.kind!=='unavailable'&&(s.kind==='available'||includeEnquiry));
 const priority={available:0,enquiry:1,unknown:2};
 candidates.sort((a,b)=>priority[a.state.kind]-priority[b.state.kind]||Math.abs(budget*.75-a.state.price)-Math.abs(budget*.75-b.state.price)||a.p.sku.localeCompare(b.p.sku));
 const found=[];
 for(const r of candidates){if(found.some(q=>overlaps(r.p,q.p)))continue;found.push(r);if(found.length===6)break;}
 return found;
}
function comparison(products,ids,stock){
 const chosen=[...new Set(ids)].slice(0,3).map(id=>products.find(p=>p.sku===id&&!p.cmsOnly)).filter(Boolean);
 return {rows:chosen.map(p=>({p,state:D.state(p,stock)})),conflicts:chosen.flatMap((p,i)=>chosen.slice(i+1).filter(q=>overlaps(p,q)).map(q=>[p.sku,q.sku]))};
}
const pure=Object.freeze({giftMatches,comparison,overlaps});
window.BURTON_GIFT_CORE=pure;
if(typeof document==='undefined')return;
const $=id=>document.getElementById(id),products=()=>window.BURTON_DATA?.inventory||[];
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(n);
let stock=null,selected=[],searched=false;
const has=sku=>selected.includes(sku);
function image(p){return /^assets\/images\/[a-z0-9/_ .-]+\.(webp|jpe?g|png)$/i.test(p.image||'')?'<img src="'+safe(p.image)+'" alt="" loading="lazy" width="100" height="130">':'';}
const link=p=>'<a href="index.html?item='+encodeURIComponent(p.sku)+'#shop">'+image(p)+'<strong>'+safe(p.title)+'</strong></a>';
const button=p=>'<button class="bf-compare-button" type="button" data-compare="'+safe(p.sku)+'" aria-pressed="'+has(p.sku)+'">'+(has(p.sku)?'Remove from comparison':'Compare')+'</button>';
function fields(p,s){return '<small>'+safe(D.collection(p))+' · '+safe(p.sku)+'</small><strong>'+safe(money(s.price))+' CAD</strong><span class="bf-find-state">'+safe(s.label)+'</span>';}
function gift(){
 if(!$('giftResults')||!searched)return;
 const rows=giftMatches(products(),stock,{interest:$('giftInterest').value,budget:Number($('giftBudget').value),format:$('giftFormat').value,includeEnquiry:$('giftIncludeEnquiry').checked});
 $('giftResults').innerHTML=rows.map(({p,state:s})=>'<article class="bf-find-card">'+link(p)+fields(p,s)+button(p)+'</article>').join('');
 $('giftStatus').textContent=rows.length?'Showing '+rows.length+' distinct suggestions. Asking prices exclude shipping and taxes; confirm availability before purchase.':'No matches for these preferences. Try a higher budget, another collection or include enquiry-only and unconfirmed listings.';
}
function render(){
 if(!$('compareResults'))return;
 const c=comparison(products(),selected,stock);selected=c.rows.map(x=>x.p.sku);
 $('compareCount').textContent='('+selected.length+' of 3)';
 $('compareClear').disabled=!selected.length;
 $('compareResults').innerHTML=c.rows.map(({p,state:s})=>'<article class="bf-find-card">'+link(p)+fields(p,s)+'<dl><dt>Date / period</dt><dd>'+safe(p.dateLabel||p.year||'Not verified')+'</dd><dt>Condition</dt><dd>'+safe(p.condition||'Enquire')+'</dd><dt>Physical format</dt><dd>'+safe(p.edition||'Enquire')+'</dd><dt>Catalogue pieces</dt><dd>'+safe(units(p).length)+'</dd></dl>'+button(p)+'</article>').join('');
 $('compareStatus').textContent=c.conflicts.length?'Shared catalogue pieces: '+c.conflicts.map(x=>x.join(' / ')).join('; ')+'. Do not buy both overlapping listings.':selected.length?'Comparisons use catalogue details, not an independent authentication or valuation.':'Select Compare on a shop or gift item to start.';
 for(const b of document.querySelectorAll('[data-compare]')){const on=has(b.dataset.compare);b.setAttribute('aria-pressed',String(on));b.textContent=on?'Remove from comparison':'Compare';}
}
function refresh(){gift();render();}
function toggle(sku){
 if(!products().some(p=>p.sku===sku&&!p.cmsOnly))return;
 if(has(sku))selected=selected.filter(s=>s!==sku);
 else if(selected.length>=3){$('compareStatus').textContent='Three-item limit reached. Remove an item before adding another.';$('compareFinds').open=true;return;}
 else selected.push(sku);
 refresh();
}
window.BURTON_GIFT_COMPARE=Object.freeze({has,refresh,setStock:s=>{stock=s;refresh();}});
document.addEventListener('DOMContentLoaded',()=>{
 $('giftFilter')?.addEventListener('submit',e=>{e.preventDefault();searched=true;gift();});
 $('giftIncludeEnquiry')?.addEventListener('change',gift);
 $('compareClear')?.addEventListener('click',()=>{selected=[];refresh();});
 document.addEventListener('click',e=>{const b=e.target.closest?.('[data-compare]');if(b)toggle(b.dataset.compare);});
 if(location.hash==='#giftFinder')$('giftFinder').open=true;
 window.addEventListener('hashchange',()=>{if(location.hash==='#giftFinder')$('giftFinder').open=true;});
 refresh();
},{once:true});
})();
