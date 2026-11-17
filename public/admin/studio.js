/* Burton & Found Staff Studio / small-screen friendly content editor.
 * Only the authenticated Cloudflare endpoints may mutate content or media.
 */
(()=>{'use strict';
const $=id=>document.getElementById(id), A=window.BURTON_ACCOUNT;
const types={product:'Store product',automobile:'Automobile ad',set:'Curated set',page:'Website text'};
const source={
 product:(window.BURTON_DATA?.inventory||[]).map(x=>({key:x.sku,kind:'product',title:x.title,image:x.image,
   data:{title:x.title,shortDescription:x.shortDescription||'',description:x.description||'',
   collection:x.collection||'collectibles',year:x.year??null,condition:x.condition||'',image:x.image,priceCAD:x.price}})),
 automobile:(window.BURTON_VINTAGE_CARS||[]).map(x=>({key:x.sku,kind:'automobile',title:x.title,image:x.image,
   data:{title:x.title,summary:x.summary||'',description:x.description||'',brand:x.brand||'',
   year:x.year??null,image:x.image,suggestedPriceCAD:x.suggestedPriceCAD}})),
 set:(window.BURTON_VINTAGE_SETS||[]).map(x=>({key:x.sku,kind:'set',title:x.title,image:x.previewImages?.[0]||'',
   data:{title:x.title,description:x.description||'',theme:x.theme||'',componentSkus:x.componentSkus||[],
   suggestedSetPriceCAD:x.suggestedSetPriceCAD}})),
 page:[
  {kind:'page',key:'home',title:'Homepage introduction',data:{headline:'Vintage originals. Collected with care.',body:'Discover original advertising and collectible paper from a more colourful age.'}},
  {kind:'page',key:'vintage',title:'Vintage automobile introduction',data:{headline:'Beautiful machines, beautifully remembered',body:'Explore original artwork from the golden age of motoring.'}},
  {kind:'page',key:'announcement',title:'Store announcement',data:{headline:'News from Burton & Found',body:'Browse the latest additions to our growing collection.'}}
 ]
};
const originals=new Map(Object.values(source).flat().map(x=>[x.kind+':'+x.key,x]));
const entries=new Map();
let actor=null,current=null,busy=false;
const money=n=>new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(Number(n)||0);
const escaping=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const id=(kind,key)=>kind+':'+key;
function message(text,variant=''){const v=$('message');v.textContent=text;v.className='message '+variant;}
function pretty(s){return String(s||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}
async function call(url,opts={}){
 const token=await A?.authToken?.();if(!token)throw Error('Please sign in to your own confirmed Burton & Found account');
 const headers={Authorization:'Bearer '+token,...(opts.headers||{})};
 const res=await fetch(url,{...opts,headers,cache:'no-store'});
 const data=await res.json().catch(()=>({error:'Unexpected response'}));
 if(!res.ok)throw Error(data.error||'Request failed ('+res.status+')');
 return data;
}
function setBusy(on){busy=on;for(const el of document.querySelectorAll('#entryForm button,#teamForm button,#uploadButton'))el.disabled=on;}
function allItems(){
 const list=[...originals.values()].map(x=>({...x}));
 for(const e of entries.values()){
  const ident=id(e.kind,e.key);
  if(!originals.has(ident))list.push({kind:e.kind,key:e.key,title:(e.draft||e.published)?.title||(e.draft||e.published)?.headline||e.key,data:e.draft||e.published||{}});
 }
 return list;
}
function latest(item){return entries.get(id(item.kind,item.key));}
function renderList(){
 const query=$('search').value.toLowerCase().trim(),kind=$('kindFilter').value;
 const items=allItems().filter(x=>(kind==='all'||x.kind===kind)&&(!query||[x.title,x.key,x.kind,(latest(x)?.draft?.title||''),(latest(x)?.draft?.headline||'')].join(' ').toLowerCase().includes(query)));
 items.sort((a,b)=>a.kind.localeCompare(b.kind)||a.key.localeCompare(b.key));
 const root=$('catalogue');root.replaceChildren();
 for(const x of items){
  const e=latest(x),d=e?.draft||x.data||{},p=e?.published||null;
  const button=document.createElement('button');button.type='button';button.className='catalog-item';
  button.dataset.kind=x.kind;button.dataset.key=x.key;
  button.setAttribute('aria-current',String(current?.kind===x.kind&&current?.key===x.key));
  if(x.image||d.image){
   const img=document.createElement('img');img.src=d.image||x.image;img.alt='';img.loading='lazy';button.appendChild(img);
  }
  const details=document.createElement('span');
  const title=document.createElement('strong');title.textContent=d.title||d.headline||x.title||x.key;
  const ref=document.createElement('small');ref.textContent=x.key+' · '+types[x.kind];
  const state=document.createElement('small');state.className='state';
  state.textContent=e?(e.isPublished?(JSON.stringify(e.draft)===JSON.stringify(e.published)?'Published':'Published · draft updated'):'Draft only'):'Original content';
  details.append(title,ref,state);button.appendChild(details);root.appendChild(button);
 }
 if(!items.length){const p=document.createElement('p');p.className='fine';p.style.padding='14px';p.textContent='No matching content. Clear the search or add a new item.';root.appendChild(p)}
 $('countShop').textContent=allItems().filter(x=>x.kind==='product').length;
 $('countAuto').textContent=allItems().filter(x=>x.kind==='automobile').length;
 $('countSets').textContent=allItems().filter(x=>x.kind==='set').length;
 $('countDrafts').textContent=[...entries.values()].filter(x=>!x.isPublished||JSON.stringify(x.draft)!==JSON.stringify(x.published)).length;
}
function visibility(){
 const kind=$('entryKind').value;
 for(const el of document.querySelectorAll('[data-kinds]'))el.hidden=!el.dataset.kinds.split(' ').includes(kind);
 $('entryKind').disabled=!!current?.existing;
 $('entryKey').readOnly=!!current?.existing;
}
function formFields(kind){
 return kind==='product'?['title','shortDescription','description','collection','year','condition','image','priceCAD']
   :kind==='automobile'?['title','summary','description','brand','year','image','suggestedPriceCAD']
   :kind==='set'?['title','description','theme','componentSkus','suggestedSetPriceCAD']
   :['headline','body'];
}
function select(kind,key,create=false){
 const ident=id(kind,key),original=originals.get(ident),entry=entries.get(ident);
 const draft=entry?.draft||original?.data||{};
 current={kind,key,existing:!!original||!!entry,revision:entry?.revision||0};
 $('entryForm').hidden=false;$('editorEmpty').hidden=true;
 $('entryKind').value=kind;$('entryKey').value=key;
 for(const name of formFields(kind)){
  const control=$('entryForm').elements.namedItem(name);
  if(!control)continue;
  const v=draft[name];
  control.value=Array.isArray(v)?v.join(', '):(v===null||v===undefined?'':String(v));
 }
 $('editHeading').textContent=draft.title||draft.headline||original?.title||'New content';
 $('editHelp').textContent=kind==='page'?'Update this page section. Save a draft before publishing.':key+' · '+types[kind]+' · Changes are saved securely.';
 $('entryState').textContent=entry?(entry.isPublished?'Published · revision '+entry.revision:'Draft · revision '+entry.revision):create?'New draft · not saved':'Original · no overrides';
 $('publishEntry').hidden=!['manager','owner'].includes(actor.role)||!entry;
 $('hideEntry').hidden=!['manager','owner'].includes(actor.role)||!entry?.isPublished;
 visibility();renderImage();renderList();
 $('entryForm').scrollIntoView({block:'nearest',behavior:'instant'});
}
function newEntry(){
 const kind=window.prompt('What do you want to add? Enter product, automobile, set or page:', 'product');
 if(kind===null)return;
 const selected=kind.trim().toLowerCase();
 if(!['product','automobile','set'].includes(selected)){message('Choose product, automobile or set. Site text sections are already listed.','error');return}
 const sample=selected==='product'?'CMS-NEW-001':selected==='automobile'?'CMS-VA-001':'CMS-SET-001';
 const key=window.prompt('Enter a unique draft reference / SKU:',sample);
 if(key===null)return;
 const cleaned=key.trim();
 if(!/^[A-Za-z0-9][A-Za-z0-9._-]{1,79}$/.test(cleaned)){message('Use letters, numbers, periods, underscores or hyphens; no spaces.','error');return}
 if(originals.has(id(selected,cleaned))||entries.has(id(selected,cleaned))){message('That reference exists already. Select it in the catalogue instead.','error');return}
 select(selected,cleaned,true);
 $('entryKind').disabled=true;$('entryKey').readOnly=true;
 $('titleField').focus();
}
function getData(){
 const form=$('entryForm'),kind=$('entryKind').value,result={};
 for(const name of formFields(kind)){
  const raw=form.elements.namedItem(name)?.value?.trim()??'';
  if(name==='componentSkus')result[name]=raw.split(/[,\n]/).map(x=>x.trim()).filter(Boolean);
  else if(name==='year')result[name]=raw?Number(raw):null;
  else if(['priceCAD','suggestedPriceCAD','suggestedSetPriceCAD'].includes(name)){if(raw!=='')result[name]=Number(raw)}
  else result[name]=raw;
 }
 return result;
}
function renderImage(){
 const img=$('imagePreview'),url=$('imageUrl').value.trim();
 if(!url){img.hidden=true;img.removeAttribute('src');$('imagePlaceholder').hidden=false;return}
 img.hidden=false;img.src=url;img.onerror=()=>{img.hidden=true;$('imagePlaceholder').hidden=false};
 $('imagePlaceholder').hidden=true;
}
async function refresh(){
 const info=await call('/api/cms/studio');
 actor=info.actor;entries.clear();
 for(const entry of info.entries||[])entries.set(id(entry.kind,entry.key),entry);
 $('roleBadge').textContent=pretty(actor.role)+' access';
 $('editorEmail').textContent=actor.email||'';
 $('loginPanel').hidden=true;$('studio').hidden=false;
 $('teamPanel').hidden=actor.role!=='owner';
 $('teamSummary').textContent=actor.role==='owner'?(info.members?.length||0)+' delegated account(s) registered.':'';
 renderList();
 if(current&&allItems().some(x=>x.kind===current.kind&&x.key===current.key))select(current.kind,current.key);
 message('Studio ready · '+pretty(actor.role)+' access · Published changes appear on the site shortly.','ok');
}
async function saveDraft(evt){
 evt.preventDefault();if(!current||busy)return;
 try{
  setBusy(true);
  const kind=$('entryKind').value,key=$('entryKey').value.trim(),data=getData();
  const r=await call('/api/cms/manage',{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({action:'save',kind,key,data,revision:current.revision})});
  entries.set(id(kind,key),r.entry);current={kind,key,existing:true,revision:r.entry.revision};
  renderList();select(kind,key);message(r.notice,'ok');
 }catch(e){message(e.message,'error')}finally{setBusy(false)}
}
async function publish(action){
 if(!current||busy)return;
 const kind=current.kind,key=current.key,entry=entries.get(id(kind,key));
 if(!entry){message('Save the draft first.','error');return}
 const changed=JSON.stringify(entry.draft)!==JSON.stringify(getData())&&action==='publish';
 if(changed){message('Save your latest changes as a draft before publishing.','error');return}
 if(action==='unpublish'&&!confirm('Remove this published override from the storefront? The source item remains in the original catalogue.'))return;
 if(kind==='product'&&action==='publish'&&entry.draft?.priceCAD){
  if(!confirm('Publish this content and, for any existing sale SKU, align its authoritative CAD checkout price? No payments will be activated.'))return;
 }
 try{
  setBusy(true);
  const r=await call('/api/cms/manage',{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({action,kind,key,revision:current.revision})});
  entries.set(id(kind,key),r.entry);current.revision=r.entry.revision;
  renderList();select(kind,key);message(r.notice,'ok');
 }catch(e){message(e.message,'error')}finally{setBusy(false)}
}
async function upload(){
 if(busy)return;const file=$('photoUpload').files?.[0];
 if(!file){message('Choose a photograph first.','error');return}
 if(file.size>5242880||file.size<100||!['image/jpeg','image/png','image/webp'].includes(file.type)){
  message('Use an actual JPG, PNG or WebP image under 5 MB.','error');return;
 }
 try{
  setBusy(true);message('Uploading photograph securely…');
  const r=await call('/api/cms/media',{method:'POST',headers:{'content-type':file.type},body:file});
  $('imageUrl').value=r.url;renderImage();message('Image uploaded. Save the item draft and publish to display it on the website.','ok');
 }catch(e){message(e.message,'error')}finally{setBusy(false)}
}
async function team(action){
 const form=$('teamForm'),email=form.elements.namedItem('email').value.trim().toLowerCase(),role=form.elements.namedItem('role').value;
 if(!email){message('Enter your colleague’s verified email address.','error');return}
 if(action==='revoke'&&!confirm('Revoke studio access for '+email+'?'))return;
 try{
  setBusy(true);const r=await call('/api/cms/team',{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({action,email,role})});
  message(r.notice,'ok');form.reset();await refresh();
 }catch(e){message(e.message,'error')}finally{setBusy(false)}
}
function theme(){
 let value='light';try{value=localStorage.getItem('burton_found_theme')==='dark'?'dark':'light'}catch{}
 const apply=v=>{document.documentElement.dataset.theme=v;$('themeToggle').textContent=v==='dark'?'Light mode':'Dark mode';$('themeToggle').setAttribute('aria-pressed',String(v==='dark'))};
 apply(value);
 $('themeToggle').addEventListener('click',()=>{value=value==='dark'?'light':'dark';apply(value);try{localStorage.setItem('burton_found_theme',value)}catch{}});
}
async function init(){
 theme();
 $('search').addEventListener('input',renderList);
 $('kindFilter').addEventListener('change',renderList);
 $('catalogue').addEventListener('click',e=>{const btn=e.target.closest('button[data-key]');if(btn)select(btn.dataset.kind,btn.dataset.key)});
 $('newEntry').addEventListener('click',newEntry);
 $('entryKind').addEventListener('change',visibility);
 $('imageUrl').addEventListener('input',renderImage);
 $('entryForm').addEventListener('submit',saveDraft);
 $('publishEntry').addEventListener('click',()=>publish('publish'));
 $('hideEntry').addEventListener('click',()=>publish('unpublish'));
 $('refreshEntry').addEventListener('click',()=>{if(current)select(current.kind,current.key)});
 $('uploadButton').addEventListener('click',upload);
 $('teamForm').addEventListener('submit',e=>{e.preventDefault();team('grant')});
 $('revokeMember').addEventListener('click',()=>team('revoke'));
 try{await A.ready();await refresh()}
 catch(e){message('Studio access locked: '+e.message,'error');$('loginPanel').hidden=false;$('studio').hidden=true;
  $('roleBadge').textContent='Access required';}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
