/* Owner-only launch command centre. Consumes the existing authenticated
 * /api/admin/readiness response; never sends secrets or changes any settings.
 * "Configured" means a local flag or credential is present, NOT a verified
 * merchant account, physical collectible, tax registration, or real postage. */
(()=>{'use strict';
 const rootRepo='https://github.com/Harmart1/BurtonFound';
 const links=Object.freeze({
  issue:rootRepo+'/issues/16',
  stock:rootRepo+'/actions/workflows/launch-inventory-audit.yml',
  test:rootRepo+'/actions/workflows/stripe-payment-readiness.yml',
  bank:'https://dashboard.stripe.com/account',
  tax:'https://dashboard.stripe.com/tax',
  cloudflare:'https://dash.cloudflare.com/',
  canada:'https://developer-developpeur.canadapost-postescanada.ca/devportal-portaildesdeveloppeurs/',
  fedex:'https://developer.fedex.com/',
  ship:rootRepo+'/blob/main/COMMERCIAL_LAUNCH_FLAT_RATE.md',
  parcels:rootRepo+'/actions/workflows/launch-inventory-audit.yml',
  supabase:'https://supabase.com/dashboard/project/nyvdrgpcwfasajyncnhi/auth/smtp',
  launch:rootRepo+'/blob/main/STRIPE_PAYMENT_LAUNCH_2026.md'
 });
 const goodEmail=x=>typeof x==='string'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.trim());
 const number=x=>Number.isInteger(x)&&x>=0?x:null;
 const item=(id,title,status,detail,action,url)=>({id,title,status,detail,action,url});
 function build(v={},configuration={},hostname='burtonfound.timharmar.workers.dev'){
  const count=number(v?.supabase?.listings),remaining=count===null?null:Math.max(0,229-count);
  const stockDetail=count===null?'Database could not be checked; download the latest SKU reconciliation.':
   count+' database SKUs against the 229-listing launch baseline. '+
   (remaining?remaining+' published listings have no matching checkout SKU; the automobile designs remain enquiry-only until physically verified.':
    'All SKUs are represented, but physical condition and ownership still require seller review.');
  const cp=v?.shipping?.canadaPost||{},fedex=v?.shipping?.fedex||{};
  const flat=v?.shipping?.flatRates||{},fmt=c=>Number.isSafeInteger(c)&&c>0?'CAD '+(c/100).toFixed(2):'not configured';
  const cpVerified=cp.credentialsPresent===true&&cp.productionRatesVerified===true&&cp.testApp===false;
  const fxVerified=fedex.credentialsPresent===true&&fedex.productionRatesVerified===true&&fedex.sandbox===false;
  const payoutFlag=v?.approvals?.payoutsVerifiedByOwner===true;
  const taxFlag=v?.approvals?.taxApproved===true;
  const urlIsCustom=typeof hostname==='string'&&hostname&&!/\.workers\.dev$/i.test(hostname);
  const items=[
   item('stock','Physical inventory & catalogue','attention',stockDetail,
      'Review item-by-item inventory',links.stock),
   item('stripe','Stripe test credentials','attention',
      v?.stripe?.sandboxKeyPresent&&v?.stripe?.webhookSigningKeyPresent
       ?'A test API key and webhook secret are present. Their pairing and the API key’s validity must be checked separately. Expected merchant ID: '+(v.stripe.expectedMerchantConfigured?'configured':'missing')+'.'
       :'The test API key or webhook signing secret is missing; presence alone does not verify live payment readiness.',
      'Run safe Stripe readiness audit',links.test),
   item('payouts','Stripe identity & payouts',payoutFlag?'review':'attention',
      payoutFlag?'Owner payout approval flag is set; confirm Stripe still permits payouts.':
        'Historical Stripe inspection found charges and payouts enabled. Reconfirm before final owner approval; the production payout gate is intentionally off.',
      'Review Stripe verification',links.bank),
   item('tax','Sales tax decision',taxFlag&&v?.stripe?.taxSettings==='active'?'review':'attention',
      'Stripe Tax state: '+(v?.stripe?.taxSettings||'unknown')+
      '. Owner tax approval: '+(taxFlag?'recorded':'not recorded')+
      '. Confirm legal registrations and the appropriate treatment for Canada and the U.S.',
      'Review Stripe Tax',links.tax),
   item('flat-rate','Canada and U.S. flat-rate prices',flat.approved?'review':'attention',
      'Canada standard '+fmt(flat.CA?.standard)+' / express '+fmt(flat.CA?.express)+'; U.S. standard '+fmt(flat.US?.standard)+' / express '+fmt(flat.US?.express)+
      '. '+(flat.approved?'Price approval recorded; verify packaging and customs.':'Draft amounts only; no public payable flat rates until merchant approval.'),
      'Review flat-rate launch plan',links.ship),
   item('canada-post','Canada Post live rates (optional for flat-rate launch)',v?.shipping?.mode==='flat_rate'?'deferred':cpVerified?'review':'attention',
      'Credentials: '+(cp.credentialsPresent?'present':'missing')+
      ' · Production rate review: '+(cp.productionRatesVerified?'flagged approved':'not approved')+
      ' · Test app: '+(cp.testApp?'yes':'no or not reported')+'.',
      'Open Canada Post Developer Portal',links.canada),
   item('fedex','FedEx live rates (optional for flat-rate launch)',v?.shipping?.mode==='flat_rate'?'deferred':fxVerified?'review':'attention',
      'Credentials: '+(fedex.credentialsPresent?'present':'missing')+
      ' · Production rate review: '+(fedex.productionRatesVerified?'flagged approved':'not approved')+
      ' · Sandbox: '+(fedex.sandbox?'yes':'no or not reported')+'.',
      'Open FedEx Developer Portal',links.fedex),
   item('parcels','Verified protective packaging','attention',
      v?.shipping?.verifiedPackagesAvailable
        ?'At least one parcel profile is flagged measured. Confirm every purchasable item and supported bundle has a real packed profile.'
        :'No verified packed parcel profile is configured for live carrier pricing. Use actual measured kilograms and centimetres.',
      'Get parcel worksheet',links.parcels),
   item('customs','U.S. duties & declarations',
      v?.shipping?.crossBorderCheckoutApproved&&v?.shipping?.canadaPostUsDutiesApproved?'review':'attention',
      'U.S. checkout approval: '+(v?.shipping?.crossBorderCheckoutApproved?'flag set':'not approved')+
      ' · Canada Post U.S. duty workflow: '+(v?.shipping?.canadaPostUsDutiesApproved?'flag set':'not approved')+
      '. Postage estimates are not landed-cost estimates.',
      'Review cross-border shipping steps',links.ship),
   item('email','Business email & customer confirmations','attention',
      'Seller contact: '+(goodEmail(configuration?.sellerEmail)?'address configured (deliverability not verified)':'not configured')+
      '. Confirmation and password-reset email delivery: '+(v?.email?.deliveryVerifiedByApp?'owner check recorded':'not verified')+'.',
      'Check Supabase email and redirects',links.supabase),
   item('domain','Business domain & public launch',urlIsCustom?'review':'attention',
      urlIsCustom?'Custom hostname detected; DNS, HTTPS, canonical links and mailbox still require verification.':
        'The website is on workers.dev. A branded domain, working support email and policy approval remain outstanding.',
      'Review Cloudflare domain settings',links.cloudflare),
  ];
  const checkout=String(v.checkout||'unknown');
  return {
   items,
   actionCount:items.filter(x=>x.status==='attention').length,
   reviewCount:items.filter(x=>x.status==='review').length,
   deferredCount:items.filter(x=>x.status==='deferred').length,
   checkout,
   storefrontBaseline:229,
   backendListings:count,
   headline:checkout==='preview_only'
    ?'Payments are safely disabled while launch steps are completed.'
    :checkout==='test_mode'
      ?'Sandbox checkout appears enabled. No real-money tests should be assumed complete.'
      :'Recheck payment switches and approvals before accepting customers.'
  };
 }
 function render(v,el,escapeHtml){
  if(!el||typeof escapeHtml!=='function')return;
  const m=build(v,window.BURTON_CONFIG||{},location.hostname);
  el.innerHTML='<div class="launch-overview" role="status">'+
    '<strong>'+escapeHtml(m.headline)+'</strong>'+
    '<p>'+escapeHtml(m.actionCount+' areas need owner action; '+m.reviewCount+' require independent verification; '+m.deferredCount+' optional carrier integrations are deferred.')+'</p>'+
    '<p class="launch-small">Read-only diagnostic. No merchant approval, tax registration, carrier rate, original stock, payment, or customer email is verified solely by this page.</p>'+
    '</div>'+
    '<div class="launch-actions">'+
    '<a href="'+links.issue+'" target="_blank" rel="noopener noreferrer">Open tracked launch checklist</a>'+
    '<a href="'+links.stock+'" target="_blank" rel="noopener noreferrer">Download inventory reconciliation</a>'+
    '<button type="button" id="copyLaunchTasks" class="secondary">Copy outstanding tasks</button>'+
    '<span id="copyLaunchResult" aria-live="polite"></span></div>'+
    '<div class="readiness-grid">'+m.items.map(x=>
      '<article class="readiness-row"><span class="readiness-state launch-state-'+x.status+'">'+
      escapeHtml(x.status==='attention'?'Needs owner action':x.status==='deferred'?'Optional — deferred':'Verify externally')+'</span>'+
      '<strong>'+escapeHtml(x.title)+'</strong><small>'+escapeHtml(x.detail)+'</small>'+
      '<a target="_blank" rel="noopener noreferrer" href="'+x.url+'">'+escapeHtml(x.action)+'</a></article>'
    ).join('')+'</div>'+
    '<p class="readiness-note">No setup controls are exposed here. GitHub reports and provider dashboards remain the sources of record for approvals.</p>';
  const button=el.querySelector('#copyLaunchTasks'),result=el.querySelector('#copyLaunchResult');
  button?.addEventListener('click',async()=>{
   const text='Burton & Found launch checklist\n'+m.items.filter(x=>x.status==='attention')
     .map(x=>'- '+x.title+': '+x.detail+'\n  '+x.url).join('\n');
   try{
    if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');
    await navigator.clipboard.writeText(text);
    if(result)result.textContent='Copied checklist.';
   }catch{if(result)result.textContent='Clipboard unavailable; use the GitHub launch tracker.';}
  });
 }
 window.BURTON_LAUNCH_READINESS=Object.freeze({build,render});
})();
