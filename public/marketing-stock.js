/* Product page stock status: read-only, progressive enhancement.
 * Never authorize payment or trust browser data for checkout.
 */
(()=>{
'use strict';
async function update(){
 const info=document.querySelector('[data-bf-stock-sku]');
 const cards=[...document.querySelectorAll('[data-bf-card-sku]')];
 if(!info&&!cards.length)return;
 const sku=info?.getAttribute('data-bf-stock-sku');
 try{
  const response=await fetch('/api/catalog',{cache:'no-store',headers:{accept:'application/json'}});
  if(!response.ok)return;
  const data=await response.json();
  if(data?.configured!==true||!Array.isArray(data.items))return;
  const records=new Map(data.items.map(x=>[x.sku,x]));
  for(const card of cards){const row=records.get(card.getAttribute('data-bf-card-sku'));const status=card.querySelector('[data-bf-card-status]'),price=card.querySelector('[data-bf-card-price]');if(!row)continue;
   if(status){status.textContent=row.checkout_eligible===true?(row.available?'Available · Canadian checkout':'Sold or reserved'):'Check availability';status.classList.toggle('mk-enquiry',row.checkout_eligible!==true);}
   if(price&&Number.isSafeInteger(row.price_cents)&&row.price_cents>0)price.textContent=new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(row.price_cents/100)+' CAD';
  }
  if(!info)return;
  const record=records.get(sku);
  if(!record)return;
  const status=document.querySelector('[data-bf-availability]');
  const link=document.querySelector('[data-bf-shop-link]');
  const price=document.querySelector('[data-bf-price]');
  if(status)status.textContent=record.checkout_eligible===true?(record.available?'Available for Canadian checkout':'Sold or reserved'):record.available?'Available to enquire':'Check availability with the shop';
  if(link&&record.checkout_eligible===true&&record.available)link.textContent='View in the shop / add to bag';
  if(record.checkout_eligible===true&&!record.available&&link){
    link.href='/collections/'+(/^(VA-|BF-VA-)/.test(sku)?'automobiles':sku.startsWith('OH-')||sku.startsWith('OHS-')?'hollywood':'coca-cola')+'.html';
    link.textContent='Browse other available finds';
  }
  if(price&&Number.isInteger(record.price_cents)&&record.price_cents>0){
    const value=new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(record.price_cents/100);
    price.textContent=value;
  }
 }catch{
  // Continue to present honest enquiry-only status if the API is offline.
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',update,{once:true});
else update();
document.addEventListener('visibilitychange',()=>{if(!document.hidden)update()});
})();
