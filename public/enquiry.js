/* Local draft only: no fetch, persistence, payment, reservation or implied delivery. */
(()=>{
'use strict';
const topics=Object.freeze({availability:'Current availability and purchasing arrangements',condition:'Condition, dimensions and further photographs',shipping:'Packaging, delivery estimates, shipping charges and applicable taxes',date:'Printing date, source and provenance details',other:'Other catalogue question'});
const tidy=(v,max)=>String(v??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const currency=n=>new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(n);
function compose(selection,requested,note){
 const rows=[],seen=new Set();let total=0;
 for(const p of (Array.isArray(selection)?selection:[]).slice(0,60)){
  if(!p||typeof p.sku!=='string'||!/^[A-Z0-9-]{2,45}$/.test(p.sku)||seen.has(p.sku)||!Number.isFinite(p.price)||p.price<=0||p.cmsOnly)continue;
  seen.add(p.sku);total+=Math.round(p.price*100);
  const unverified=p.requiresVerification===true||p.availableForCheckout===false||p.stockState==='verification_required';
  rows.push(p.sku+' — '+tidy(p.title,180)+' — '+currency(p.price)+' CAD asking price'+(unverified?' (enquiry only; physical inventory unverified)':''));
 }
 const questions=[...new Set(Array.isArray(requested)?requested:[])].filter(k=>Object.hasOwn(topics,k)).map(k=>'- '+topics[k]);
 return ['Hello Burton & Found,','',rows.length?'I am interested in the following catalogue listings:':'I have a question about your catalogue.',...rows, ...(rows.length?['','Listed asking-price subtotal: '+currency(total/100)+' CAD before shipping and applicable taxes.']:[]),'','Please confirm:',...(questions.length?questions:['- Current availability and next steps']),...(tidy(note,600)?['','Additional question: '+tidy(note,600)]:[]),'','This is an enquiry only, not an order or reservation. No payment is authorized.','Thank you.'].join('\n');
}
const validEmail=v=>typeof v==='string'&&v.length<=254&&/^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(v);
function open(selection,email){
 const dialog=document.getElementById('infoDialog'),root=document.getElementById('infoContent');if(!dialog||!root)return;
 root.innerHTML='<div class="bf-enquiry"><p class="eyebrow small">BURTON &amp; FOUND</p><h2>Prepare a product enquiry</h2><p id="enquiryDelivery"></p><form id="enquiryForm"><fieldset><legend>What would you like to know?</legend></fieldset><label for="enquiryNote">Additional question (optional)</label><textarea id="enquiryNote" rows="3" maxlength="600" placeholder="For example, what are the dimensions?"></textarea><p class="bf-enquiry-fine">Please do not enter payment details, passwords or sensitive information. Nothing is sent or stored by this form.</p><label for="enquiryDraft">Your enquiry draft</label><textarea id="enquiryDraft" rows="9" readonly></textarea><div class="bf-enquiry-actions"><button type="button" id="enquiryCopy">Copy draft</button><button type="button" id="enquiryDownload">Download draft</button><button type="button" id="enquiryEmail" hidden>Open email draft</button></div><p id="enquiryStatus" role="status" aria-live="polite"></p></form></div>';
 const $=id=>document.getElementById(id),form=$('enquiryForm'),field=form.querySelector('fieldset'),canEmail=validEmail(email);
 for(const [key,value] of Object.entries(topics)){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.value=key;input.checked=key==='availability';label.append(input,document.createTextNode(' '+value));field.append(label);}
 $('enquiryDelivery').textContent=canEmail?'Prepare a draft for '+email+' and open your email app. You must send it yourself.':'Direct enquiry delivery is not configured yet. Copy or download your draft for later; the store has not received anything.';
 $('enquiryEmail').hidden=!canEmail;
 const refresh=()=>$('enquiryDraft').value=compose(selection,[...field.querySelectorAll(':checked')].map(x=>x.value),$('enquiryNote').value);
 form.addEventListener('submit',e=>e.preventDefault());form.addEventListener('input',refresh);refresh();
 $('enquiryCopy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('enquiryDraft').value);$('enquiryStatus').textContent='Draft copied. Nothing sent.';}catch{$('enquiryDraft').focus();$('enquiryDraft').select();$('enquiryStatus').textContent='Select and copy the highlighted draft. Nothing sent.';}});
 $('enquiryDownload').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([$('enquiryDraft').value],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='burton-found-enquiry.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('enquiryStatus').textContent='Draft downloaded. Nothing sent.';});
 $('enquiryEmail').addEventListener('click',()=>{if(!canEmail)return;const href='mailto:'+email+'?subject='+encodeURIComponent('Burton & Found catalogue enquiry')+'&body='+encodeURIComponent($('enquiryDraft').value);if(href.length>1800){$('enquiryStatus').textContent='Draft is long; copy it into your email app instead.';return;}location.href=href;$('enquiryStatus').textContent='Your email app may open. Nothing has been sent by the website.';});
 dialog.addEventListener('close',()=>root.replaceChildren(),{once:true});
 if(!dialog.open)dialog.showModal();
 $('enquiryNote').focus();
}
window.BURTON_ENQUIRY=Object.freeze({compose,validEmail,open});
})();
