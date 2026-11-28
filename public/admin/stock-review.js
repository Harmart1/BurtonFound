/* Owner review only. No inventory, payment, or configuration writes. */
(()=>{
'use strict';
const validSku=s=>typeof s==='string'&&/^[A-Z0-9-]{2,24}$/.test(s);
function candidates(products,snapshot,limit=8){
 if(!Array.isArray(products)||snapshot?.configured!==true||!Array.isArray(snapshot.items)||!snapshot.items.length)throw Error('Current stock could not be checked.');
 const db=new Map(),seen=new Set(),units=new Set(),out=[];
 for(const r of snapshot.items){
  if(!validSku(r?.sku)||db.has(r.sku)||!Number.isSafeInteger(r.price_cents)||r.price_cents<=0||typeof r.available!=='boolean')throw Error('Invalid stock response; review stopped.');
  db.set(r.sku,r);
 }
 for(const p of products){if(!validSku(p?.sku)||seen.has(p.sku))throw Error('Invalid catalogue; review stopped.');seen.add(p.sku);}
 const sorted=products.slice().sort((a,b)=>a.sku.localeCompare(b.sku));
 for(const collection of ['coca-cola','hollywood']){
  let n=0;
  for(const p of sorted){
   if(n>=limit)break;
   const r=db.get(p.sku),ids=p.catalogIds;
   if(p.collection!==collection||p.type!=='original'||p.cmsOnly||p.requiresVerification===true||p.availableForCheckout===false||['unavailable','verification_required'].includes(p.stockState)||!Number.isFinite(p.price)||r?.available!==true||r.price_cents!==Math.round(p.price*100)||!Array.isArray(ids)||ids.length!==1||typeof ids[0]!=='string'||!ids[0]||units.has(ids[0]))continue;
   units.add(ids[0]);n++;
   out.push({sku:p.sku,title:String(p.title||p.sku),collection,unit:ids[0],price_cents:r.price_cents,image:typeof p.image==='string'&&/^\/?assets\/[A-Za-z0-9_./-]+$/.test(p.image)&&!p.image.includes('..')?'/'+p.image.replace(/^\//,''):null});
  }
 }
 return out;
}
const measure=v=>{const s=String(v??'').trim();if(!/^\d{1,4}(\.\d{1,3})?$/.test(s))return null;const n=Number(s);return n>0&&n<=1000?n:null;};
function review(rows,input,checkedAt,now=new Date()){
 const result=[];
 for(const r of rows){
  const v=input[r.sku];if(!v||v.located!==true||v.condition!==true||v.unit!==true||v.approved!==true)continue;
  const dims=['kg','length','width','height'].map(k=>measure(v[k]));if(dims.some(x=>x===null))continue;
  result.push({sku:r.sku,physical_unit:r.unit,price_cents:r.price_cents,owner_reports:{located:true,condition_matches:true,unit_confirmed:true,approved_candidate:true},packed:{kg:dims[0],length_cm:dims[1],width_cm:dims[2],height_cm:dims[3]},notes:String(v.notes||'').slice(0,500)});
 }
 return {schema:'burton-found-stock-review-v1',scope:'CA',stock_snapshot_checked_at:checkedAt,review_exported_at:now.toISOString(),planning_only:true,requires_independent_recheck:true,reviewed_candidates:result};
}
window.BURTON_STOCK_REVIEW=Object.freeze({candidates,review,measure});
const $=id=>document.getElementById(id),root=$('stockReviewRows'),A=window.BURTON_ACCOUNT;
if(!root||!A)return;
const load=$('stockReviewLoad'),download=$('stockReviewDownload'),status=$('stockReviewStatus');
let rows=[],input=Object.create(null),checkedAt=null,seq=0,owner=null;
function reset(){seq++;rows=[];input=Object.create(null);checkedAt=null;owner=null;root.replaceChildren();download.disabled=true;load.disabled=false;status.textContent='Load the current database candidates to begin. Review notes are not saved.';}
function current(){return owner&&owner.id===A.user()?.id&&owner.version===A.sessionVersion()&&A.recoveryState()==='none'&&!$('dashboard').hidden;}
function update(){const n=review(rows,input,checkedAt).reviewed_candidates.length;download.disabled=!current()||n===0;status.textContent=n+' of '+rows.length+' candidates fully reviewed. Download notes for further verification; no settings changed.';}
const node=(tag,t)=>{const x=document.createElement(tag);if(t)x.textContent=t;return x;};
function render(){
 root.replaceChildren();
 for(const r of rows){
  const v=input[r.sku]={},card=node('article');card.className='stock-review-card';
  const header=node('div');header.className='stock-review-heading';
  if(r.image){const img=node('img');img.src=r.image;img.alt='Catalogue photo for '+r.title;img.loading='lazy';img.width=90;img.height=110;header.append(img);}
  const info=node('div');info.append(node('h3',r.title),node('p',r.sku+' · '+new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(r.price_cents/100)+' CAD · unit '+r.unit));header.append(info);card.append(header);
  for(const [key,label] of [['located','I located this exact physical original'],['condition','Condition matches the listing'],['unit','Quantity and physical unit confirmed'],['approved','I approve this as a proposed Canadian sale candidate']]){
   const l=node('label');l.className='wizard-tick';const box=node('input');box.type='checkbox';box.dataset.field=key;box.addEventListener('change',()=>{v[key]=box.checked;update();});l.append(box,document.createTextNode(label));card.append(l);
  }
  const grid=node('div');grid.className='stock-review-measures';
  for(const [key,label] of [['kg','Packed kg'],['length','Length cm'],['width','Width cm'],['height','Height cm']]){
   const l=node('label',label),x=node('input');x.type='number';x.min='0.001';x.max='1000';x.step='0.001';x.inputMode='decimal';x.dataset.field=key;x.addEventListener('input',()=>{v[key]=x.value;update();});l.append(x);grid.append(l);
  }
  card.append(grid);const label=node('label','Inspection notes (optional)'),note=node('textarea');note.maxLength=500;note.rows=2;note.addEventListener('input',()=>{v.notes=note.value;});label.append(note);card.append(label);root.append(card);
 }
 update();
}
load.addEventListener('click',async()=>{
 if(rows.length&&!window.confirm('Reload candidates and discard current unsaved review notes?'))return;
 reset();const tokenSeq=seq;load.disabled=true;status.textContent='Checking current stock and owner access…';
 try{
  owner={id:A.user()?.id,version:A.sessionVersion()};if(!current())throw Error('Approved owner sign-in required.');
  const t=await A.authToken();if(!t||!current()||tokenSeq!==seq)throw Error('Owner session changed.');
  const auth=await fetch('/api/admin/me',{headers:{Authorization:'Bearer '+t},cache:'no-store'});if(!auth.ok||(await auth.json()).admin!==true)throw Error('Owner access could not be verified.');
  if(!current()||tokenSeq!==seq)return;
  const r=await fetch('/api/catalog',{cache:'no-store'});if(!r.ok)throw Error('Current stock unavailable.');
  const data=await r.json();if(!current()||tokenSeq!==seq)return;
  rows=candidates(window.BURTON_DATA?.inventory,data,$('stockReviewScope').value==='all'?500:8);checkedAt=new Date().toISOString();render();
 }catch(e){if(tokenSeq===seq){reset();status.textContent=e.message;}}finally{if(tokenSeq===seq)load.disabled=false;}
});
download.addEventListener('click',()=>{
 if(!current())return reset();
 const data=review(rows,input,checkedAt);if(!data.reviewed_candidates.length)return;
 const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'}));const a=node('a');a.href=url;a.download='burton-found-owner-stock-review.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 status.textContent=data.reviewed_candidates.length+' reviewed candidates exported. Send the file for rechecking. No stock or payment settings changed.';
});
document.addEventListener('bf:auth-change',reset);document.addEventListener('bf:recovery-state',reset);
})();
