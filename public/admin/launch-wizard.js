/* Planning only. No network writes, local storage, approval flags or payment controls. */
(()=>{
'use strict';
const repo='https://github.com/Harmart1/BurtonFound',project='https://supabase.com/dashboard/project/nyvdrgpcwfasajyncnhi';
const task=(id,title,steps,link,label)=>({id,title,steps,link,label});
function plan(scope='CA'){
 const rows=[
 task('contact','Verify customer email',['Send a test enquiry from the store and confirm you receive it.','Create a Google app password and enter it directly in Supabase SMTP. Never paste passwords into chat or GitHub.','Using a separate mailbox you control, register, follow the confirmation link, sign in and test password recovery.'],'https://supabase.com/dashboard/project/nyvdrgpcwfasajyncnhi/auth/smtp','Open SMTP settings'),
 task('stock','Confirm physical originals',['Download the inventory review. Start with a manageable selection of originals; verify condition, quantity, shared physical units and packaging. Return the completed SKU review for inclusion in the live checkout allowlist.','Keep unverified listings enquiry-only; flag missing or damaged pieces for controlled reconciliation.'],repo+'/actions/workflows/launch-inventory-audit.yml','Download current inventory review'),
 task('pack','Validate shipping costs',['Measure and weigh four representative protected parcels; obtain actual tracked postage quotes.','Compare postage and packaging with approved flat prices. Identify oversized, fragile and remote shipments needing individual review.'],'https://www.canadapost-postescanada.ca/cpc/en/tools/find-a-rate.page','Get real postage quotes'),
 task('tax','Confirm seller and tax treatment',['Confirm the legal seller identity, business contact and appropriate return address.','Review GST/HST small-supplier eligibility and other applicable sales tax obligations using actual business-wide taxable supplies; do not activate tax just because Stripe Tax settings are active.'],'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/when-register-charge.html','Read CRA guidance'),
 task('policies','Approve customer terms',['Confirm shipping service, dispatch estimates, returns, damage and cancellation procedures, and correct contact information.','Review the checkout disclosures and order-summary process against the actual business practices.'],'/policies/shipping-returns.html','Review shipping and returns'),
 ];
 if(scope==='CA,US')rows.push(task('us','Verify US customs and delivery',['Check current carrier rules, actual country of manufacture, item classification and value; obtain a representative duty and postage calculation.','Confirm who bears duties and fees and how they are disclosed before ordering. Do not enable the US gate until verified.'],repo+'/blob/main/COMMERCIAL_LAUNCH_FLAT_RATE.md','Review cross-border procedure'));
 rows.push(task('stripe','Prepare controlled Stripe production cutover',['Review verified merchant and sandbox evidence. Obtain separate live API credentials and create the appropriate live event destination only in a controlled cutover.','Do not replace working sandbox keys prematurely. Verify live webhook delivery, tax/stock/shipping gates and rollback steps. The isolated sandbox tests did not prove real hosted checkout event delivery.'],repo+'/blob/main/STRIPE_PAYMENT_LAUNCH_2026.md','Open payment launch instructions'),
 task('approve','Review final launch decision',['Review all evidence and any remaining limitations with your technical assistant.','Explicitly authorize the proposed launch scope separately before any checkout or indexing switch is changed. Checking this box is only a planning note, not authorization.'],repo+'/issues/16','Open tracked launch checklist'));
 return rows;
}
function checks(v={},config={}){
 const flat=v.shipping?.flatRates||{},approvals=v.approvals||{};
 const prices=flat.approved===true&&flat.CA?.standard===1995&&flat.CA?.express===3495&&flat.US?.standard===2995&&flat.US?.express===4995;
 const closed=v.checkout==='preview_only'&&v.approvals?.checkoutEnabled===false&&v.approvals?.livePaymentApproved===false;
 return [
 {label:'Checkout locked',ok:closed,detail:closed?'Preview only; payment switches off.':'Not confirmed; stop and review.'},
 {label:'Database connection',ok:v.supabase?.connected===true,detail:'Authenticated readiness response; not physical stock proof. Live-approved SKUs: '+(Number.isInteger(v.supabase?.approvedLiveSkuCount)?v.supabase.approvedLiveSkuCount:'not checked')+'.'},
 {label:'Approved flat prices',ok:prices,detail:'Canada $19.95 / $34.95; US $29.95 / $49.95 CAD.'},
 {label:'Contact address configured',ok:typeof config.sellerEmail==='string'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.sellerEmail),detail:'Configuration only; actual delivery requires testing.'},
 {label:'US checkout remains blocked',ok:v.shipping?.crossBorderCheckoutApproved===false&&v.shipping?.canadaPostUsDutiesApproved===false,detail:'Canada is the initial selling territory; US expansion requires a separate configuration change and customs approvals.'},
 ...[['Physical inventory approval','physicalStockApproved'],['Domestic postage approval','domesticPostageVerified'],['Customer email delivery approval','customerEmailDeliveryApproved'],['Seller terms approval','sellerTermsApproved'],['Production webhook approval','productionWebhookReady']].map(([label,key])=>({label,ok:approvals[key]===true,detail:approvals[key]===true?'Owner approval flag recorded; verify evidence separately.':'Required before live checkout; not approved.'}))
 ];
}
const evidence=[
 ['Hosting and 215-test deployment','https://github.com/Harmart1/BurtonFound/actions/runs/46102798177'],
 ['Isolated Stripe sandbox test, payment and refund','https://github.com/Harmart1/BurtonFound/actions/runs/46095017815'],
 ['Stock and shipping review','https://github.com/Harmart1/BurtonFound/actions/runs/46103351849'],
 ['Stock-checked marketing drafts','https://github.com/Harmart1/BurtonFound/actions/runs/46103317297']
];
function report(scope,done,v,config){
 const rows=plan(scope);
 return ['Burton & Found — launch planning notes','Scope: '+(scope==='CA,US'?'Canada and US (subject to customs verification)':'Canada first; US deferred'),'Planning only; NOT authorization to enable payments or change settings.','Current diagnostic: '+String(v.checkout||'unknown'),...checks(v,config).map(c=>'- '+(c.ok?'Confirmed configuration: ':'Review: ')+c.label),...rows.map(r=>'- '+(done.has(r.id)?'Owner marked reviewed (not independently verified): ':'Outstanding: ')+r.title),'Historical evidence: '+evidence.map(x=>x.join(' — ')).join('; ')].join('\n');
}
function render(v,el,config={}){
 if(!el)return;
 // No checklist persistence: this is a session-local planning aid, not an approval record.
 let scope='CA',index=0,done=new Set();
 el.replaceChildren();
 const make=(tag,t)=>{const x=document.createElement(tag);if(t)x.textContent=t;return x;};
 const button=(t,f)=>{const b=make('button',t);b.type='button';b.className='secondary';b.addEventListener('click',f);return b;};
 const current=make('div');current.className='wizard-checks';
 for(const c of checks(v,config)){const p=make('p');p.append(make('strong',(c.ok?'Confirmed configuration: ':'Review: ')+c.label),make('span',c.detail));current.append(p);}
 const label=make('label','Proposed launch scope');label.htmlFor='wizardScope';
 const select=make('select');select.id='wizardScope';
 for(const [val,t] of [['CA','Canada first (recommended; defer US)'],['CA,US','Canada and United States (customs required)']]){const op=make('option',t);op.value=val;select.append(op);}
 const step=make('div');step.className='wizard-step';const progress=make('p');progress.setAttribute('role','status');
 const bar=make('progress');bar.setAttribute('aria-label','Owner reviewed steps');
 const nav=make('div');nav.className='toolbar-buttons';
 const prev=button('Previous',()=>{index--;draw();}),next=button('Next',()=>{index++;draw();});
 const copyResult=make('p');copyResult.setAttribute('role','status');
 const copy=button('Copy launch review notes',async()=>{try{await navigator.clipboard.writeText(report(scope,done,v,config));copyResult.textContent='Copied planning notes. No settings changed.';}catch{copyResult.textContent='Clipboard unavailable. Use Download planning notes.';}});
 const download=button('Download planning notes',()=>{const url=URL.createObjectURL(new Blob([report(scope,done,v,config)],{type:'text/plain;charset=utf-8'}));const a=make('a');a.href=url;a.download='burton-found-launch-review.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 nav.append(prev,next,copy,download);
 const refs=make('details');refs.append(make('summary','Earlier successful automation reports (historical evidence)'));
 const ul=make('ul');for(const [t,url] of evidence){const li=make('li'),a=make('a',t);a.href=url;a.target='_blank';a.rel='noopener noreferrer';li.append(a);ul.append(li);}refs.append(ul);
 function draw(){
  const rows=plan(scope);index=Math.max(0,Math.min(index,rows.length-1));const r=rows[index],count=rows.filter(x=>done.has(x.id)).length;
  progress.textContent='Step '+(index+1)+' of '+rows.length+' · '+count+' owner-marked reviewed. Not an approval or verification.';
  bar.max=rows.length;bar.value=count;prev.disabled=index===0;next.disabled=index===rows.length-1;
  step.replaceChildren(make('h3',r.title));const ol=make('ol');for(const t of r.steps)ol.append(make('li',t));step.append(ol);
  const a=make('a',r.label);a.href=r.link;a.target='_blank';a.rel='noopener noreferrer';step.append(a);
  const l=make('label');l.className='wizard-tick';const box=make('input');box.type='checkbox';box.checked=done.has(r.id);box.addEventListener('change',()=>{if(box.checked)done.add(r.id);else done.delete(r.id);const n=rows.filter(x=>done.has(x.id)).length;bar.value=n;progress.textContent='Step '+(index+1)+' of '+rows.length+' · '+n+' owner-marked reviewed. Not an approval or verification.';});l.append(box,document.createTextNode(' I have reviewed this step (planning only).'));step.append(l);
 }
 select.addEventListener('change',()=>{scope=select.value;index=0;done=new Set();copyResult.textContent='Scope changed; review checklist restarted.';draw();});
 el.append(make('p','Owner-selected launch plan: Canada first. The US scope below is for future planning only. Live payments remain disabled until separate authorization.'),current,label,select,progress,bar,step,nav,copyResult,refs,make('p','Checklist resets when readiness is refreshed or the page is reloaded. Download notes before leaving. No settings, payments, tax registrations or stock are changed.'));
 draw();
}
window.BURTON_LAUNCH_WIZARD=Object.freeze({plan,checks,report,render});
})();
