/* Gallery progressive disclosure, full-image dialog and responsive display. */
(()=>{'use strict';
const items=window.BURTON_VINTAGE_CARS||[],root=document.getElementById('cards');
const proposedSets=Array.isArray(window.BURTON_VINTAGE_SETS)?window.BURTON_VINTAGE_SETS:[];
const search=document.getElementById('search'),brand=document.getElementById('brand'),era=document.getElementById('era'),sort=document.getElementById('sort');
const showMore=document.getElementById('showMore'),result=document.getElementById('result'),dialog=document.getElementById('imageDialog');
const viewButton=document.getElementById('viewComfort'),compactButton=document.getElementById('viewCompact');
const map=new Map(items.map(x=>[x.sku,x]));
let shown=24,compact=false,dialogIndex=0,visibleItems=[],showOriginal=false;
let activeSet=null;
const cad=n=>new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(n);
const themeButton=document.getElementById('themeToggle');
function applyTheme(theme){
 const dark=theme==='dark';
 document.documentElement.dataset.theme=dark?'dark':'light';
 themeButton.textContent=dark?'Light mode':'Dark mode';
 themeButton.setAttribute('aria-pressed',String(dark));
 themeButton.setAttribute('aria-label','Switch to '+(dark?'light':'dark')+' mode');
}
let initialTheme='light';
try{if(localStorage.getItem('burton_found_theme')==='dark')initialTheme='dark'}catch{}
applyTheme(initialTheme);
themeButton.addEventListener('click',()=>{
 const next=document.documentElement.dataset.theme==='dark'?'light':'dark';
 applyTheme(next);
 try{localStorage.setItem('burton_found_theme',next)}catch{}
});
for(const make of [...new Set(items.map(x=>x.brand).filter(Boolean))].sort((a,b)=>a.localeCompare(b))){
 const option=document.createElement('option');option.value=make;option.textContent=make;brand.appendChild(option);
}

const title=(x)=>x.title||'Untitled advertising page';

function makeElement(tag,className,content){
 const node=document.createElement(tag);
 if(className)node.className=className;
 if(content!==undefined)node.textContent=content;
 return node;
}
function renderCuratedSets(){
 const grid=document.getElementById('bundleGrid');if(!grid)return;
 grid.replaceChildren();
 const lookup=new Map(items.map(x=>[x.sku,x]));
 for(const [setIndex,set] of proposedSets.entries()){
  if(!Array.isArray(set.componentSkus)||set.salesEnabled!==false)continue;
  const components=set.componentSkus.map(sku=>lookup.get(sku)).filter(Boolean);
  if(components.length!==set.componentCount)continue;
  const card=makeElement('article','archive-bundle-card');
  if(setIndex>=6){card.hidden=true;card.dataset.collapsed='true';}
  const gallery=makeElement('div','archive-bundle-photos');
  for(const [index,item] of components.entries()){
   const img=document.createElement('img');
   img.src=item.image;img.alt='Page '+(index+1)+': '+item.title;
   img.loading='lazy';img.decoding='async';
   gallery.appendChild(img);
  }
  const copy=makeElement('div','archive-bundle-content');
  copy.appendChild(makeElement('p','archive-bundle-kicker',set.theme+' · '+set.componentCount+' pages'));
  copy.appendChild(makeElement('h3','archive-bundle-title',set.title));
  copy.appendChild(makeElement('p','archive-bundle-description',set.description));
  const list=makeElement('ul','archive-bundle-includes');
  for(const item of components){
   const li=makeElement('li','',item.sku+' · '+item.brand+' · '+item.title);
   list.appendChild(li);
  }
  copy.appendChild(list);
  const price=makeElement('div','archive-bundle-price');
  const label=makeElement('div','');
  label.appendChild(makeElement('span','archive-bundle-label','Suggested set asking price'));
  label.appendChild(makeElement('strong','',cad(set.suggestedSetPriceCAD)));
  price.appendChild(label);
  const total=makeElement('p','',cad(set.individualSuggestedTotalCAD)+' separately · Potential saving '+cad(set.potentialSavingsCAD));
  price.appendChild(total);
  copy.appendChild(price);
  const action=makeElement('button','archive-bundle-view','View '+set.componentCount+' page previews ↗');
  action.type='button';action.dataset.setSku=set.sku;
  action.setAttribute('aria-label','View pages in proposed set '+set.title);
  copy.appendChild(action);
  copy.appendChild(makeElement('p','archive-bundle-review','Proposed grouping · not available for purchase'));
  card.append(gallery,copy);grid.appendChild(card);
 }
 const expand=document.getElementById('showAllSets');
 if(expand){expand.hidden=proposedSets.length<=6;if(expand.dataset.bound!=='true'){expand.dataset.bound='true';expand.addEventListener('click',()=>{const open=expand.getAttribute('aria-expanded')==='true';for(const card of grid.querySelectorAll('[data-collapsed]'))card.hidden=open;expand.setAttribute('aria-expanded',String(!open));expand.textContent=open?'Show all '+proposedSets.length+' curated set ideas':'Show fewer curated sets';if(open)grid.scrollIntoView({block:'start',behavior:'instant'});});}}
 if(grid.dataset.bound!=='true'){grid.dataset.bound='true';grid.addEventListener('click',event=>{
  const button=event.target.closest('button[data-set-sku]');
  if(!button)return;
  const set=proposedSets.find(x=>x.sku===button.dataset.setSku);
  if(!set)return;
  activeSet=set;
  search.value='';brand.value='';era.value='all';sort.value='catalogue';
  shown=24;update();
  document.getElementById('gallery').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
 });}
}

function filterData(){
  const q=search.value.toLowerCase().trim(),b=brand.value,period=era.value;
  const list=items.filter(x=>{
    if(activeSet&&!activeSet.componentSkus.includes(x.sku))return false;
    if(q&&!((x.title||'')+' '+(x.brand||'')+' '+(x.year||'')+' '+x.sku).toLowerCase().includes(q))return false;
    if(b&&x.brand!==b)return false;
    if(period==='prewar'&&!(Number.isInteger(x.year)&&x.year<=1945))return false;
    if(period==='postwar'&&!(Number.isInteger(x.year)&&x.year>1945))return false;
    if(period==='undated'&&x.year!==null)return false;
    return true;
  });
  if(sort.value==='make')list.sort((a,b)=>a.brand.localeCompare(b.brand)||a.sku.localeCompare(b.sku));
  else if(sort.value==='oldest')list.sort((a,b)=>(a.year??9999)-(b.year??9999)||a.sku.localeCompare(b.sku));
  else if(sort.value==='newest')list.sort((a,b)=>(b.year??0)-(a.year??0)||a.sku.localeCompare(b.sku));
  else if(sort.value==='lowprice')list.sort((a,b)=>a.suggestedPriceCAD-b.suggestedPriceCAD||a.sku.localeCompare(b.sku));
  else if(sort.value==='highprice')list.sort((a,b)=>b.suggestedPriceCAD-a.suggestedPriceCAD||a.sku.localeCompare(b.sku));
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
    const description=makeElement('p','archive-page-description',x.summary||x.description);
    body.appendChild(description);
    const price=makeElement('div','archive-page-price');
    price.appendChild(makeElement('span','archive-price-label','Suggested asking price · CAD'));
    price.appendChild(makeElement('strong','',cad(x.suggestedPriceCAD)));
    body.appendChild(price);
    const details=makeElement('details','archive-page-details');
    const detailsLabel=makeElement('summary','','More about this page');
    const detailsCopy=makeElement('p','',x.description||'Full print details are being checked');
    const condition=makeElement('p','archive-page-condition','Physical print, dimensions and paper condition not yet verified.');
    details.append(detailsLabel,detailsCopy,condition);body.appendChild(details);

    const button=document.createElement('button');button.type='button';button.className='gallery-view-button';button.dataset.sku=x.sku;button.textContent='View full photograph ↗';button.setAttribute('aria-label','Enlarge photograph of '+title(x));body.appendChild(button);
    const notSale=document.createElement('p');notSale.className='small';notSale.textContent='Proposed CAD value only · Not for sale';body.appendChild(notSale);
    card.appendChild(body);root.appendChild(card);
  }
  if(!visibleItems.length){const empty=document.createElement('p');empty.textContent='No pages match those filters. Try a different search or clear the filters.';root.appendChild(empty)}
  const n=Math.min(shown,visibleItems.length);
  const chosen=document.getElementById('activeSetNote');
  chosen.hidden=!activeSet;
  chosen.textContent=activeSet?'Viewing proposed set: '+activeSet.title+'. Suggested set price '+cad(activeSet.suggestedSetPriceCAD)+'. Clear filters to return to all 80 distinct pictured designs.':'';
  result.textContent=n===visibleItems.length?n+' scanned page'+(n===1?'':'s')+' displayed':n+' of '+visibleItems.length+' scanned pages shown';
  showMore.hidden=n>=visibleItems.length;
  showMore.textContent='Show '+Math.min(24,visibleItems.length-n)+' more pages';
}
for(const input of [search,brand,era,sort])input.addEventListener(input===search?'input':'change',()=>{if(input!==sort)activeSet=null;shown=24;update()});
document.getElementById('clearFilters').addEventListener('click',()=>{activeSet=null;search.value='';brand.value='';era.value='all';sort.value='catalogue';shown=24;update();search.focus()});
showMore.addEventListener('click',()=>{shown+=24;update()});
viewButton.addEventListener('click',()=>{compact=false;viewButton.setAttribute('aria-pressed','true');compactButton.setAttribute('aria-pressed','false');update()});
compactButton.addEventListener('click',()=>{compact=true;viewButton.setAttribute('aria-pressed','false');compactButton.setAttribute('aria-pressed','true');update()});
function updateDialog(){
  const item=visibleItems[dialogIndex];if(!item)return;
  const image=document.getElementById('dialogImage');image.src=showOriginal?(item.originalImage||item.image):item.image;image.alt=(showOriginal?'Unmodified source scan of ':'Enhanced display photograph of ')+title(item);
  const sourceToggle=document.getElementById('toggleOriginal');sourceToggle.setAttribute('aria-pressed',String(showOriginal));sourceToggle.textContent=showOriginal?'Return to enhanced display':'View original scan';
  document.getElementById('dialogTitle').textContent=title(item);
  document.getElementById('dialogInfo').textContent=item.sku+' · '+item.brand+(item.year?' · '+item.year:'')+' · Suggested CAD '+cad(item.suggestedPriceCAD)+' · Not for sale'+(item.duplicateGroup?' · Possible repeat: '+item.duplicateGroup:'');
  document.getElementById('prevImage').disabled=dialogIndex===0;
  document.getElementById('nextImage').disabled=dialogIndex===visibleItems.length-1;
}
root.addEventListener('click',e=>{const button=e.target.closest('.gallery-view-button');if(!button)return;const idx=visibleItems.findIndex(x=>x.sku===button.dataset.sku);if(idx<0)return;dialogIndex=idx;showOriginal=false;updateDialog();if(dialog.showModal)dialog.showModal()});
document.getElementById('closeDialog').addEventListener('click',()=>dialog.close());
document.getElementById('toggleOriginal').addEventListener('click',()=>{showOriginal=!showOriginal;updateDialog()});
document.getElementById('prevImage').addEventListener('click',()=>{if(dialogIndex>0){dialogIndex--;updateDialog()}});
document.getElementById('nextImage').addEventListener('click',()=>{if(dialogIndex<visibleItems.length-1){dialogIndex++;updateDialog()}});
dialog.addEventListener('keydown',e=>{if(e.key==='ArrowRight'&&dialogIndex<visibleItems.length-1){e.preventDefault();dialogIndex++;updateDialog()}else if(e.key==='ArrowLeft'&&dialogIndex>0){e.preventDefault();dialogIndex--;updateDialog()}});
dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});

