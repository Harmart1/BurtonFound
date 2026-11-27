/* Read-only owner report. Existing authenticated ledger and Stripe comparison only. */
(()=>{
'use strict';
const A=window.BURTON_ACCOUNT,O=window.BURTON_OPERATIONS,$=id=>document.getElementById(id);
let report=null,stripe=null,visible=[];
const money=n=>n===null?'Not verified':new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(n/100);
function clear(){report=null;stripe=null;visible=[];$('exceptionRows').replaceChildren();$('exceptionExport').disabled=true;$('exceptionResult').textContent='Load the bookkeeping report first.';}
function render(){
 if(!report)return;
 const valid=A.user()?.id===report.uid&&A.sessionVersion()===report.version&&A.recoveryState()==='none';
 if(!valid){clear();return;}
 const all=O.exceptions(report.orders,report.mode,stripe?.rows||[]);
 const filter=$('exceptionFilter').value;
 visible=all.filter(r=>filter==='all'||r.categories.includes(filter));
 $('exceptionRows').replaceChildren();
 for(const r of visible.slice(0,100)){const tr=document.createElement('tr');for(const value of [r.id,r.payment_status+' / '+r.fulfillment_status,money(r.total),money(r.reported),r.flags.join('; ')+'. '+r.action]){const td=document.createElement('td');td.textContent=value;tr.append(td);}$('exceptionRows').append(tr);}
 $('exceptionResult').textContent=(report.mode==='live'?'LIVE':'NON-LIVE OR UNKNOWN — review only')+' · '+all.length+' flagged records · '+visible.length+' match the filter. '+(stripe?'Stripe comparison included; refund settlement still unverified.':'Local status only; no provider refund verification.')+(visible.length>100?' First 100 shown; CSV includes all filtered rows.':'');
 $('exceptionExport').disabled=!visible.length;
}
window.addEventListener('burton:ledger-clear',clear);
window.addEventListener('burton:stripe-clear',()=>{stripe=null;render();});
window.addEventListener('burton:ledger-loaded',e=>{clear();if(!A.user()||A.recoveryState()!=='none')return;report={...e.detail,uid:A.user().id,version:A.sessionVersion()};render();});
window.addEventListener('burton:stripe-compared',e=>{const d=e.detail;if(!report||d.mode!==report.mode||d.from!==report.from||d.to!==report.to)return;stripe=d;render();});
document.addEventListener('bf:auth-change',()=>{if(report&&(A.user()?.id!==report.uid||A.sessionVersion()!==report.version))clear();});
document.addEventListener('bf:recovery-state',()=>{if(A.recoveryState()!=='none')clear();});
$('exceptionFilter').addEventListener('change',render);
$('exceptionExport').addEventListener('click',()=>{if(!report)return;render();if(!report||!visible.length)return;const u=URL.createObjectURL(new Blob([O.exceptionCsv(visible,report.mode)],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=u;a.download='burton-found-review-'+report.mode+'-'+report.from+'-to-'+report.to+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);});
})();
