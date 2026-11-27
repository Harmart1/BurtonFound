(()=>{
'use strict';
const A=window.BURTON_ACCOUNT,O=window.BURTON_OPERATIONS,$=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(n/100);
let ledgerResult=null,stockResult=null,stripeResult=null,stripeSeq=0;
async function ownerFetch(url){
 const token=await A.authToken?.();if(!token)throw Error('Sign in first');
 const r=await fetch(url,{headers:{Authorization:'Bearer '+token},cache:'no-store'});
 const data=await r.json();if(!r.ok)throw Error(data.error||'Report unavailable');return data;
}
function download(text,name){
 const u=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);
}
const today=new Date().toISOString().slice(0,10);
$('ledgerTo').value=today;$('ledgerFrom').value=today.slice(0,7)+'-01';
function clearStripe(){stripeSeq++;stripeResult=null;window.dispatchEvent(new Event('burton:stripe-clear'));$('stripeCompare').disabled=true;$('stripeCompareExport').disabled=true;$('stripeCompareResult').textContent='Load a live or sandbox order report first.';$('stripeCompareIssues').replaceChildren();}
function clearLedger(){clearStripe();window.dispatchEvent(new Event('burton:ledger-clear'));ledgerResult=null;$('ledgerExport').disabled=true;$('ledgerResult').textContent='Choose a period and load the report.';}
for(const id of ['ledgerFrom','ledgerTo','ledgerMode'])$(id).addEventListener('change',clearLedger);
$('ledgerForm').addEventListener('submit',async e=>{
 e.preventDefault();clearLedger();$('ledgerResult').textContent='Loading private order records…';$('ledgerLoad').disabled=true;
 const from=$('ledgerFrom').value,to=$('ledgerTo').value,mode=$('ledgerMode').value;
 try{
  const d=await ownerFetch('/api/admin/bookkeeping?'+new URLSearchParams({from,to}));
  if(from!==$('ledgerFrom').value||to!==$('ledgerTo').value||mode!==$('ledgerMode').value)return;
  const r=O.ledger(d.orders,mode);ledgerResult={...r,from,to,mode};$('stripeCompare').disabled=!['test','live'].includes(mode);
  $('ledgerResult').textContent=(mode==='live'?'LIVE order records':mode.toUpperCase()+' records — NOT business revenue')+' · '+r.rows+' records · '+r.paid+' valid paid · '+r.review+' review · '+r.refunded+' refunded status · '+r.invalid+' inconsistent totals · '+r.excluded+' other-mode records excluded. Recorded paid-order gross '+money(r.gross)+' · Items '+money(r.subtotal)+' · Shipping '+money(r.shipping)+' · Unclassified difference '+money(r.other)+'. Not net payouts, tax liability, or a completed ledger.';
  $('ledgerExport').disabled=false;
  window.dispatchEvent(new CustomEvent('burton:ledger-loaded',{detail:{orders:d.orders,mode,from,to}}));
 }catch(ex){$('ledgerResult').textContent=ex.message;}finally{$('ledgerLoad').disabled=false;}
});
$('ledgerExport').addEventListener('click',()=>{if(ledgerResult)download(ledgerResult.csv,'burton-found-'+ledgerResult.mode+'-orders-'+ledgerResult.from+'-to-'+ledgerResult.to+'.csv');});
$('stripeCompare').addEventListener('click',async()=>{
 const current=ledgerResult;if(!current||!['test','live'].includes(current.mode))return;
 const seq=++stripeSeq;stripeResult=null;$('stripeCompare').disabled=true;$('stripeCompareExport').disabled=true;$('stripeCompareResult').textContent='Verifying recorded orders against Stripe…';$('stripeCompareIssues').replaceChildren();
 try{
  const d=await ownerFetch('/api/admin/stripe-reconciliation?'+new URLSearchParams({from:current.from,to:current.to,mode:current.mode}));
  if(seq!==stripeSeq||current!==ledgerResult)return;
  stripeResult=d;
  window.dispatchEvent(new CustomEvent('burton:stripe-compared',{detail:d}));
  const clean=d.rows.filter(r=>r.issues.length===0).length;
  $('stripeCompareResult').textContent=(d.mode==='test'?'SANDBOX — NOT business revenue. ':'LIVE records. ')+d.rows.length+' compared · '+clean+' without flagged differences · '+(d.rows.length-clean)+' require review · '+d.excluded+' other-mode records excluded. '+d.notice;
  for(const r of d.rows.filter(x=>x.issues.length)){const li=document.createElement('li');li.textContent=r.id+' — '+r.issues.join('; ');$('stripeCompareIssues').append(li);}
  $('stripeCompareExport').disabled=false;
 }catch(ex){if(seq===stripeSeq)$('stripeCompareResult').textContent=ex.message;}
 finally{if(seq===stripeSeq&&current===ledgerResult)$('stripeCompare').disabled=false;}
});
$('stripeCompareExport').addEventListener('click',()=>{
 if(!stripeResult)return;
 const d=stripeResult,fmt=n=>Number.isSafeInteger(n)?(n/100).toFixed(2):'';
 const rows=[['Order ID','Created UTC','Mode','Session ID','Recorded total CAD','Stripe total CAD','Stripe shipping CAD','Stripe tax CAD','Charge refund amount reported CAD (not settled)','Original charge fee CAD','Original charge net CAD (not payout)','Charge balance status','Review flags']];
 for(const r of d.rows)rows.push([r.id,r.created_at,d.mode,r.session_id,fmt(r.recorded_cents),fmt(r.stripe_cents),fmt(r.shipping_cents),fmt(r.tax_cents),fmt(r.refund_reported_cents),fmt(r.charge_fee_cents),fmt(r.charge_net_cents),r.charge_balance_status,r.issues.join('; ')]);
 download(O.csv(rows),'burton-found-stripe-'+d.mode+'-'+d.from+'-to-'+d.to+'.csv');
});
$('stockLoad').addEventListener('click',async()=>{
 stockResult=null;$('stockExport').disabled=true;$('stockLoad').disabled=true;$('stockResult').textContent='Comparing current catalogue and public stock feed…';$('stockIssues').replaceChildren();
 try{
  // Existing authenticated workspace gate is checked again before building any report.
  await ownerFetch('/api/admin/me');
  const r=await fetch('/api/catalog',{cache:'no-store'}),d=await r.json();
  if(!r.ok||d.configured!==true||!Array.isArray(d.items))throw Error('Database stock feed unavailable; no comparison made');
  const products=window.BURTON_DATA?.inventory;
  if(!Array.isArray(products)||products.length!==229)throw Error('Catalogue did not load completely; no comparison made');
  const result=O.inventory(products,d.items);stockResult=result;
  const c=result.count;
  $('stockResult').textContent=c.listed+' listings · '+c.backend+' database records · '+c.missing+' missing · '+c.price+' price mismatches · '+c.critical+' unverified/disabled listings marked available · '+c.backendOnly+' database-only · '+c.unavailable+' unavailable · '+c.unverified+' require verification or checkout disabled. Physical ownership and condition are NOT established by this comparison.';
  for(const item of result.detail.slice(0,15)){const li=document.createElement('li');li.textContent=item.sku+' — '+item.title+': '+item.note;$('stockIssues').append(li);}
  if(result.detail.length>15){const li=document.createElement('li');li.textContent='Additional flagged entries are in the complete CSV.';$('stockIssues').append(li);}
  $('stockExport').disabled=false;
 }catch(ex){$('stockResult').textContent=ex.message;}finally{$('stockLoad').disabled=false;}
});
$('stockExport').addEventListener('click',()=>{if(stockResult)download(stockResult.csv,'burton-found-inventory-review-'+today+'.csv');});
})();
