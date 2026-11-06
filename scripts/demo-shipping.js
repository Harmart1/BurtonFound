/* OFFLINE DEMO ONLY: invented carrier rates, checkout always disabled. */
(()=>{'use strict';
 const realFetch=window.fetch.bind(window);
 const response=(obj,status=200)=>Promise.resolve(new Response(JSON.stringify(obj),{status,headers:{'Content-Type':'application/json'}}));
 const daysAfter=(n)=>{const d=new Date();let r=n;while(r>0){d.setDate(d.getDate()+1);if(d.getDay()!==0&&d.getDay()!==6)r--;}return d.toISOString().slice(0,10);};
 window.fetch=(request,init={})=>{
  const url=typeof request==='string'?request:(request?.url||'');
  if(url==='/api/health')return response({checkout:'preview_only',shippingMode:'live_carrier',shippingCountries:['CA','US','GB','AU','DE','FR','JP'],currency:'CAD',note:'Offline demo — no actual carrier connection'});
  if(url==='/api/catalog')return response({configured:false,items:[]});
  if(url==='/api/shipping-quotes'){
   let body={};try{body=JSON.parse(init.body||'{}')}catch{}
   const d=body.destination||{};
   if(!Array.isArray(body.skus)||!body.skus.length)return response({error:'Add an item to your paper bag first'},400);
   if(!d.city||!d.postal)return response({error:'Enter a destination city and postal code'},400);
   const internationally=d.country!=='CA';
   const options=[
    {carrier:'Canada Post — SAMPLE',code:'SAMPLE.STANDARD',name:'Illustrative tracked service · not a live quote',amount_cents:internationally?2876:1234,currency:'CAD',estimated_date:daysAfter(internationally?11:6),guaranteed:false,quote_token:'offline-fictitious-no-payment'},
    {carrier:'FedEx — SAMPLE',code:'SAMPLE.EXPRESS',name:'Illustrative express service · not a live quote',amount_cents:internationally?5432:2678,currency:'CAD',estimated_date:daysAfter(internationally?5:3),guaranteed:false,quote_token:'offline-fictitious-no-payment'}
   ];
   return response({options,ship_date:daysAfter(2),expires_in_seconds:600,currency:'CAD',disclaimer:'Illustrative sample rates and dates, not actual Canada Post or FedEx quotes. Payment is disabled.'});
  }
  if(url==='/api/checkout')return response({error:'This is a non-transactional preview. No checkout or payment is available.'},503);
  return realFetch(request,init);
 };
})();