/* Live published content from the private CMS. The service returns vetted copy only.
   All automobile scans and all curated sets remain non-purchasable. */
async function refreshPublishedEditorial(){
 try{
  const res=await fetch('/api/cms/published',{cache:'no-store'});if(!res.ok)return;
  const packet=await res.json();if(!Array.isArray(packet.entries))return;
  for(const entry of packet.entries){
   const d=entry.data||{};
   if(entry.kind==='automobile'){
    let item=items.find(x=>x.sku===entry.key);
    if(!item){item={sku:entry.key,duplicateGroup:null,condition:'Not physically examined',physicalItemVerified:false,salesEnabled:false,originalImage:d.image||'',legacyScanAliases:[]};items.push(item)}
    for(const name of ['title','summary','description','brand','image','year','suggestedPriceCAD'])if(Object.hasOwn(d,name))item[name]=d[name];
    item.salesEnabled=false;item.physicalItemVerified=false;
   }else if(entry.kind==='set'){
    let set=proposedSets.find(x=>x.sku===entry.key);
    if(!set){set={sku:entry.key,salesEnabled:false,physicalItemsVerified:false};proposedSets.push(set)}
    for(const name of ['title','description','theme','componentSkus','suggestedSetPriceCAD'])if(Object.hasOwn(d,name))set[name]=d[name];
    const components=(set.componentSkus||[]).map(sku=>items.find(x=>x.sku===sku)).filter(Boolean);
    if(components.length<2||components.length!==(set.componentSkus||[]).length){set.componentSkus=[];continue}
    const totalValue=Math.round(components.reduce((n,x)=>n+(Number(x.suggestedPriceCAD)||0),0)*100)/100;
    if(Number(set.suggestedSetPriceCAD)>=totalValue||Number(set.suggestedSetPriceCAD)<1){set.componentSkus=[];continue}
    set.componentCount=components.length;set.previewImages=components.map(x=>x.image);
    set.individualSuggestedTotalCAD=Math.round(components.reduce((n,x)=>n+(Number(x.suggestedPriceCAD)||0),0)*100)/100;
    set.potentialSavingsCAD=Math.round((set.individualSuggestedTotalCAD-set.suggestedSetPriceCAD)*100)/100;
    set.salesEnabled=false;set.physicalItemsVerified=false;
   }else if(entry.kind==='page'&&entry.key==='vintage'){
    const heading=document.querySelector('.archive-masthead-copy h1'),intro=document.querySelector('.archive-lede');
    if(heading&&d.headline)heading.textContent=d.headline;
    if(intro&&d.body)intro.textContent=d.body;
   }else if(entry.kind==='page'&&entry.key==='announcement'){
    let note=document.getElementById('cmsVintageNotice');
    if(!note){note=document.createElement('div');note.id='cmsVintageNotice';note.className='archive-active-set';document.querySelector('main')?.prepend(note)}
    note.textContent=(d.headline||'Store news')+' · '+(d.body||'');
   }
  }
  brand.replaceChildren();
  const empty=document.createElement('option');empty.value='';empty.textContent='All makes';brand.appendChild(empty);
  for(const make of [...new Set(items.map(x=>x.brand).filter(Boolean))].sort((a,b)=>a.localeCompare(b))){
   const option=document.createElement('option');option.value=make;option.textContent=make;brand.appendChild(option);
  }
  renderCuratedSets();update();
 }catch(e){console.info('Published catalogue adjustments are temporarily unavailable.')}
}

renderCuratedSets();
update();
refreshPublishedEditorial();
})();
