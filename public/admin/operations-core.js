/* Pure calculations shared by owner UI and regression tests. */
(()=>{
'use strict';
const mode=r=>/^cs_live_/.test(r?.stripe_session_id||'')?'live':/^cs_test_/.test(r?.stripe_session_id||'')?'test':'unknown';
const cents=v=>Number.isSafeInteger(v)&&v>=0?v:null;
const cash=v=>v===null?'':(v/100).toFixed(2);
const csvCell=v=>{let s=String(v??'').replace(/[\r\n]/g,' ');if(/^[\s]*[=+\-@\t]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
const csv=rows=>'\ufeff'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n')+'\r\n';
function ledger(orders,selection='live'){
 const rows=orders.filter(r=>mode(r)===selection);
 let gross=0,subtotal=0,shipping=0,other=0,paid=0,review=0,refunded=0,invalid=0;
 const cells=[['Order ID','Created UTC','Stripe mode','Stripe Checkout session','Payment intent','Payment status','Fulfillment status','Item subtotal CAD','Shipping charged CAD','Recorded order total CAD','Total less item and shipping CAD (unclassified)','Accounting review']];
 for(const r of rows){
  const a=cents(r.subtotal_cents),b=cents(r.shipping_cents),c=cents(r.total_cents);
  const valid=a!==null&&b!==null&&c!==null&&c>=a+b;
  const remainder=valid?c-a-b:null;
  let note='Reconcile with Stripe balance transactions, fees, actual refunds and tax records';
  if(!valid){invalid++;note='Invalid or inconsistent recorded totals; investigate';}
  else if(r.payment_status==='paid'){paid++;subtotal+=a;shipping+=b;gross+=c;other+=remainder;}
  if(r.payment_status==='review')review++;
  if(r.payment_status==='refunded')refunded++;
  if(selection!=='live')note='NON-LIVE OR UNKNOWN — exclude from real revenue; '+note;
  cells.push([r.id,r.created_at,mode(r),r.stripe_session_id,r.payment_intent,r.payment_status,r.fulfillment_status,cash(a),cash(b),cash(c),cash(remainder),note]);
 }
 return {rows:rows.length,paid,review,refunded,invalid,gross,subtotal,shipping,other,excluded:orders.length-rows.length,csv:csv(cells)};
}
function inventory(products,records){
 const seen=new Set(),backend=new Map();
 for(const r of records){if(!r?.sku||backend.has(r.sku)||cents(r.price_cents)===null||typeof r.available!=='boolean')throw Error('Inventory feed malformed');backend.set(r.sku,r);}
 const count={listed:0,backend:backend.size,missing:0,price:0,unverified:0,critical:0,backendOnly:0,unavailable:0};
 const rows=[['SKU','Title','Asking CAD','Database CAD','Database available','Review status','Physical unit IDs','Owner inspected','Owner approved','Notes']];
 const detail=[];
 for(const p of products){
  if(!p?.sku||seen.has(p.sku)||!Number.isFinite(p.price)||p.price<=0)throw Error('Catalogue malformed');seen.add(p.sku);count.listed++;
  const r=backend.get(p.sku),unverified=p.requiresVerification===true||p.stockState==='verification_required'||p.availableForCheckout===false;
  if(unverified)count.unverified++;
  if(!r)count.missing++;else {if(r.price_cents!==Math.round(p.price*100))count.price++;if(!r.available)count.unavailable++;}
  if(unverified&&r?.available)count.critical++;
  const flags=[unverified&&r?.available?'CRITICAL: unverified SKU available':'',!r?'Missing database SKU':'',r&&r.price_cents!==Math.round(p.price*100)?'Price mismatch':'',unverified?'Checkout disabled or physical verification required':'',r&&!r.available?'Database unavailable':''].filter(Boolean);
  const note=flags.join('; ')||'Owner physical inspection still required';
  if(flags.length)detail.push({sku:p.sku,title:p.title,note});
  rows.push([p.sku,p.title,p.price.toFixed(2),r?cash(r.price_cents):'',r?String(r.available):'',note,(p.catalogIds||[]).join(' + '),'','','']);
 }
 for(const r of records)if(!seen.has(r.sku)){count.backendOnly++;detail.push({sku:r.sku,title:'Database-only record',note:'Not present in storefront catalogue'});rows.push([r.sku,'','',cash(r.price_cents),String(r.available),'Database-only record','','','','']);}
 return {count,detail,csv:csv(rows)};
}
function priority(o){
 if(o.payment_status==='review'||o.fulfillment_status==='needs_attention'||(o.shipping_review_reason&&!o.shipping_review_resolved_at))return 0;
 if(o.payment_status==='paid'&&o.fulfillment_status==='processing')return 1;
 if(o.payment_status==='paid'&&o.fulfillment_status==='packed')return 2;
 return 3;
}
function exceptions(orders,selection='live',stripeRows=[]){
 if(!['live','test','unknown'].includes(selection))throw Error('Invalid review mode');
 const compared=new Map(stripeRows.map(x=>[x.id,x]));
 const rows=[];
 for(const o of orders.filter(x=>mode(x)===selection)){
  const p=compared.get(o.id),flags=[],categories=new Set();
  const add=(category,note)=>{categories.add(category);flags.push(note);};
  const a=cents(o.subtotal_cents),b=cents(o.shipping_cents),c=cents(o.total_cents);
  if(a===null||b===null||c===null||c<a+b)add('amount','Recorded amounts inconsistent');
  if(o.payment_status==='refunded')add('refund','Local refunded status; verify individual refund and balance records');
  if(o.payment_status==='review'||o.fulfillment_status==='needs_attention')add('review','Local order requires review; hold fulfillment until resolved');
  const reported=p?cents(p.refund_reported_cents):null;
  if(reported!==null&&reported>0)add('refund','Stripe reports a refund amount; settlement not verified');
  if(p&&Array.isArray(p.issues))for(const issue of p.issues){
   if(typeof issue!=='string'||issue.length>250)continue;
   add(/refund|disput/i.test(issue)?'refund':/total|shipping|amount|tax/i.test(issue)?'amount':'review',issue);
  }
  if(!flags.length)continue;
  const action=selection!=='live'?'Non-live/unknown: review only, no real refund, shipment or customer contact.':categories.has('refund')?'Confirm original charge and individual refund status; inspect any returned item before considering stock release.':'Verify payment, amounts and order condition before proceeding.';
  rows.push({id:String(o.id||''),created_at:String(o.created_at||''),payment_status:String(o.payment_status||''),fulfillment_status:String(o.fulfillment_status||''),total:c,reported,categories:[...categories],flags:[...new Set(flags)],action});
 }
 rows.sort((a,b)=>Number(b.categories.includes('refund'))-Number(a.categories.includes('refund'))||a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));
 return rows;
}
function exceptionCsv(rows,selection){return csv([['Order ID','Created UTC','Mode','Payment status','Fulfillment status','Recorded total CAD','Provider-reported refund CAD (not settled)','Review flags','Suggested manual action'],...rows.map(r=>[r.id,r.created_at,selection,r.payment_status,r.fulfillment_status,cash(r.total),cash(r.reported),r.flags.join('; '),r.action])]);}
window.BURTON_OPERATIONS=Object.freeze({ledger,inventory,priority,csv,mode,exceptions,exceptionCsv});
})();
