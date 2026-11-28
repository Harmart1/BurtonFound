/* Owner-only GST/HST screening, not a tax assessment. No persistence or payment mutations. */
(()=>{
'use strict';
const LIMIT=3000000;
function quarters(now){
 const y=now.getUTCFullYear(),m=Math.floor(now.getUTCMonth()/3)*3;
 return Array.from({length:5},(_,i)=>{
  const start=new Date(Date.UTC(y,m-3*(4-i),1)),end=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+3,0));
  return {label:start.getUTCFullYear()+' Q'+(Math.floor(start.getUTCMonth()/3)+1),from:start.toISOString().slice(0,10),to:(end>now?now:end).toISOString().slice(0,10),partial:i===4};
 });
}
function screen(values){
 if(!Array.isArray(values)||values.length!==5||values.some(v=>!Number.isSafeInteger(v)||v<0||v>1e12))return null;
 const previous=values.slice(0,4).reduce((a,b)=>a+b,0),recent=values.slice(1).reduce((a,b)=>a+b,0);
 const largest=Math.max(...values);
 return {previous,recent,largest,exceeded:largest>LIMIT||previous>LIMIT||recent>LIMIT,near:Math.max(largest,previous,recent)>=LIMIT*.8};
}
window.BURTON_TAX_SCREEN=Object.freeze({quarters,screen});
const $=id=>document.getElementById(id),A=window.BURTON_ACCOUNT,O=window.BURTON_OPERATIONS;
if(!$('taxScreenLoad')||!A||!O)return;
const qs=quarters(new Date()),money=n=>new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(n/100);
const rows=$('taxScreenRows'),output=$('taxScreenResult');let seq=0;
function render(){
 const values=[...rows.querySelectorAll('input')].map(el=>{const v=el.value.trim();return /^\d{1,10}(\.\d{1,2})?$/.test(v)?Math.round(Number(v)*100):null});
 const result=screen(values);
 output.textContent=!result?'Enter all five reconciled quarter amounts (zero only if confirmed).':(result.exceeded?'REVIEW URGENTLY — a supplied total exceeds CAD $30,000.':result.near?'Review soon — a supplied total is at least 80% of the threshold.':'Supplied amounts are below or equal to the threshold; this does not establish eligibility.')+' Previous four completed quarters '+money(result.previous)+'; current plus previous three '+money(result.recent)+'; highest single quarter '+money(result.largest)+'. Confirm due/paid timing, worldwide taxable supplies and associated persons with your accountant.';
}
for(const q of qs){
 const tr=document.createElement('tr'),label=document.createElement('th'),store=document.createElement('td'),td=document.createElement('td'),input=document.createElement('input');
 label.scope='row';label.textContent=q.label+(q.partial?' to date':'');store.textContent='Not loaded';store.className='tax-store-total';input.type='number';input.min='0';input.step='0.01';input.inputMode='decimal';input.setAttribute('aria-label',q.label+' reconciled taxable supplies in CAD');input.addEventListener('input',render);td.append(input);tr.append(label,store,td);rows.append(tr);
}
$('taxScreenLoad').addEventListener('click',async()=>{
 const request=++seq,version=A.sessionVersion(),uid=A.user()?.id;const button=$('taxScreenLoad');
 const targets=[...rows.querySelectorAll('.tax-store-total')];
 button.disabled=true;targets.forEach(x=>x.textContent='Loading…');
 try{
  const token=await A.authToken?.();if(!token||!uid)throw Error('Sign in as an approved owner.');
  for(let i=0;i<qs.length;i++){
   if(request!==seq||A.sessionVersion()!==version||A.user()?.id!==uid||A.recoveryState()!=='none')throw Error('Owner session changed');
   const {from,to}=qs[i],r=await fetch('/api/admin/bookkeeping?'+new URLSearchParams({from,to}),{headers:{Authorization:'Bearer '+token},cache:'no-store'});
   const data=await r.json();
   if(request!==seq||A.sessionVersion()!==version||A.user()?.id!==uid||A.recoveryState()!=='none')throw Error('Owner session changed');
   if(!r.ok||!Array.isArray(data.orders))throw Error('Quarter report unavailable; no complete screening total.');
   const totals=O.ledger(data.orders,'live');
   targets[i].textContent=money(totals.gross)+' gross paid orders'+(totals.review||totals.refunded||totals.invalid?' — exceptions to reconcile':'');
  }
 }catch(e){targets.forEach(x=>x.textContent='Not verified');output.textContent=e.message;}
 finally{if(request===seq)button.disabled=false;}
});
function clear(){seq++;rows.querySelectorAll('input').forEach(x=>x.value='');rows.querySelectorAll('.tax-store-total').forEach(x=>x.textContent='Not loaded');output.textContent='Reload after sign-in.';$('taxScreenLoad').disabled=false;}
document.addEventListener('bf:auth-change',clear);document.addEventListener('bf:recovery-state',clear);
})();
