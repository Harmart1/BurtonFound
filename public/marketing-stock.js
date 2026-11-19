/* Product page stock status: read-only, progressive enhancement.
 * Never authorize payment or trust browser data for checkout.
 */
(()=>{
'use strict';
async function update(){
 const info=document.querySelector('[data-bf-stock-sku]');
 if(!info)return;
 const sku=info.getAttribute('data-bf-stock-sku');
 try{
  const response=await fetch('/api/catalog',{cache:'no-store',headers:{accept:'application/json'}});
  if(!response.ok)return;
  const data=await response.json();
  if(data?.configured!==true||!Array.isArray(data.items))return;
  const record=data.items.find(x=>x.sku===sku);
  if(!record)return;
  const status=document.querySelector('[data-bf-availability]');
  const link=document.querySelector('[data-bf-shop-link]');
  const price=document.querySelector('[data-bf-price]');
  if(status)status.textContent=record.available?'Available to enquire':'Sold or reserved';
  if(!record.available&&link){
    link.href='/collections/'+(sku.startsWith('OH-')||sku.startsWith('OHS-')?'hollywood':'coca-cola')+'.html';
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
})();
