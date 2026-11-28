/* Owner workspace only. Pure calculations; no mail sending, payment or stock mutations. */
(()=>{
'use strict';
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const valid=v=>Number.isSafeInteger(v)&&v>=0&&v<=1e12;
const money=v=>new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(v/100);
const clean=v=>String(v??'').replace(/[\r\n\u0000-\u001f\u007f]/g,' ').trim();
const emailValid=v=>typeof v==='string'&&/^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(v)&&v.length<=254;
function paid(o){
 return o?.record_mode==='live'&&o.payment_status==='paid'&&valid(o.subtotal_cents)&&valid(o.shipping_cents)&&valid(o.total_cents)&&o.total_cents>=o.subtotal_cents+o.shipping_cents&&Array.isArray(o.item_lines)&&o.item_lines.length>0&&o.item_lines.every(p=>typeof p.sku==='string'&&typeof p.title==='string'&&valid(p.price_cents))&&o.item_lines.reduce((a,p)=>a+p.price_cents,0)===o.subtotal_cents;
}
function ready(o){return paid(o)&&o.fulfillment_status!=='needs_attention'&&(!o.shipping_review_reason||!!o.shipping_review_resolved_at);}
function shippingReady(o){return ready(o)&&['processing','packed','shipped','delivered'].includes(o.fulfillment_status);}
function contribution(charged,postage,packaging,duties,other){
 if(![charged,postage,packaging,duties,other].every(valid))return null;
 const costs=postage+packaging+duties+other;
 return {costs,contribution:charged-costs};
}
function parseCAD(v){
 const s=String(v??'').trim();if(!/^\d{1,8}(\.\d{1,2})?$/.test(s))return null;
 const n=Math.round(Number(s)*100);return valid(n)?n:null;
}
function draft(o,type,seller){
 if(!ready(o)||!emailValid(o.email)||!['confirmation','dispatch'].includes(type))return null;
 if(type==='dispatch'&&(!['shipped','delivered'].includes(o.fulfillment_status)||!clean(o.carrier)||!clean(o.tracking_number)))return null;
 const ref=clean(o.id),shipping=type==='dispatch';
 const body=['Hello'+(clean(o.customer_name)?' '+clean(o.customer_name):'')+',','',shipping?'Your Burton & Found order has been marked as '+(o.fulfillment_status==='delivered'?'delivered':'dispatched')+'.':'Thank you for your order. Our records show payment received. We will inspect and prepare the items for shipping.','Order reference: '+ref,'',...o.item_lines.map(p=>clean(p.sku)+' — '+clean(p.title)),'', 'Items: '+money(o.subtotal_cents)+' CAD','Shipping: '+money(o.shipping_cents)+' CAD',...(o.total_cents>o.subtotal_cents+o.shipping_cents?['Other recorded amount: '+money(o.total_cents-o.subtotal_cents-o.shipping_cents)+' CAD (not classified here)']:[]),'Recorded total: '+money(o.total_cents)+' CAD',...(shipping?['','Carrier: '+clean(o.carrier),'Tracking: '+clean(o.tracking_number)]:[]),'','Please reply if you have questions.','Burton & Found',...(emailValid(seller)?[seller]:[]),'https://burtonandfound.ca'].join('\n');
 return {to:o.email,subject:'Burton & Found — '+(shipping?'shipping update':'order confirmation')+' — '+ref,body};
}
function summary(o,seller){
 if(!ready(o))return null;
 const rows=o.item_lines.map(p=>'<tr><td>'+e(p.sku)+'</td><td>'+e(p.title)+'</td><td>1</td><td>'+e(money(p.price_cents))+'</td></tr>').join('');
 const delta=o.total_cents-o.subtotal_cents-o.shipping_cents;
 return '<!doctype html><html lang="en-CA"><head><meta charset="utf-8"><title>Paid order summary</title><style>body{font:15px/1.55 system-ui;color:#172d28;max-width:760px;margin:40px auto;padding:20px}h1{font:36px Georgia,serif}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px;border-bottom:1px solid #bbb}p{overflow-wrap:anywhere}@media print{button{display:none}body{margin:0}}</style></head><body><h1>Burton &amp; Found</h1><p>Paid order summary · CAD</p><p>Order reference: '+e(o.id)+'<br>Order date (UTC): '+e(String(o.created_at||'').slice(0,10))+'<br>Customer: '+e(o.customer_name||'Not supplied')+'</p><table><thead><tr><th>SKU</th><th>Item</th><th>Qty</th><th>Amount CAD</th></tr></thead><tbody>'+rows+'</tbody></table><p>Item subtotal: '+e(money(o.subtotal_cents))+'<br>Shipping: '+e(money(o.shipping_cents))+(delta?'<br>Other recorded amount (unclassified): '+e(money(delta)):'')+'<br><strong>Recorded paid total: '+e(money(o.total_cents))+'</strong></p><p>Order record summary only; not a GST/HST tax invoice or independent proof of settlement. Reconcile against Stripe before sending. '+(emailValid(seller)?'Contact: '+e(seller):'')+'</p><p>https://burtonandfound.ca</p><button onclick="window.print()">Print / Save as PDF</button></body></html>';
}
window.BURTON_FULFILLMENT=Object.freeze({paid,ready,shippingReady,contribution,parseCAD,draft,summary,emailValid});
})();
