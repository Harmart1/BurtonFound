(()=>{
  'use strict';
  const D=window.BURTON_DATA||{inventory:[],archive:[]};
  const C=window.BURTON_CONFIG||{};
  const items=D.inventory||[];
  const archive=D.archive||[];
  const bySku=new Map(items.map(p=>[p.sku,p]));
  const byArchive=new Map(archive.map(p=>[p.id,p]));
  const $=id=>document.getElementById(id);
  const money=n=>new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(Number(n)||0);
  const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  let currentFilter='all', currentSort='featured', currentDecade='all', currentCollection='all', search='';
  let selectedProduct=null,selectedImage=0;
  let cartReturnFocus=null;
  let bag=[];
  try {bag=JSON.parse(localStorage.getItem('burton_found_bag')||'[]');if(!Array.isArray(bag))bag=[];}catch{bag=[];}
  bag=[...new Set(bag.filter(s=>bySku.has(s)&&!bySku.get(s)?.cmsOnly))];
  const saveBag=(fromAccount=false)=>{shippingRequestId++;activeShippingQuote=null;liveOptions=[];const e=document.getElementById('shippingResults');if(e)e.textContent='Bag changed · Compare rates again for an accurate estimate';const t=document.getElementById('shippingEstimateTotal');if(t)t.hidden=true;try{localStorage.setItem('burton_found_bag',JSON.stringify(bag));}catch{}if(!fromAccount)window.BURTON_ACCOUNT?.saveActiveBag?.(bag);};
  window.BURTON_STORE_API={getBag:()=>[...bag],setBag:(next)=>{bag=[...new Set((next||[]).filter(id=>bySku.has(id)&&!bySku.get(id)?.cmsOnly))];saveBag(true);renderProducts();renderCart();}};
  let toastTimer;
  function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3800);}
  let checkoutReady=false,checkoutMode='preview_only',inventoryConnected=false,shippingMode='flat_rate',allowedShippingCountries=['CA'];
  let activeShippingQuote=null,liveOptions=[],shippingRequestId=0;
  const needsVerification=p=>p?.requiresVerification===true||p?.availableForCheckout===false;
  const bagNeedsVerification=()=>bag.some(id=>needsVerification(bySku.get(id)));
  const bagHasOverlappingUnits=()=>{
    const chosen=new Set();
    for(const id of bag){const p=bySku.get(id);if(!p)continue;
      for(const unit of p.catalogIds||[id]){if(chosen.has(unit))return true;chosen.add(unit);}
    }return false;
  };
  const isCheckoutReady=()=>checkoutReady&&bag.length&&!bagNeedsVerification()&&!bagHasOverlappingUnits()&&bag.every(id=>!bySku.get(id)?.cmsOnly&&bySku.get(id)?.stockState!=='unavailable');
  async function loadLiveStatus(){
    try {
      const health=await fetch('/api/health',{cache:'no-store'});
      if(health.ok){const v=await health.json();checkoutMode=v.checkout||'preview_only';shippingMode=v.shippingMode||'flat_rate';checkoutReady=['test_mode','live_mode','configured'].includes(checkoutMode);allowedShippingCountries=Array.isArray(v.shippingCountries)?v.shippingCountries:['CA'];const menu=$('shipCountry');if(menu){for(const opt of menu.options){opt.disabled=!allowedShippingCountries.includes(opt.value);}if(!allowedShippingCountries.includes(menu.value)){menu.value=allowedShippingCountries.find(c=>[...menu.options].some(o=>o.value===c))||'CA';}}}else{checkoutReady=false;checkoutMode='preview_only';}
      const res=await fetch('/api/catalog',{cache:'no-store'});
      if(res.ok){const v=await res.json();if(v.configured&&Array.isArray(v.items)){
        inventoryConnected=true;for(const row of v.items){const p=bySku.get(row.sku);if(!p||p.cmsOnly||needsVerification(p))continue;
          if(Number.isInteger(row.price_cents))p.price=row.price_cents/100;
          p.stockState=row.available?'available':'unavailable';
        }
      }}
    }catch(e){checkoutReady=false;checkoutMode='preview_only';console.info('Live commerce unavailable; preview browsing remains enabled.');}
    await loadPublishedCms();
    setPreview();renderProducts();renderCart();
  }

  /* Published editorial overrides. CMS-only products always remain non-sale previews.
     Backend bf_products stock and price are authoritative for existing purchasable SKUs. */
  let cmsAnnouncement=null;
  async function loadPublishedCms(){
    try{
      const response=await fetch('/api/cms/published',{cache:'no-store'});
      if(!response.ok)return;
      const body=await response.json();
      if(!Array.isArray(body.entries))return;
      for(const entry of body.entries){
        const d=entry.data||{};
        if(entry.kind==='product'){
          let p=bySku.get(entry.key);
          if(!p){
            p={sku:entry.key,type:'original',title:'',shortDescription:'',images:[],image:'',
              price:0,collection:'collectibles',catalogIds:[],year:null,theme:'New catalogue preview',
              stockState:'unavailable',cmsOnly:true,condition:'Not yet verified',status:'preview'};
            items.push(p);bySku.set(entry.key,p);
          }
          if(typeof d.title==='string')p.title=d.title;
          if(typeof d.shortDescription==='string')p.shortDescription=d.shortDescription;
          if(typeof d.description==='string')p.cmsLongDescription=d.description;
          if(typeof d.image==='string'&&d.image){p.image=d.image;p.images=[d.image]}
          if(typeof d.condition==='string')p.condition=d.condition;
          if(typeof d.year==='number'||d.year===null)p.year=d.year;
          if(p.cmsOnly&&typeof d.collection==='string')p.collection=d.collection;
          if(typeof d.priceCAD==='number'&&!inventoryConnected)p.price=d.priceCAD;
          if(p.cmsOnly)p.stockState='unavailable';
        }else if(entry.kind==='page'&&entry.key==='home'){
          const h=document.querySelector('.lead-intro h1'),p=document.querySelector('.lead-intro > p');
          if(h&&d.headline)h.textContent=d.headline;
          if(p&&d.body)p.textContent=d.body;
        }else if(entry.kind==='page'&&entry.key==='announcement'){
          if(!cmsAnnouncement){
            cmsAnnouncement=document.createElement('aside');
            cmsAnnouncement.className='cms-announcement';
            cmsAnnouncement.setAttribute('role','note');
            document.querySelector('main')?.prepend(cmsAnnouncement);
          }
          cmsAnnouncement.replaceChildren();
          const strong=document.createElement('strong');strong.textContent=d.headline||'Store update';
          const span=document.createElement('span');span.textContent=d.body||'';
          cmsAnnouncement.append(strong,span);
        }
      }
    }catch(e){console.info('Editorial updates unavailable; showing saved catalogue.')}
  }
  const dateText=p=>p.collection==='hollywood'?(p.dateLabel||'Printing date unverified'):String(p.year||'Date unverified');
  const itemHasDecade=(p,d)=>d==='all'||(!p.cmsOnly&&(p.type==='bundle'?(p.catalogIds||[]).some(id=>Math.floor(Number(byArchive.get(id)?.year||0)/10)*10===Number(d)):Math.floor(Number(p.year||0)/10)*10===Number(d)));
  function setPreview(){const el=$('setupNotice');const testing=checkoutMode==='test_mode';el.hidden=(!C.showPreviewNotice&&checkoutMode!=='test_mode')||(checkoutReady&&!testing);el.textContent=testing?'STRIPE TEST MODE · Demonstration checkout only · No real money is charged. Use Stripe test card details, never a real card.':'Card checkout is currently unavailable · Save items to your bag or request a purchase enquiry.';}
  function renderProducts(){
    let list=items.filter(p=>(currentFilter==='all'||p.type===currentFilter)&&(currentCollection==='all'||p.collection===currentCollection)&&itemHasDecade(p,currentDecade)&&(!search||[p.title,p.year,p.sku,p.shortDescription,p.theme,(p.catalogIds||[]).join(' ')].join(' ').toLowerCase().includes(search)));
    if(currentSort==='featured'){
      const orders=window.BURTON_FEATURED?.orders||{};
      const priority=orders[currentCollection+':'+currentFilter]||orders[currentCollection+':all']||orders['all:'+currentFilter]||orders['all:all']||[];
      const rank=new Map(priority.map((sku,i)=>[sku,i]));
      list.sort((a,b)=>{
        const unavailable=Number(a.stockState==='unavailable')-Number(b.stockState==='unavailable');
        const verification=Number(needsVerification(a))-Number(needsVerification(b));
        return unavailable||verification||((rank.get(a.sku)??999)-(rank.get(b.sku)??999));
      });
    }
    if(currentSort==='low')list.sort((a,b)=>a.price-b.price);
    if(currentSort==='high')list.sort((a,b)=>b.price-a.price);
    if(currentSort==='oldest')list.sort((a,b)=>(a.year||9999)-(b.year||9999));
    if(currentSort==='newest')list.sort((a,b)=>(b.year||0)-(a.year||0));
    // Preserve the requested sort within availability groups; never prioritize a sold item.
    if(currentSort!=='featured')list.sort((a,b)=>Number(a.stockState==='unavailable')-Number(b.stockState==='unavailable'));
    // Counts reflect the selected collection, era and search instead of stale HTML numbers.
    const countPool=items.filter(p=>(currentCollection==='all'||p.collection===currentCollection)&&itemHasDecade(p,currentDecade)&&(!search||[p.title,p.year,p.sku,p.shortDescription,p.theme,(p.catalogIds||[]).join(' ')].join(' ').toLowerCase().includes(search)));
    for(const tab of document.querySelectorAll('.tab[data-filter]')){
      const el=tab.querySelector('span');
      if(el)el.textContent=String(countPool.filter(p=>p.type===tab.dataset.filter).length);
    }
    $('productGrid').innerHTML=list.map(p=>{
      let badge=p.collection==='automobiles'?(p.type==='bundle'?p.catalogIds.length+' AUTOMOBILE PRINTS · CURATED SET':'VINTAGE AUTOMOBILE ADVERTISING'):p.cmsOnly&&p.collection==='hollywood'?(p.draftDuplicate?'ALTERNATE SCAN · REVIEW':p.type==='bundle'?`${p.catalogIds.length} SCANS · CURATED SET`:'NEW HOLLYWOOD FIND · PREVIEW'):p.type==='bundle'?`${p.catalogIds.length} PIECES · ONE SET`:p.collection==='hollywood'?'CLASSIC FILM EPHEMERA':'VINTAGE COCA-COLA AD';
      let watched=!!window.BURTON_ACCOUNT?.isWatching?.(p.sku);
      let cat=p.collection==='automobiles'?'AUTOMOBILES · '+(p.type==='bundle'?'CURATED SET':p.brand||'VINTAGE CAR'):p.cmsOnly&&p.collection==='hollywood'?('OLD HOLLYWOOD · '+(p.type==='bundle'?'CURATED SET':p.theme)):p.type==='bundle'?'CURATED SET':p.collection==='hollywood'?'OLD HOLLYWOOD · '+(p.issue&&p.issue!=='Unknown'&&p.issue!=='Publication unconfirmed'?p.issue:'PRINT DATE UNVERIFIED'):`${p.year} · VINTAGE ADVERTISING`;
      return `<article class="product-card" data-sku="${safe(p.sku)}">
        <button class="product-media" type="button" data-view="${safe(p.sku)}" aria-label="View ${safe(p.title)} details"><span class="media-kicker">${safe(p.cmsOnly&&p.collection==='hollywood'?badge:p.cmsOnly?'COMING SOON · PREVIEW':p.stockState==='unavailable'?'SOLD OR RESERVED':needsVerification(p)?'INDICATIVE PRICE · VERIFY STOCK':badge)}</span><img src="${safe(p.image)}" alt="${safe(p.shortDescription)}" loading="lazy" decoding="async" width="800" height="900"><span class="media-view" aria-hidden="true">↗</span></button><button class="product-watch ${watched?'watch-active':''}" type="button" data-watch="${safe(p.sku)}" aria-pressed="${watched}" aria-label="${watched?'Remove from':'Add to'} watchlist: ${safe(p.title)}" title="${watched?'Remove from watchlist':'Watch this find'}">${watched?'♥':'♡'}</button>
        <div class="product-info"><p class="product-meta">${safe(cat)}</p><h3 class="product-title">${safe(p.title)}</h3><p class="product-desc">${safe(p.shortDescription).replace(/[.\s]+$/,'')}.</p><div class="product-price-row"><div class="product-price">${p.cmsOnly&&p.draftDuplicate?'Alternate scan · unpriced':p.cmsOnly||needsVerification(p)?'Indicative '+money(p.price)+' CAD':money(p.price)+' CAD'}</div><button class="add-small" type="button" data-add="${safe(p.sku)}" ${p.cmsOnly||bag.includes(p.sku)||p.stockState==='unavailable'?'disabled':''}>${p.cmsOnly?'STOCK REVIEW':p.stockState==='unavailable'?'UNAVAILABLE':bag.includes(p.sku)?'IN YOUR BAG':'ADD TO BAG'}</button></div></div></article>`;
    }).join('');
    $('noResults').hidden=!!list.length;
    const empty=$('emptyShopCopy');if(empty)empty.textContent=currentCollection==='books'?'The vintage books department is being catalogued. No books are listed for purchase yet. Browse existing finds or save your interest in your collector profile.':currentCollection==='collectibles'?'The collectibles department is being curated. No objects are listed for purchase yet. Browse the current archive or save your interest in your collector profile.' :currentCollection==='automobiles'?'No automobile print designs match these filters. Clear the filters to browse all 80 pictured advertisements and 18 curated sets.':'No treasures match that search.';
    $('catalogCount').textContent=list.length+' of '+items.length+' catalogue products · CAD';
    $('shopStatus').textContent=(currentDecade!=='all'||currentFilter!=='all'||currentCollection!=='all'||search)?'Showing '+list.length+' matching catalogue products.':'Browse vintage advertising, Old Hollywood and automobile print designs. Automobile prices are indicative; physical stock must be verified.';
  }
  function addItem(sku){
    const p=bySku.get(sku);if(!p)return;
    if(p.cmsOnly){toast('This product is awaiting stock review. Save it to your watchlist.');return;}
    if(p.stockState==='unavailable'){toast('This product is sold or reserved.');return;}
    if(bag.includes(sku)){toast('Already in your paper bag.');return;}
    const units=new Set(p.catalogIds||[sku]);
    const conflict=bag.map(id=>bySku.get(id)).find(existing=>existing&&(existing.catalogIds||[existing.sku]).some(unit=>units.has(unit)));
    if(conflict){toast('A selected item is already included in '+conflict.title+'. Remove that item or set first.');return;}
    bag.push(sku);saveBag();renderProducts();renderCart();
    toast(needsVerification(p)?'Added for an availability enquiry. Physical stock and final price must be confirmed.':'A good find! Added to your paper bag.');
  }
  function removeItem(sku){bag=bag.filter(s=>s!==sku);saveBag();renderProducts();renderCart();}
  function openCart(){
    if($('cartDrawer').classList.contains('open'))return;
    const active=document.activeElement;
    cartReturnFocus=active&&active!==document.body&&typeof active.focus==='function'?active:null;
    renderCart();
    $('scrim').hidden=false;$('cartDrawer').classList.add('open');
    $('cartDrawer').setAttribute('aria-hidden','false');
    document.body.classList.add('no-scroll');
    $('cartClose').focus();
  }
  function closeCart(){
    if(!$('cartDrawer').classList.contains('open'))return;
    $('scrim').hidden=true;$('cartDrawer').classList.remove('open');
    $('cartDrawer').setAttribute('aria-hidden','true');
    document.body.classList.remove('no-scroll');
    const previous=cartReturnFocus;
    cartReturnFocus=null;
    const target=previous?.isConnected&&previous.getClientRects?.().length?previous:$('cartOpen');
    target?.focus();
  }
  function renderCart(){
    $('cartCount').textContent=bag.length;$('cartHeaderCount').textContent=`(${bag.length})`;
    $('cartSubtotal').textContent=money(bag.reduce((s,id)=>s+(bySku.get(id)?.price||0),0));
    $('cartItems').innerHTML=bag.length?bag.map(id=>{
      const p=bySku.get(id);
      return `<div class="cart-item"><img src="${safe(p.image)}" alt=""><div><small>${safe(p.collection==='automobiles'?'VINTAGE AUTOMOBILE · VERIFY STOCK':p.type==='bundle'?'CURATED SET':p.collection==='hollywood'?'OLD HOLLYWOOD EPHEMERA':'ORIGINAL · '+p.year)}</small><strong>${safe(p.title)}</strong><small>${safe(p.sku)} · Qty 1</small><button type="button" data-remove="${safe(p.sku)}">Remove</button></div><b>${needsVerification(p)?'Indicative '+money(p.price):money(p.price)}</b></div>`;
    }).join(''):`<div class="cart-empty"><span>✳</span><h3>Your bag is a blank page.</h3><p>A good find is just around the corner.</p><button type="button" class="btn btn-outline" id="bagBrowse">Explore the shelves ↗</button></div>`;
    const enquiryOnly=bagNeedsVerification();
    const b=$('checkoutButton');b.disabled=!bag.length||bagHasOverlappingUnits()||bag.some(sku=>bySku.get(sku)?.stockState==='unavailable')||(checkoutReady&&!enquiryOnly&&shippingMode==='live_carrier'&&!activeShippingQuote);
    const estimator=$('shippingEstimator');if(estimator)estimator.hidden=!bag.length||enquiryOnly||shippingMode!=='live_carrier';
    if(enquiryOnly){
      $('cartSubtotal').textContent='Indicative '+money(bag.reduce((n,id)=>n+(bySku.get(id)?.price||0),0));
      b.innerHTML=(C.sellerEmail?'Email availability request':'Copy availability request')+' <span>↗</span>';
      $('checkoutHelp').textContent='Automobile prints and proposed sets may be added for a no-obligation enquiry. Physical stock, final price, condition and shipping must be confirmed. No payment or reservation occurs.';
    }
    else if(checkoutReady){b.innerHTML=(checkoutMode==='test_mode'?'Stripe test checkout':'Secure checkout with Stripe')+' <span>↗</span>';$('checkoutHelp').textContent=checkoutMode==='test_mode'?'TEST MODE ONLY · No real payments. Use Stripe test card details.':shippingMode==='live_carrier'?'Select a shipping quote, then enter the SAME destination at Stripe checkout. Different details will hold your paid order for review.':'Shipping and any configured taxes are shown before payment. Inventory is checked again securely.';}
    else if(C.sellerEmail){b.innerHTML='Email a purchase request <span>↗</span>';$('checkoutHelp').textContent='Online payment is not yet available. We will confirm availability and shipping before proceeding.';}
    else {b.innerHTML='Copy purchase request <span>↗</span>';$('checkoutHelp').textContent='Online payments are not enabled. You may save your bag or copy a purchase request; no payment is taken.';}
    if(bagHasOverlappingUnits())$('checkoutHelp').textContent='Two selections contain the same pictured page. Remove one selection before proceeding.';
    else if(bag.some(sku=>bySku.get(sku)?.stockState==='unavailable'))$('checkoutHelp').textContent='An item in your bag is sold or reserved. Remove it before checking out.';
  }
  function drawShippingOptions(data){
    liveOptions=data.options||[];activeShippingQuote=null;
    const target=$('shippingResults');if(!target)return;
    if(!liveOptions.length){target.textContent='No live services available for this address';return;}
    target.innerHTML='<p class="shipping-quote-date">Quoted dispatch: '+safe(data.ship_date||'To be confirmed')+' · Carrier estimates, not guarantees</p>'+liveOptions.map((o,i)=>`<label class="shipping-choice"><input type="radio" name="carrierOption" value="${i}" ${i===0?'checked':''}><span><strong>${safe(o.carrier)} · ${safe(o.name)}</strong><small>${o.estimated_date?'Carrier-estimated delivery '+safe(o.estimated_date):o.transit_days?'About '+o.transit_days+' business days in transit':'Carrier did not supply a delivery date'} · Tracked service</small></span><b>${money(o.amount_cents/100)}</b></label>`).join('');
    const select=(i)=>{activeShippingQuote=liveOptions[i]?.quote_token||null;const total=$('shippingEstimateTotal');total.hidden=!activeShippingQuote;if(activeShippingQuote)total.textContent='Items + selected shipping (before any checkout taxes): '+money(bag.reduce((s,id)=>s+(bySku.get(id)?.price||0),0)+(liveOptions[i].amount_cents/100));renderCart();};
    select(0);target.querySelectorAll('[name=carrierOption]').forEach(input=>input.addEventListener('change',()=>select(Number(input.value))));
  }
  async function getShippingQuote(e){
    e.preventDefault();if(!bag.length||bagNeedsVerification())return;
    activeShippingQuote=null;liveOptions=[];renderCart();
    const requestId=++shippingRequestId;const target=$('shippingResults');target.textContent='Checking available services with the carriers…';
    const form=e.currentTarget;
    const destination={country:form.elements.country.value,postal:form.elements.postal.value,city:form.elements.city.value,state:form.elements.state.value};
    try{const resp=await fetch('/api/shipping-quotes',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({skus:bag,destination})});const data=await resp.json();if(requestId!==shippingRequestId)return;if(!resp.ok)throw Error(data.error||'Live rates unavailable');drawShippingOptions(data);}
    catch(err){if(requestId!==shippingRequestId)return;target.textContent=err.message||'Rates unavailable · Contact the shop for a shipping quote';renderCart();}
  }
  async function handleCheckout(){
    if(!bag.length||bagHasOverlappingUnits())return;
    if(checkoutReady&&!bagNeedsVerification()){
      if(bag.some(id=>bySku.get(id)?.stockState==='unavailable')){toast('Please remove unavailable items first.');return;}
      const btn=$('checkoutButton');btn.disabled=true;btn.textContent='Connecting securely…';
      try {
        const token=await window.BURTON_ACCOUNT?.authToken?.();
        const response=await fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({skus:bag,...(shippingMode==='live_carrier'?{shipping_quote:activeShippingQuote}:{})})});
        const data=await response.json();if(!response.ok||!/^https:\/\/checkout\.stripe\.com\//.test(data.url||''))throw Error(data.error||'Checkout unavailable');
        location.assign(data.url);return;
      }catch(e){toast(e.message||'Checkout unavailable. No payment taken.');await loadLiveStatus();}
      finally{btn.disabled=false;renderCart();}
      return;
    }
    let lines=bag.map(s=>{let p=bySku.get(s);return `${p.sku} — ${p.title} — ${money(p.price)}${needsVerification(p)?' (indicative; stock not verified)':''}`;});
    const msg=`Hello Burton & Found,\n\nI'm interested in the following original paper items:\n\n${lines.join('\n')}\n\nIndicative subtotal: ${money(bag.reduce((s,id)=>s+bySku.get(id).price,0))} CAD (excluding shipping/taxes).\n\nPlease confirm physical inventory, condition, final asking prices and shipping before any payment. This is a non-binding enquiry and not a reservation.\n\nThank you.`;
    if(C.sellerEmail){window.location.href=`mailto:${encodeURIComponent(C.sellerEmail)}?subject=${encodeURIComponent('Vintage paper purchase enquiry')}&body=${encodeURIComponent(msg)}`;toast('Your email app will open. No payment has been taken.');return;}
    try{await navigator.clipboard.writeText(msg);toast('Purchase request copied. Add a seller email to enable sending enquiries.');}catch{
      const ta=document.createElement('textarea');ta.value=msg;ta.style.cssText='position:fixed;left:-9999px';document.body.appendChild(ta);ta.select();try{document.execCommand('copy');toast('Purchase request copied to clipboard.');}catch{toast('Configure a seller email in config.js to accept enquiries.');}ta.remove();
    }
  }
  function galleryImages(p){return p.type==='bundle'?[p.image,...p.images]:p.images;}
  function renderDetailImage(){if(!selectedProduct)return;const imgs=galleryImages(selectedProduct);const hero=$('detailHeroImage');if(!hero)return;hero.src=imgs[selectedImage];hero.alt=selectedProduct.type==='bundle'?`Photo ${selectedImage+1} of ${selectedProduct.catalogIds.length+1} in ${selectedProduct.title}`:selectedProduct.shortDescription;document.querySelectorAll('[data-thumb]').forEach(b=>{b.classList.toggle('active',Number(b.dataset.thumb)===selectedImage);b.setAttribute('aria-pressed',Number(b.dataset.thumb)===selectedImage?'true':'false');});}
  function openDetails(sku,focusArchiveId){
    const p=bySku.get(sku);if(!p)return;selectedProduct=p;const imgs=galleryImages(p);selectedImage=focusArchiveId&&p.type==='bundle'?Math.max(0,p.catalogIds.indexOf(focusArchiveId)+1):0;
    const hollywood=p.collection==='hollywood',automobile=p.collection==='automobiles';
    const extra=p.memberDetails?
      `<section class="bf-native-hollywood-members"><h3>Curated set contents</h3><p>This collector set includes ${p.memberDetails.length} catalogued paper pieces. Photographs of each item are shown below.</p><div class="bf-native-members-grid">${p.memberDetails.map(m=>`<a href="index.html?item=${encodeURIComponent(m.sku)}#shop"><img src="${safe(m.image)}" alt="" loading="lazy" width="72" height="95"><span>${safe(m.title)}<small>${safe(m.sku)}</small></span></a>`).join('')}</div></section>`:
      p.type==='bundle'?`<p>This set contains ${p.catalogIds.length} separately catalogued printed-paper pieces. Included catalogue IDs: ${safe(p.catalogIds.join(', '))}.</p>`:
      p.memberOfSet?`<p><a class="bf-native-set-link" href="old-hollywood-new.html#sets">Browse the curated Old Hollywood sets</a></p>`:'';
    const dateLabel=hollywood||automobile?safe(p.dateLabel||'Print date unverified'):safe(p.year||p.issue);
    const headerLabel=automobile?'VINTAGE AUTOMOBILES · '+p.sku:hollywood?'OLD HOLLYWOOD · '+p.sku:p.type==='bundle'?'CURATED ORIGINALS · '+p.sku:'VINTAGE ADVERTISEMENT · '+p.sku;
    const availability=p.cmsOnly?'Not yet listed':p.stockState==='unavailable'?'Sold or reserved':needsVerification(p)?'Physical stock to verify · enquiry only':checkoutReady?'In stock · checked at checkout':'Available · enquire to arrange purchase';
    const priceQualifier=p.cmsOnly?'<small>CAD · ENQUIRE</small>':needsVerification(p)?'<small>INDICATIVE CAD · CONFIRM BEFORE PURCHASE</small>':hollywood?'<small>CAD · ASKING PRICE</small>':'<small>CAD · ORIGINAL PRINTED PAPER</small>';
    $('productDetails').innerHTML=`<div class="detail-media"><img class="detail-hero-img" id="detailHeroImage" src="${safe(imgs[selectedImage])}" alt="${safe(p.shortDescription)}" width="1050" height="1394"><button type="button" class="detail-zoom" id="detailZoom" aria-label="Enlarge photograph of ${safe(p.title)}">⤢ View larger photo</button><div class="detail-strip">${imgs.length>1?imgs.map((img,i)=>`<button type="button" class="thumb-btn ${i===selectedImage?'active':''}" data-thumb="${i}" aria-pressed="${i===selectedImage}" aria-label="View photograph ${i+1}"><img src="${safe(img)}" alt="Photo ${i+1}"></button>`).join(''):''}</div></div><div class="detail-copy"><p class="eyebrow small">${safe(headerLabel)}</p><h2>${safe(p.title)}</h2><div class="detail-price">${p.cmsOnly&&p.draftDuplicate?'Alternate scan · not separately priced':money(p.price)} ${priceQualifier}</div><p class="detail-intro">${safe(p.shortDescription).replace(/[.\s]+$/,'')}.</p>${extra}<dl class="detail-grid"><div><dt>DATE / PERIOD</dt><dd>${dateLabel}</dd></div><div><dt>CONDITION</dt><dd>${safe(p.condition)}</dd></div><div><dt>PHYSICAL FORMAT</dt><dd>${safe(p.edition)}</dd></div><div><dt>AVAILABILITY</dt><dd>${availability}</dd></div></dl><div class="detail-note"><strong>CONDITION DETAILS.</strong> ${safe(p.conditionNotes||p.condition||'Condition information available on request.')} Measurements and reverse-side photographs may be requested.</div><div class="detail-purchase"><a class="detail-product-link" href="${safe(window.BURTON_PRODUCT_LINKS?.[p.sku]||'index.html?item='+encodeURIComponent(p.sku)+'#shop')}">View &amp; share product page ↗</a><button class="detail-watch" type="button" data-watch="${safe(p.sku)}" aria-pressed="${!!window.BURTON_ACCOUNT?.isWatching?.(p.sku)}">${window.BURTON_ACCOUNT?.isWatching?.(p.sku)?'♥ Watching this find':'♡ Add to watchlist'}</button><button type="button" class="btn btn-dark detail-add" id="detailAdd" ${p.cmsOnly||bag.includes(p.sku)||p.stockState==='unavailable'?'disabled':''}>${p.cmsOnly?'Awaiting stock verification':p.stockState==='unavailable'?'Currently unavailable':bag.includes(p.sku)?'Already in your paper bag':'Add to the paper bag'} <span>↗</span></button><p class="detail-smallprint">${p.cmsOnly?'This is an editorial product listing with a suggested price. Authentication, dimensions, exact condition, quantity and any overlapping scans must be confirmed before sale.':needsVerification(p)?'Research-based indicative price only. The physical page, ownership, condition, dimensions and exact printing date remain unverified. Adding to the bag is an enquiry, not a reservation.':hollywood?'Review the listed date, format and condition details for this piece.':'Actual vintage magazine advertisements shown; sold unframed.'} ${p.cmsOnly?'Save this find to your watchlist to revisit it.':'Request confirmation of condition, shipping, and availability before paying.'}</p></div></div>`;
    $('productDialog').showModal();renderDetailImage();
  }
  function info(section){
    // Route legacy information actions to the current standalone policy documents.
    if(['shipping','terms','privacy'].includes(section)){
      const slug=section==='shipping'?'shipping-returns':section;
      window.BURTON_POLICY?.open(slug);
      return;
    }
    let texts={
      shipping:['Shipping & returns',`<p>We aim to ship original paper items flat, in a protective sleeve with strong rigid backing and weather protection. Measured parcel shipping charges and carrier delivery estimates appear in the bag when connected. Final address details are collected at Stripe Checkout and must match the shipping quote. Our orders are packed and dispatched manually with tracking.</p><p>Exact dispatch times, shipping locations, insurance and returns terms must be confirmed by the store owner before the site is published. Consumer rights under applicable law are not limited by this draft.</p><p>Ask for additional condition photographs before purchasing, especially for older or fragile paper.</p>`],
      condition:['Our condition guide',`<p><strong>Very good:</strong> the image and text are complete, with some ordinary handling marks, gentle toning or worn edges.</p><p><strong>Good:</strong> visible age-related wear such as staining, edge damage, folds or pencil marks, disclosed in the listing.</p><p>Condition information is based on the photographed item. Ask for additional views and measurements when needed.</p>`],
      privacy:['Privacy at Burton & Found',`<p>The shop lets guests keep a bag and watchlist in their own browser. When you register for a customer account after the owner enables Supabase, account details, saved addresses, saved bags and watched items are stored securely in Supabase with per-user access rules. Age range, collecting interests and marketing preferences are optional. You can edit, export or request removal of account information via My Account. Uploaded Paper Trail Lab photographs stay in the visitor’s browser; they are not included in their account.</p><p>Burton &amp; Found accounts and Stripe checkout are separate systems: signing in here does not automatically sign you into the payment provider. Stripe handles secure card payment and address collection. Burton & Found stores order and shipping records in its private database. This draft disclosure must be completed with the merchant’s real contact, retention periods and cross-border processing details before launch.</p>`],
      contact:['Get in touch',`<p>Seller contact has not been configured in this preview. Before publishing, add the owner's preferred business email to <code>config.js</code>. Visitors will then be able to request availability and additional photographs by email.</p>`],
      terms:['Terms of sale — draft',`<p>Prices are shown in Canadian dollars unless otherwise noted. Coca-Cola items are vintage magazine advertisements. Hollywood items may have unverified printing dates or processes, as disclosed in each listing. Items are sold unframed except the complete magazine, which is sold as an intact issue. Please review the date, format and condition details in each product listing; contact the shop for measurements or additional photographs.</p><p>The current site is a working storefront preview; no purchase is completed here until Stripe checkout is connected. When connected, the applicable taxes, shipping rates, payment process and consumer cancellation rights will be explained at checkout.</p><p><strong>Owner action required:</strong> finalize actual business identity, contact information, shipping and returns terms and a jurisdiction-appropriate privacy policy before public sales.</p>`]
    };
    const t=texts[section];if(!t)return;$('infoContent').innerHTML=`<p class="eyebrow small">BURTON & FOUND</p><h2>${t[0]}</h2>${t[1]}`;$('infoDialog').showModal();
  }
  function renderArchive(){
    const allocation=new Map();items.forEach(p=>p.catalogIds.forEach(id=>allocation.set(id,p)));
    $('archiveGrid').innerHTML=archive.map(a=>{
      let p=allocation.get(a.id);return `<button type="button" class="archive-item" data-archive="${safe(a.id)}"><img src="${safe(a.photo)}" alt="${safe(a.description)}" loading="lazy"><span><strong>${safe(a.id)} · ${a.collection==='hollywood'?'HOLLYWOOD':a.year}</strong><br>${safe(a.title)}</span><small>${a.collection==='hollywood'?'Film/print details in listing':p?.type==='bundle'?'In '+p.title:'Single original'} ↗</small></button>`;
    }).join('');
  }
  function init(){
    $('copyrightYear').textContent=new Date().getFullYear();setPreview();renderProducts();renderCart();renderArchive();loadLiveStatus();
    // Deep-link directly from Paper Trail matches into an existing product detail.
    // Only SKU identifiers present in this catalogue can open a product.
    try {const linked=new URLSearchParams(window.location.search).get('item');if(linked&&bySku.has(linked))openDetails(linked);} catch {}
    function selectFilter(type){currentFilter=type;document.querySelectorAll('.tab').forEach(b=>{const selected=b.dataset.filter===type;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));});}
    function selectCollection(name,listingType='all'){currentCollection=name;currentDecade='all';$('decadeFilter').value='all';$('collectionFilter').value=name;selectFilter(listingType);renderProducts();}
    // Shareable product/collection links can also open the automobile shelf and bag.
    try {
      const params=new URLSearchParams(window.location.search),requested=params.get('collection');
      if(['hollywood','coca-cola','automobiles'].includes(requested))selectCollection(requested);
      const toAdd=params.get('add');
      if(toAdd&&bySku.has(toAdd)&&bySku.get(toAdd).collection==='automobiles'){
        addItem(toAdd);setTimeout(openCart,0);
      }else if(params.get('bag')==='open')setTimeout(openCart,0);
    }catch{}
    document.querySelectorAll('.tab').forEach(button=>button.addEventListener('click',()=>{selectFilter(button.dataset.filter);renderProducts();}));
    $('collectionFilter').addEventListener('change',e=>{currentCollection=e.target.value;renderProducts();});
    document.querySelectorAll('[data-shop-hollywood]').forEach(el=>el.addEventListener('click',()=>selectCollection('hollywood')));
    document.querySelectorAll('[data-shop-hollywood-sets]').forEach(el=>el.addEventListener('click',()=>selectCollection('hollywood','bundle')));
    document.querySelectorAll('[data-shop-coke]').forEach(el=>el.addEventListener('click',()=>selectCollection('coca-cola')));
    document.querySelectorAll('[data-shop-automobiles]').forEach(el=>el.addEventListener('click',()=>selectCollection('automobiles')));
    document.querySelectorAll('[data-shop-bundles]').forEach(link=>link.addEventListener('click',()=>selectCollection('coca-cola','bundle')));
    $('catalogSort').addEventListener('change',e=>{currentSort=e.target.value;renderProducts();});
    $('decadeFilter').addEventListener('change',e=>{currentDecade=e.target.value;renderProducts();});
    document.querySelectorAll('[data-era]').forEach(button=>button.addEventListener('click',()=>{currentDecade=button.dataset.era;currentCollection='all';$('collectionFilter').value='all';selectFilter('all');$('decadeFilter').value=currentDecade;renderProducts();$('shop').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});}));
    $('catalogSearch').addEventListener('input',e=>{search=e.target.value.trim().toLowerCase();renderProducts();});
    $('clearSearch').addEventListener('click',()=>{search='';currentDecade='all';currentCollection='all';$('collectionFilter').value='all';$('decadeFilter').value='all';$('catalogSearch').value='';selectFilter('all');renderProducts();});
    $('searchOpen').addEventListener('click',()=>{$('shop').scrollIntoView({behavior:'auto'});$('catalogSearch').focus({preventScroll:true});});
    $('productGrid').addEventListener('click',e=>{const watched=e.target.closest('[data-watch]');if(watched){window.BURTON_ACCOUNT?.toggleWatch?.(watched.dataset.watch);return;}const btn=e.target.closest('[data-view],[data-add]');if(!btn)return;if(btn.dataset.view)openDetails(btn.dataset.view);else addItem(btn.dataset.add);});
    $('archiveGrid').addEventListener('click',e=>{const btn=e.target.closest('[data-archive]');if(!btn)return;const a=btn.dataset.archive;const p=items.find(p=>p.catalogIds.includes(a));if(p)openDetails(p.sku,a);});
    $('archiveToggle').addEventListener('click',e=>{let open=$('archiveGrid').hidden;$('archiveGrid').hidden=!open;e.currentTarget.setAttribute('aria-expanded',String(open));e.currentTarget.innerHTML=open?'Hide the full archive <span aria-hidden="true">↑</span>':`View all ${archive.length} archive entries <span aria-hidden="true">↓</span>`;});
    $('cartOpen').addEventListener('click',openCart);
    document.addEventListener('bf:watch-change',()=>{document.querySelectorAll('[data-watch]').forEach(btn=>{const liked=window.BURTON_ACCOUNT?.isWatching?.(btn.dataset.watch)||false;btn.classList.toggle('watch-active',liked);btn.setAttribute('aria-pressed',String(liked));const p=bySku.get(btn.dataset.watch);if(btn.classList.contains('product-watch')){btn.textContent=liked?'♥':'♡';btn.setAttribute('aria-label',`${liked?'Remove from':'Add to'} watchlist: ${p?.title||''}`);btn.title=liked?'Remove from watchlist':'Watch this find';}else btn.textContent=liked?'♥ Watching this find':'♡ Add to watchlist';});const n=document.getElementById('watchCount');if(n)n.textContent=window.BURTON_ACCOUNT?.watchCount?.()||0;});
    document.addEventListener('bf:auth-change',()=>{const signedIn=!!window.BURTON_ACCOUNT?.user?.()?.email;const label=document.getElementById('accountNavLabel');if(label)label.textContent=signedIn?'MY ACCOUNT':'SIGN IN';const c=document.querySelector('.account-create-header');if(c)c.hidden=signedIn;const a=document.querySelector('.account-header-link');if(a)a.href=signedIn?'account.html':'account.html#signin';});$('cartClose').addEventListener('click',closeCart);$('scrim').addEventListener('click',closeCart);
    $('cartItems').addEventListener('click',e=>{if(e.target.closest('[data-remove]'))removeItem(e.target.closest('[data-remove]').dataset.remove);if(e.target.closest('#bagBrowse')){closeCart();$('shop').scrollIntoView({behavior:'smooth'});}});
    $('checkoutButton').addEventListener('click',handleCheckout);
    $('shippingForm')?.addEventListener('submit',getShippingQuote);
    $('shippingForm')?.addEventListener('input',()=>{shippingRequestId++;if(activeShippingQuote||liveOptions.length){activeShippingQuote=null;liveOptions=[];$('shippingResults').textContent='Destination changed · Compare rates again';$('shippingEstimateTotal').hidden=true;renderCart();}});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadLiveStatus()});
    $('saveBagButton').addEventListener('click',async()=>{if(!bag.length){toast('First add a vintage find to your bag.');return;}const title=prompt('Name this saved bag:', 'My vintage favourites');if(title===null)return;try{await window.BURTON_ACCOUNT?.saveNamedBag(title,bag);toast(window.BURTON_ACCOUNT?.user()?.id?'Bag saved to your collector account.':'Saved to this browser only. Create an account to sync it.');}catch(e){toast('Could not save bag: '+e.message);}});
    $('productClose').addEventListener('click',()=>$('productDialog').close());
    $('zoomClose').addEventListener('click',()=>$('zoomDialog').close());
    $('zoomDialog').addEventListener('click',e=>{if(e.target===$('zoomDialog'))$('zoomDialog').close();});
    $('productDetails').addEventListener('click',e=>{if(e.target.closest('[data-watch]')){window.BURTON_ACCOUNT?.toggleWatch?.(e.target.closest('[data-watch]').dataset.watch);return;}if(e.target.closest('#detailZoom')){let big=$('detailHeroImage');$('zoomImage').src=big.src;$('zoomImage').alt=big.alt;$('zoomDialog').showModal();}if(e.target.closest('[data-thumb]')){selectedImage=Number(e.target.closest('[data-thumb]').dataset.thumb);renderDetailImage();}if(e.target.closest('#detailAdd')){let sku=selectedProduct?.sku;$('productDialog').close();addItem(sku);openCart();}});
    $('infoClose').addEventListener('click',()=>$('infoDialog').close());document.querySelectorAll('[data-info]').forEach(b=>b.addEventListener('click',()=>info(b.dataset.info)));
    $('contactButton').addEventListener('click',()=>{if(C.sellerEmail){window.location.href=`mailto:${encodeURIComponent(C.sellerEmail)}?subject=${encodeURIComponent('Burton & Found enquiry')}`;}else info('contact');});


    document.addEventListener('keydown',e=>{
      const drawer=$('cartDrawer');
      if(!drawer.classList.contains('open'))return;
      if(e.key==='Escape'){e.preventDefault();closeCart();return;}
      if(e.key!=='Tab')return;
      const focusable=[...drawer.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')]
        .filter(el=>!el.closest('[hidden]')&&el.getClientRects().length);
      if(!focusable.length){e.preventDefault();drawer.focus();return;}
      const first=focusable[0],last=focusable[focusable.length-1];
      if(e.shiftKey&&(document.activeElement===first||document.activeElement===drawer)){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
      else if(!drawer.contains(document.activeElement)){e.preventDefault();(e.shiftKey?last:first).focus();}
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
