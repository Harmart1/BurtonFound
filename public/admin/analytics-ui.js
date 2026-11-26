(()=>{
'use strict';
const A=window.BURTON_ACCOUNT,O=window.BURTON_ANALYTICS,$=id=>document.getElementById(id);
let batch=null,report=null;
const money=n=>n===null?'—':new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(n/100);
function catalogue(){const p=window.BURTON_DATA?.inventory;if(!Array.isArray(p)||p.length!==229)throw Error('Full catalogue unavailable; retry after refreshing');return p;}
function download(text,name){const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function fill(id,rows){const body=$(id);body.replaceChildren();for(const row of rows){const tr=document.createElement('tr');for(const val of row){const td=document.createElement('td');td.textContent=String(val);tr.append(td);}body.append(tr);}}
function clearSales(){report=null;$('analyticsResult').textContent='Load bookkeeping report to calculate sales analytics.';for(const id of ['analyticsMonthly','analyticsCollections','analyticsSkus'])fill(id,[]);for(const id of ['monthlyExport','collectionExport','skuExport'])$(id).disabled=true;}
window.addEventListener('burton:ledger-clear',clearSales);
window.addEventListener('burton:ledger-loaded',e=>{
 clearSales();
 try{
  const {orders,mode,from,to}=e.detail;
  const r=O.sales(orders,catalogue(),mode);report={r,mode,from,to};
  $('analyticsResult').textContent=(mode==='live'?'LIVE recorded paid orders':'NON-LIVE / UNKNOWN — not business revenue')+' · '+r.count+' valid paid orders · Gross '+money(r.gross)+' · Average order '+money(r.average)+' · Item subtotal '+money(r.subtotal)+' · '+r.review+' review · '+r.refunded+' refunded status · '+r.invalid+' invalid totals excluded · Unallocated items '+money(r.unallocated)+' · Unmapped collection subtotal '+money(r.unmapped)+'.';
  fill('analyticsMonthly',r.months.map(x=>[x.month,x.orders,money(x.gross),money(x.shipping)]));
  fill('analyticsCollections',r.groups.map(x=>[x.collection,x.items,money(x.subtotal)]));
  fill('analyticsSkus',r.items.slice(0,10).map(x=>[x.sku,x.title,x.items,money(x.subtotal)]));
  for(const id of ['monthlyExport','collectionExport','skuExport'])$(id).disabled=false;
 }catch(ex){$('analyticsResult').textContent=ex.message;}
});
for(const [id,key] of [['monthlyExport','monthlyCsv'],['collectionExport','collectionCsv'],['skuExport','skuCsv']])$(id).addEventListener('click',()=>{if(report)download(report.r[key],'burton-found-'+report.mode+'-'+key+'-'+report.from+'-to-'+report.to+'.csv');});
function clearBatch(){batch=null;$('batchExport').disabled=true;$('batchPrint').disabled=true;$('batchRows').replaceChildren();$('batchBlocked').replaceChildren();$('batchResult').textContent='Refresh the pick list before use.';}
window.addEventListener('burton:orders-changed',clearBatch);
$('batchLoad').addEventListener('click',async()=>{
 clearBatch();$('batchLoad').disabled=true;$('batchResult').textContent='Reading current order records…';
 try{
  const token=await A.authToken?.();if(!token)throw Error('Sign in first');
  const r=await fetch('/api/admin/orders',{headers:{Authorization:'Bearer '+token},cache:'no-store'}),d=await r.json();
  if(!r.ok||!Array.isArray(d.orders))throw Error(d.error||'Orders unavailable');
  batch=O.packing(d.orders,catalogue());
  $('batchResult').textContent=batch.ready.length+' candidate orders · '+batch.units+' physical units · '+batch.blocked.length+' held back for review. Latest '+d.orders.length+' order records only (maximum 100); snapshot, not shipment authorization. Recheck each order and original before dispatch.';
  fill('batchRows',batch.ready.flatMap(o=>o.lines.map(l=>[o.id.slice(0,8),o.status,l.sku,l.title,l.units.join(', ')])));
  for(const b of batch.blocked){const li=document.createElement('li');li.textContent=(b.id.slice(0,8)||'Unknown')+' — '+b.reason;$('batchBlocked').append(li);}
  $('batchExport').disabled=!batch.ready.length;$('batchPrint').disabled=!batch.ready.length;
 }catch(ex){$('batchResult').textContent=ex.message;}finally{$('batchLoad').disabled=false;}
});
$('batchExport').addEventListener('click',()=>{if(batch?.ready.length)download(batch.csv,'burton-found-pick-list-'+new Date().toISOString().slice(0,10)+'.csv');});
$('batchPrint').addEventListener('click',()=>{
 if(!batch?.ready.length)return;
 const w=window.open('','_blank');if(!w){$('batchResult').textContent='Allow pop-ups to print the pick list.';return;}
 const doc=w.document;doc.title='Burton & Found private pick list';
 const style=doc.createElement('style');style.textContent='body{font:15px/1.5 system-ui;margin:24px;color:#111}h1{font-size:24px}article{break-inside:avoid;border-top:1px solid #aaa;padding:12px 0}li{margin:6px 0}@media print{button{display:none}}';doc.head.append(style);
 const add=(parent,tag,text)=>{const el=doc.createElement(tag);el.textContent=text;parent.append(el);return el;};
 add(doc.body,'h1','Burton & Found — private pick list');
 add(doc.body,'p','Preparation only. Verify payment, physical condition, shipping address and carrier postage before dispatch. No customer addresses included.');
 for(const o of batch.ready){const article=add(doc.body,'article','');add(article,'h2','Order '+o.id.slice(0,8));add(article,'p',o.status+' · Requested carrier: '+o.carrier);const list=add(article,'ul','');for(const l of o.lines)for(const unit of l.units)add(list,'li','☐ Inspect / pick '+unit+' · '+l.sku+' · '+l.title);add(article,'p','☐ Confirm complete order and packaging before recording shipment');}
 const button=add(doc.body,'button','Print pick list');button.addEventListener('click',()=>w.print());w.focus();
});
})();
