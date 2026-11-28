/* Owner-only fulfillment console. No customer data is sent to third-party services. */
(()=>{
'use strict';
const A=window.BURTON_ACCOUNT,F=window.BURTON_FULFILLMENT, $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const dollars=c=>new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format((Number(c)||0)/100);
let orders=[];
async function request(url,init={}){
 const version=A.sessionVersion(),uid=A.user()?.id;
 const t=await A.authToken?.();if(!t||A.sessionVersion()!==version||A.user()?.id!==uid)throw Error('Sign in again');
 const r=await fetch(url,{...init,headers:{Authorization:`Bearer ${t}`,...(init.headers||{})},cache:'no-store'});
 const d=await r.json();if(A.sessionVersion()!==version||A.user()?.id!==uid||A.recoveryState()!=='none')throw Error('Owner session changed');if(!r.ok)throw Error(d.error||'Request failed');return d;
}
function address(o){const a=o.shipping_address?.address||{};return [o.shipping_address?.name||o.customer_name,a.line1,a.line2,[a.city,a.state,a.postal_code].filter(Boolean).join(', '),a.country].filter(Boolean).join('\n')}
function status(text){$('status').textContent=text;}
function filtered(){const q=$('orderSearch').value.trim().toLowerCase(),filter=$('statusFilter').value;return orders.filter(o=>(filter==='all'||o.fulfillment_status===filter)&&(!q||[o.id,o.email,o.customer_name,o.fulfillment_status,o.tracking_number,...(o.item_lines||[]).flatMap(p=>[p.sku,p.title])].join(' ').toLowerCase().includes(q)))}
function stats(){
 $('statAll').textContent=orders.length;
 $('statUnshipped').textContent=orders.filter(o=>['processing','packed'].includes(o.fulfillment_status)).length;
 $('statShipped').textContent=orders.filter(o=>['shipped','delivered'].includes(o.fulfillment_status)).length;
 $('statAttention').textContent=orders.filter(o=>o.fulfillment_status==='needs_attention'||o.payment_status==='review').length;
}
function render(){
 window.dispatchEvent(new Event('burton:orders-changed'));
 stats();const display=filtered();if($('orderSort')?.value==='priority'&&window.BURTON_OPERATIONS)display.sort((a,b)=>window.BURTON_OPERATIONS.priority(a)-window.BURTON_OPERATIONS.priority(b)||String(a.created_at).localeCompare(String(b.created_at)));$('count').textContent=`Showing ${display.length} of ${orders.length} recent orders (latest 100; use Business reports for date-range export)`;
 $('orders').innerHTML=display.map(o=>`<article class="order" data-id="${esc(o.id)}">
 <div class="top"><h2>Order ${esc(o.id.slice(0,8))}</h2><strong>${dollars(o.total_cents)} CAD</strong></div>
 <p>${esc(new Date(o.created_at).toLocaleString('en-CA'))} · Record: ${esc(o.record_mode==='live'?'LIVE':o.record_mode==='test'?'SANDBOX — do not ship':'UNKNOWN — verify before shipping')} · Payment: ${esc(o.payment_status)} · <strong>Fulfillment: ${esc(o.fulfillment_status)}</strong></p>
 <div class="items">${(o.item_lines||[]).map(p=>`<div>${esc(p.title)} (${esc(p.sku)}) · ${dollars(p.price_cents)}</div>`).join('')}</div>
 <dl><div><dt>Customer</dt><dd>${esc(o.customer_name||'Not provided')}\n${esc(o.email||'No email')}</dd></div>
 <div><dt>Delivery address</dt><dd>${esc(address(o))}</dd></div><div><dt>Shipping charged</dt><dd>${dollars(o.shipping_cents)}<br>Requested: ${esc(o.selected_shipping_carrier||'Not recorded')} ${esc(o.selected_shipping_service||'')}${o.selected_shipping_eta?'<br>Carrier estimate '+esc(o.selected_shipping_eta):''}${o.shipping_review_reason?'<br>REVIEW: '+esc(o.shipping_review_reason):''}</dd></div>
 <div><dt>Tracking</dt><dd>${esc(o.carrier||'Not entered')} ${esc(o.tracking_number||'')}</dd></div></dl>
 <form class="form"><label>Status<select name="status">${['processing','packed','shipped','delivered','needs_attention'].map(s=>`<option value="${s}" ${s===o.fulfillment_status?'selected':''}>${s.replaceAll('_',' ')}</option>`).join('')}</select></label>
 <label>Carrier<input name="carrier" value="${esc(o.carrier||'Canada Post')}" maxlength="50" autocomplete="off"></label>
 <label>Tracking number<input name="tracking" value="${esc(o.tracking_number||'')}" maxlength="100" autocomplete="off"></label>
 <button type="submit">Save status</button></form>
 ${o.shipping_review_reason&&!o.shipping_review_resolved_at?`<div class="shipping-review-alert"><strong>Shipping address/price mismatch · fulfillment blocked</strong><p>${esc(o.shipping_review_reason)}</p><p>Confirm the paid amount in Stripe, obtain the customer's correct address, recheck the carrier's actual postage, and obtain consent or refund if necessary. This control cannot override an inventory conflict.</p><label>Owner resolution note <textarea data-review-note rows="3" maxlength="1000" placeholder="Describe verified address, postage amount, customer consent and whether a refund is required"></textarea></label><button class="resolve-review" type="button" data-action="resolve-shipping">Record review and unblock shipment</button></div>`:''}
 <div class="order-actions">${o.record_mode!=='live'?'<strong>Non-live or unknown record — no real shipment or customer contact.</strong>':''}<button class="secondary" type="button" data-action="packing">Print packing slip</button>${o.record_mode==='live'?'<a class="secondary" href="https://www.canadapost-postescanada.ca/cpc/en/small-business/snap-ship.page" target="_blank" rel="noopener noreferrer">Canada Post Snap Ship ↗</a><a class="secondary" href="https://www.fedex.com/en-ca/shipping/ship-online.html" target="_blank" rel="noopener noreferrer">FedEx Ship Manager ↗</a>':''}<button class="secondary" type="button" data-action="address">Copy address</button><button class="secondary" type="button" data-action="email">Prepare update email</button>${F?.ready(o)?`<button class="secondary" type="button" data-action="summary">Print paid order summary</button><button class="secondary" type="button" data-action="confirmation">Prepare order confirmation</button><button class="secondary" type="button" data-action="shipping-cost">Calculate shipping contribution</button>`:'' }<button class="secondary" type="button" data-action="history">View change history</button></div>
 <div class="shipping-cost-panel" hidden></div><div class="history" hidden></div></article>`).join('')||'<div class="help">No orders match these filters</div>';
}
async function refresh(){status('Loading orders…');try{const d=await request('/api/admin/orders');orders=d.orders||[];status('Secure owner dashboard · Recent order records, including review and test records');$('dashboard').hidden=false;$('loginHelp').hidden=true;render();loadReadiness();loadHolds()}catch(e){status(e.message);$('loginHelp').hidden=false;$('dashboard').hidden=true}}
async function loadReadiness(){
 const el=$('readinessResults');if(!el)return;
 el.textContent='Checking connected services…';
 try{
  const v=await request('/api/admin/readiness');
  if(window.BURTON_LAUNCH_READINESS?.render){window.BURTON_LAUNCH_READINESS.render(v,el,esc);return;}
  const rows=[
   {title:'Supabase inventory',good:v.supabase?.connected===true,detail:v.supabase?.connected?`${v.supabase.listings} listings · ${v.supabase.available} currently available`:'Private catalogue connection unavailable'},
   {title:'Stripe sandbox',good:v.stripe?.sandboxKeyPresent===true&&v.stripe?.webhookSigningKeyPresent===true,detail:'Test API key and webhook signing key'},
   {title:'Stripe Tax settings',good:v.stripe?.taxSettings==='active',detail:v.stripe?.taxSettings==='pending'?`Pending: ${(v.stripe.missingTaxFields||[]).join(', ')||'complete business details'}`:`Status: ${v.stripe?.taxSettings||'unknown'}`},
   {title:'Shipping quote configuration',good:v.shipping?.configured===true,detail:v.shipping?.mode==='live_carrier'?'Live carrier setup':'Flat-rate shipping amount'},
   {title:'Tax approval',good:v.approvals?.taxApproved===true,detail:'Requires the owner to verify tax registration and collection settings'},
   {title:'Customer email delivery',good:v.email?.deliveryVerifiedByApp===true,detail:'Verify the Supabase redirect allowlist and confirmation/reset emails'},
   {title:'Checkout launch',good:v.checkout!=='preview_only',detail:v.checkout==='preview_only'?'Safely disabled pending launch approval':`Mode: ${v.checkout}`}
  ];
  el.innerHTML='<div class="readiness-grid">'+rows.map(r=>`<div class="readiness-row"><span class="readiness-state">${r.good?'Ready':'Needs review'}</span><strong>${esc(r.title)}</strong><small>${esc(r.detail)}</small></div>`).join('')+'</div><p class="readiness-note">Readiness is informational. No configuration, tax, carrier, or payment settings are changed here.</p>';
 }catch(ex){el.textContent=ex.message||'Launch readiness temporarily unavailable';}
}

function openDraft(o,type){
 const d=F?.draft(o,type,window.BURTON_CONFIG?.sellerEmail);
 if(!d)return status('Paid live order, valid email and saved shipment details required; resolve any outstanding exceptions.');
 const href='mailto:'+d.to+'?subject='+encodeURIComponent(d.subject)+'&body='+encodeURIComponent(d.body);
 if(href.length>1800){navigator.clipboard.writeText(d.body).then(()=>status('Long email draft copied. Address: '+d.to+' · Subject: '+d.subject+' · Send it manually.')).catch(()=>status('Draft too long for email app. Copy order details manually.'));return;}
 location.href=href;status('Email draft prepared in your mail app. Review and send manually; nothing has been sent by this website.');
}
function packingSlip(o){
 const content=`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Packing slip ${esc(o.id.slice(0,8))}</title><style>body{font:15px/1.6 system-ui;color:#111;max-width:770px;margin:35px auto;padding:20px}h1{font:normal 38px Georgia,serif;margin:0}h2{margin-top:28px;font-size:18px}small{color:#666}pre{font:inherit;white-space:pre-wrap}table{width:100%;border-collapse:collapse;margin:16px 0}th,td{border-bottom:1px solid #bbb;padding:10px;text-align:left}footer{margin-top:36px;border-top:1px solid #aaa;padding-top:12px}@media print{button{display:none}body{margin:0}}</style></head><body>
 <h1>Burton &amp; Found</h1><small>Books · Ephemera · Collectibles · History worth holding</small><p>356 Queen St. E. · Sault Ste. Marie, ON P6A 1Z1 · Canada</p>
 <h2>Packing slip · Order ${esc(o.id.slice(0,8))}</h2><p>Order date: ${esc(new Date(o.created_at).toLocaleDateString('en-CA'))}</p><h2>Ship to</h2><pre>${esc(address(o))}</pre>
 <h2>Contents</h2><table><thead><tr><th>SKU</th><th>Item</th><th>Qty</th></tr></thead><tbody>${(o.item_lines||[]).map(p=>`<tr><td>${esc(p.sku)}</td><td>${esc(p.title)}</td><td>1</td></tr>`).join('')}</tbody></table>
 <p>Carrier: ${esc(o.carrier||'To be confirmed')} · Tracking: ${esc(o.tracking_number||'To be confirmed')}</p><footer>Thank you for collecting with us · Please protect original paper from moisture and bending</footer><button onclick="window.print()">Print packing slip</button></body></html>`;
 const w=window.open('','_blank');if(!w){status('Pop-up blocked. Allow pop-ups to print a packing slip.');return;}w.opener=null;w.document.write(content);w.document.close();w.focus();
}
function csvCell(v){let s=String(v??'').replaceAll('\r',' ').replaceAll('\n',' ');if(/^[\s]*[=+\-@\t]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'}
function exportCsv(){
 if(!orders.length)return status('No orders to export');
 const cols=['Order ID','Created','Record mode','Payment status','Fulfillment','Customer','Email','Items','Subtotal CAD','Shipping CAD','Total CAD','Delivery address','Carrier','Tracking'];
 const data=filtered().map(o=>[o.id,o.created_at,o.record_mode||'unknown',o.payment_status,o.fulfillment_status,o.customer_name,o.email,(o.item_lines||[]).map(p=>p.sku+' - '+p.title).join('; '),(o.subtotal_cents/100).toFixed(2),(o.shipping_cents/100).toFixed(2),(o.total_cents/100).toFixed(2),address(o),o.carrier,o.tracking_number]);
 const csv='\ufeff'+[cols,...data].map(r=>r.map(csvCell).join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`burton-found-orders-${new Date().toISOString().slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 status('Private order register downloaded. Store it securely; it contains customer personal information.');
}
$('reload').addEventListener('click',refresh);
$('refreshReadiness').addEventListener('click',loadReadiness);$('exportCsv').addEventListener('click',exportCsv);
$('orderSort')?.addEventListener('change',render);$('statusFilter').addEventListener('change',render);$('orderSearch').addEventListener('input',render);
$('orders').addEventListener('submit',async e=>{
 if(!e.target.matches('form.form'))return;e.preventDefault();
 const o=orders.find(r=>r.id===e.target.closest('.order')?.dataset.id),f=new FormData(e.target),button=e.target.querySelector('[type="submit"]');if(!o)return;
 button.disabled=true;try{
  const v=await request('/api/admin/fulfill',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:o.id,status:f.get('status'),carrier:f.get('carrier'),tracking_number:f.get('tracking')})});
  const mode=o.record_mode;Object.assign(o,v.order);delete o.stripe_session_id;o.record_mode=mode;status('Shipment status saved. Remember to send the customer update manually.');render();
 }catch(ex){status(ex.message)}finally{button.disabled=false}
});
$('orders').addEventListener('click',async e=>{
 const btn=e.target.closest('[data-action]');if(!btn)return;const o=orders.find(r=>r.id===btn.closest('.order')?.dataset.id);if(!o)return;
 switch(btn.dataset.action){
  case 'resolve-shipping':{
   const note=btn.closest('.order').querySelector('[data-review-note]')?.value?.trim()||'';
   if(note.length<20)return status('Enter a detailed review note (20 characters minimum)');
   if(!confirm('I verified this paid order, available physical items, customer shipping address and final postage; continue?'))return;
   btn.disabled=true;
   try{const d=await request('/api/admin/review-shipping',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:o.id,note})});const mode=o.record_mode;Object.assign(o,d.order);delete o.stripe_session_id;o.record_mode=mode;status(d.notice||'Shipping review recorded');render();}
   catch(err){status(err.message);btn.disabled=false;}
   break;
  }
  case 'packing':if(o.record_mode!=='live')return status('Do not print real packing slips for sandbox or unknown orders.');if(!F?.shippingReady(o))return status('Verify paid status and resolve shipping/order exceptions before packing.');packingSlip(o);break;
  case 'address':if(o.record_mode!=='live')return status('Do not copy delivery addresses for sandbox or unknown orders.');try{await navigator.clipboard.writeText(address(o));status('Delivery address copied')}catch{status('Clipboard unavailable; select and copy the address manually')}break;
  case 'email':if(o.record_mode!=='live')return status('No customer email from a sandbox or unknown record.');if(!F?.ready(o))return status('Verify paid status and resolve exceptions before preparing customer emails.');
   openDraft(o,['shipped','delivered'].includes(o.fulfillment_status)?'dispatch':'confirmation');break;
  case 'confirmation':openDraft(o,'confirmation');break;
  case 'summary':{
   const html=F?.summary(o,window.BURTON_CONFIG?.sellerEmail);
   if(!html)return status('Paid live order must be verified before printing a summary.');
   const w=window.open('','_blank');if(!w)return status('Allow pop-ups to print or save the summary.');
   w.opener=null;w.document.write(html);w.document.close();w.focus();break;
  }
  case 'shipping-cost':{
   if(!F?.ready(o))return status('Verify paid live order first.');
   const panel=btn.closest('.order').querySelector('.shipping-cost-panel');if(!panel)return;
   if(!panel.hidden){panel.hidden=true;panel.replaceChildren();break;}
   panel.hidden=false;panel.innerHTML='<h3>Shipping contribution (CAD)</h3><p>Customer shipping charge: '+esc(dollars(o.shipping_cents))+' · Enter actual or quoted expenses. No estimate is implied.</p><div class="operations-form">'+['Postage','Packaging','Duties and customs fees','Other shipping expenses'].map((label,i)=>'<label>'+label+'<input type="number" min="0" step="0.01" inputmode="decimal" data-expense="'+i+'" placeholder="0.00"></label>').join('')+'</div><p role="status">Enter all four costs, including zero where applicable.</p><small>Local calculation only. Excludes item margin, payment fees and taxes; not stored or posted to bookkeeping.</small>';
   const result=panel.querySelector('[role="status"]'),inputs=[...panel.querySelectorAll('input')];
   panel.oninput=()=>{const vals=inputs.map(x=>F.parseCAD(x.value));const v=F.contribution(o.shipping_cents,...vals);result.textContent=v?'Total shipping expense '+dollars(v.costs)+' · '+(v.contribution<0?'Shipping shortfall ':'Shipping contribution ')+dollars(Math.abs(v.contribution)):'Enter all four costs, including zero where applicable.';};break;
  }
  case 'history':{
   const box=btn.closest('.order').querySelector('.history');if(!box.hidden){box.hidden=true;break;}
   box.textContent='Loading change history…';box.hidden=false;
   try{const d=await request('/api/admin/fulfillment-history?order_id='+encodeURIComponent(o.id));box.innerHTML=(d.events||[]).map(h=>`<p><strong>${esc(h.new_status.replaceAll('_',' '))}</strong> · ${esc(new Date(h.created_at).toLocaleString('en-CA'))} · ${esc(h.carrier)} ${esc(h.tracking_number)}</p>`).join('')||'<p>No changes recorded yet</p>'}catch(ex){box.textContent=ex.message}break;
  }
 }
});

function renderHolds(holds){
 $('holdsList').innerHTML=holds.length?holds.map(h=>`<div class="hold-line" data-hold="${esc(h.id)}"><div><strong>${esc((h.item_skus||[]).join(', '))}</strong><small>${esc(h.status)} · Created ${esc(new Date(h.created_at).toLocaleString('en-CA'))}</small><small>Stripe session: ${esc(h.stripe_session_id||'Not attached')}</small></div><button class="secondary" type="button" data-action="reconcile">Verify expiration with Stripe</button></div>`).join(''):'<p>No outstanding holds or manual reviews</p>';
}
async function loadHolds(){
 $('holdsList').textContent='Loading checkout holds…';try{const d=await request('/api/admin/holds');renderHolds(d.holds||[])}catch(e){$('holdsList').textContent=e.message}
}
$('loadHolds').addEventListener('click',loadHolds);
$('holdsList').addEventListener('click',async e=>{
 const btn=e.target.closest('[data-action="reconcile"]');if(!btn)return;
 const id=btn.closest('[data-hold]')?.dataset.hold;if(!id)return;
 btn.disabled=true;
 try{const d=await request('/api/admin/reconcile-hold',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});status(d.message||'Hold checked');await loadHolds();await refresh()}
 catch(err){status(err.message);btn.disabled=false;}
});

A.init().then(()=>{const initial=A.user()?.id||null;const leave=()=>{if((A.user()?.id||null)!==initial||A.recoveryState?.()!=='none'){$('dashboard').hidden=true;$('dashboard').replaceChildren();location.replace('/account');}};document.addEventListener('bf:auth-change',leave);document.addEventListener('bf:recovery-state',leave);window.addEventListener('pageshow',e=>{if(e.persisted){$('dashboard').hidden=true;location.reload();}});setTimeout(refresh,300);}).catch(()=>{$('loginHelp').hidden=false;status('Accounts not connected')});
})();
