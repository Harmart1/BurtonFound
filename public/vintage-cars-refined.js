/* Gallery progressive disclosure, full-image dialog and responsive display. */
(()=>{'use strict';
const items=window.BURTON_VINTAGE_CARS||[],root=document.getElementById('cards');
const search=document.getElementById('search'),brand=document.getElementById('brand'),dups=document.getElementById('duplicates'),sort=document.getElementById('sort');
const showMore=document.getElementById('showMore'),result=document.getElementById('result'),dialog=document.getElementById('imageDialog');
const viewButton=document.getElementById('viewComfort'),compactButton=document.getElementById('viewCompact');
const map=new Map(items.map(x=>[x.sku,x]));
let shown=24,compact=false,dialogIndex=0,visibleItems=[];
const title=(x)=>x.title||'Untitled advertising page';
function filterData(){
  const q=search.value.toLowerCase().trim(),b=brand.value,d=dups.value,seen=new Set();
  const list=items.filter(x=>{
    if(q&&!((x.title||'')+' '+(x.brand||'')+' '+(x.year||'')+' '+x.sku).toLowerCase().includes(q))return false;
    if(b&&x.brand!==b)return false;
    if(d==='flagged'&&!x.duplicateGroup)return false;
    if(d==='unique'&&x.duplicateGroup){if(seen.has(x.duplicateGroup))return false;seen.add(x.duplicateGroup);}
    return true;
  });
  if(sort.value==='make')list.sort((a,b)=>a.brand.localeCompare(b.brand)||a.sku.localeCompare(b.sku));
  else if(sort.value==='oldest')list.sort((a,b)=>(a.year??9999)-(b.year??9999)||a.sku.localeCompare(b.sku));
  else if(sort.value==='newest')list.sort((a,b)=>(b.year??0)-(a.year??0)||a.sku.localeCompare(b.sku));
  return list;
}
function update(){
  visibleItems=filterData();
  const nodes=visibleItems.slice(0,shown);
  root.classList.toggle('compact-view',compact);
  root.replaceChildren();
  for(const x of nodes){
    const card=document.createElement('article');card.className='card';card.dataset.sku=x.sku;
    const img=document.createElement('img');img.src=x.image;img.alt='Photograph of '+title(x);img.loading='lazy';img.decoding='async';
    card.appendChild(img);
    const body=document.createElement('div');body.className='card-body';
    const meta=document.createElement('p');meta.className='small';meta.textContent=x.sku+' · '+x.brand+(x.year?' · '+x.year:'');
    const heading=document.createElement('h2');heading.textContent=title(x);
    body.append(meta,heading);
    if(x.duplicateGroup){const flag=document.createElement('p');flag.className='flag';flag.textContent='Possible repeat scan · '+x.duplicateGroup;body.appendChild(flag)}
    const button=document.createElement('button');button.type='button';button.className='gallery-view-button';button.dataset.sku=x.sku;button.textContent='View full photograph ↗';button.setAttribute('aria-label','Enlarge photograph of '+title(x));body.appendChild(button);
    const notSale=document.createElement('p');notSale.className='small';notSale.textContent='Preview only · Not for sale';body.appendChild(notSale);
    card.appendChild(body);root.appendChild(card);
  }
  if(!visibleItems.length){const empty=document.createElement('p');empty.textContent='No pages match those filters. Try a different search or clear the filters.';root.appendChild(empty)}
  const n=Math.min(shown,visibleItems.length);
  result.textContent=n===visibleItems.length?n+' scanned page'+(n===1?'':'s')+' displayed':n+' of '+visibleItems.length+' scanned pages shown';
  showMore.hidden=n>=visibleItems.length;
  showMore.textContent='Show '+Math.min(24,visibleItems.length-n)+' more pages';
}
for(const input of [search,brand,dups,sort])input.addEventListener(input===search?'input':'change',()=>{shown=24;update()});
document.getElementById('clearFilters').addEventListener('click',()=>{search.value='';brand.value='';dups.value='all';sort.value='catalogue';shown=24;update();search.focus()});
showMore.addEventListener('click',()=>{shown+=24;update()});
viewButton.addEventListener('click',()=>{compact=false;viewButton.setAttribute('aria-pressed','true');compactButton.setAttribute('aria-pressed','false');update()});
compactButton.addEventListener('click',()=>{compact=true;viewButton.setAttribute('aria-pressed','false');compactButton.setAttribute('aria-pressed','true');update()});
function updateDialog(){
  const item=visibleItems[dialogIndex];if(!item)return;
  const image=document.getElementById('dialogImage');image.src=item.image;image.alt='Full photograph of '+title(item);
  document.getElementById('dialogTitle').textContent=title(item);
  document.getElementById('dialogInfo').textContent=item.sku+' · '+item.brand+(item.year?' · '+item.year:'')+(item.duplicateGroup?' · Possible repeat: '+item.duplicateGroup:'');
  document.getElementById('prevImage').disabled=dialogIndex===0;
  document.getElementById('nextImage').disabled=dialogIndex===visibleItems.length-1;
}
root.addEventListener('click',e=>{const button=e.target.closest('.gallery-view-button');if(!button)return;const idx=visibleItems.findIndex(x=>x.sku===button.dataset.sku);if(idx<0)return;dialogIndex=idx;updateDialog();if(dialog.showModal)dialog.showModal()});
document.getElementById('closeDialog').addEventListener('click',()=>dialog.close());
document.getElementById('prevImage').addEventListener('click',()=>{if(dialogIndex>0){dialogIndex--;updateDialog()}});
document.getElementById('nextImage').addEventListener('click',()=>{if(dialogIndex<visibleItems.length-1){dialogIndex++;updateDialog()}});
dialog.addEventListener('keydown',e=>{if(e.key==='ArrowRight'&&dialogIndex<visibleItems.length-1){e.preventDefault();dialogIndex++;updateDialog()}else if(e.key==='ArrowLeft'&&dialogIndex>0){e.preventDefault();dialogIndex--;updateDialog()}});
dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
update();
})();
