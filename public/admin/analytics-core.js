/* Read-only owner analytics and safe packing preparation. */
(()=>{
'use strict';
const O=window.BURTON_OPERATIONS;
const cents=n=>Number.isSafeInteger(n)&&n>=0;
const validSku=s=>typeof s==='string'&&/^[A-Z0-9-]{2,45}$/.test(s);
const cash=n=>(n/100).toFixed(2);
const name=s=>({'coca-cola':'Coca-Cola',hollywood:'Old Hollywood',automobiles:'Vintage automobiles',books:'Books',collectibles:'Collectibles'}[s]||s||'Unmapped collection');
function sales(orders,products,selection='live'){
 const map=new Map(products.map(p=>[p.sku,p])),monthly=new Map(),collections=new Map(),skus=new Map();
 let count=0,gross=0,subtotal=0,shipping=0,other=0,unallocated=0,invalid=0,excluded=0,unmapped=0,review=0,refunded=0;
 for(const r of orders){
  if(O.mode(r)!==selection){excluded++;continue;}
  if(r.payment_status!=='paid'){if(r.payment_status==='review')review++;if(r.payment_status==='refunded')refunded++;continue;}
  const {subtotal_cents:a,shipping_cents:b,total_cents:c}=r;
  const d=new Date(r.created_at);
  if(!cents(a)||!cents(b)||!cents(c)||c<a+b||!Number.isFinite(d.getTime())){invalid++;continue;}
  const month=d.toISOString().slice(0,7),m=monthly.get(month)||{month,orders:0,gross:0,subtotal:0,shipping:0,other:0};
  count++;gross+=c;subtotal+=a;shipping+=b;other+=c-a-b;
  m.orders++;m.gross+=c;m.subtotal+=a;m.shipping+=b;m.other+=c-a-b;monthly.set(month,m);
  const lines=r.item_lines;
  if(!Array.isArray(lines)||!lines.length||lines.some(x=>!validSku(x?.sku)||!cents(x?.price_cents))||new Set(lines.map(x=>x.sku)).size!==lines.length||lines.reduce((sum,x)=>sum+x.price_cents,0)!==a){unallocated+=a;continue;}
  for(const l of lines){
   const p=map.get(l.sku),key=p?.collection||'Unmapped collection';
   if(!p?.collection)unmapped+=l.price_cents;
   const col=collections.get(key)||{collection:name(key),items:0,subtotal:0};
   col.items++;col.subtotal+=l.price_cents;collections.set(key,col);
   const item=skus.get(l.sku)||{sku:l.sku,title:p?.title||'Historical / unmapped SKU',items:0,subtotal:0};
   item.items++;item.subtotal+=l.price_cents;skus.set(l.sku,item);
  }
 }
 const months=[...monthly.values()].sort((a,b)=>a.month.localeCompare(b.month));
 const groups=[...collections.values()].sort((a,b)=>b.subtotal-a.subtotal||a.collection.localeCompare(b.collection));
 const items=[...skus.values()].sort((a,b)=>b.subtotal-a.subtotal||a.sku.localeCompare(b.sku));
 return {count,gross,subtotal,shipping,other,average:count?Math.round(gross/count):null,unallocated,unmapped,invalid,excluded,review,refunded,months,groups,items,
 monthlyCsv:O.csv([['Mode','Month UTC','Valid paid orders','Recorded gross CAD','Item subtotal CAD','Shipping CAD','Unclassified difference CAD'],...months.map(m=>[selection,m.month,m.orders,cash(m.gross),cash(m.subtotal),cash(m.shipping),cash(m.other)])]),
 collectionCsv:O.csv([['Mode','Collection (current catalogue)','Listed SKUs sold','Recorded item subtotal CAD'],...groups.map(g=>[selection,g.collection,g.items,cash(g.subtotal)]),[selection,'Unallocated order subtotal (invalid/missing lines)','',cash(unallocated)]]),
 skuCsv:O.csv([['Mode','SKU','Current catalogue title','Listing sales count','Recorded item subtotal CAD'],...items.map(p=>[selection,p.sku,p.title,p.items,cash(p.subtotal)])])};
}
function packing(orders,products){
 const map=new Map(products.map(p=>[p.sku,p])),candidates=[],blocked=[],seen=new Set();
 for(const o of orders){
  if(!['processing','packed','needs_attention'].includes(o.fulfillment_status))continue;
  const id=String(o.id||'');
  const reason=o.record_mode!=='live'?'Sandbox or unknown record':o.payment_status!=='paid'?'Payment not recorded as paid':o.fulfillment_status==='needs_attention'||(o.shipping_review_reason&&!o.shipping_review_resolved_at)?'Unresolved fulfillment or shipping review':!id||seen.has(id)?'Missing or duplicate order ID':null;
  if(reason){blocked.push({id,reason});continue;}seen.add(id);
  if(!Array.isArray(o.item_lines)||!o.item_lines.length){blocked.push({id,reason:'No order item lines'});continue;}
  const lines=[],units=new Set();let issue='';
  for(const l of o.item_lines){
   const p=map.get(l?.sku);
   if(!validSku(l?.sku)||!p||p.requiresVerification===true||p.availableForCheckout===false||p.stockState==='verification_required'||!Array.isArray(p.catalogIds)||!p.catalogIds.length||p.catalogIds.some(x=>!validSku(x))){issue='Missing or unverified catalogue component';break;}
   if(p.catalogIds.some(x=>units.has(x))||new Set(p.catalogIds).size!==p.catalogIds.length){issue='Overlapping physical units inside order';break;}
   p.catalogIds.forEach(x=>units.add(x));lines.push({sku:l.sku,title:p.title,units:[...p.catalogIds]});
  }
  if(issue){blocked.push({id,reason:issue});continue;}
  candidates.push({id,created_at:o.created_at,status:o.fulfillment_status,carrier:o.selected_shipping_carrier||'Not confirmed',lines,units:[...units]});
 }
 const freq=new Map();
 for(const o of candidates)for(const u of o.units)freq.set(u,(freq.get(u)||0)+1);
 const ready=candidates.filter(o=>{if(o.units.some(u=>freq.get(u)>1)){blocked.push({id:o.id,reason:'Physical unit shared with another pending order'});return false;}return true;}).sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)));
 const rows=ready.flatMap(o=>o.lines.flatMap(l=>l.units.map(u=>[o.id,o.status,o.carrier,l.sku,l.title,u,'',''])));
 return {ready,blocked,units:rows.length,csv:O.csv([['Order ID','Recorded fulfillment','Requested carrier','Listing SKU','Listing title','Physical unit ID','Picked / inspected','Packed / checked'],...rows])};
}
window.BURTON_ANALYTICS=Object.freeze({sales,packing});
})();
