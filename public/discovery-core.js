/* Catalogue-based discovery; no analytics, storage, tracking or network calls. */
(()=>{
'use strict';
const collection=p=>({'coca-cola':'Coca-Cola',hollywood:'Old Hollywood',automobiles:'Vintage automobiles',books:'Books',collectibles:'Collectibles'}[p?.collection]||'Other finds');
const tokenSet=p=>new Set([p?.theme,...(Array.isArray(p?.tags)?p.tags:[])].filter(x=>typeof x==='string').join(' ').toLowerCase().split(/[^a-z0-9]+/).filter(x=>x.length>=3&&!['the','and','vintage','advertising','original','collection','curated','paper','set'].includes(x)));
const units=p=>Array.isArray(p?.catalogIds)&&p.catalogIds.length?p.catalogIds:[p?.sku];
const overlap=(p,q)=>units(p).some(x=>units(q).includes(x));
const enquiry=p=>p?.requiresVerification===true||p?.availableForCheckout===false||p?.stockState==='verification_required';
function stockMap(body){
 if(body?.configured!==true||!Array.isArray(body.items))return null;
 const m=new Map();
 for(const r of body.items){if(typeof r?.sku!=='string'||m.has(r.sku)||typeof r.available!=='boolean'||!Number.isSafeInteger(r.price_cents)||r.price_cents<0)return null;m.set(r.sku,r);}
 return m;
}
function state(p,stock){
 if(p?.cmsOnly)return {kind:'unknown',label:'Awaiting catalogue review',price:p.price};
 const r=stock?.get(p?.sku);
 // Explicit server approval overrides the historical enquiry-only catalogue flag.
 if(r?.checkout_eligible===true)return {kind:r.available?'available':'unavailable',label:r.available?'Available for Canadian checkout':'Sold or reserved',price:r.price_cents/100};
 if(enquiry(p))return {kind:'enquiry',label:'Enquiry only',price:p.price};
 if(!r)return {kind:'unknown',label:'Stock not confirmed',price:p.price};
 if(r.checkout_eligible===false&&r.available)return {kind:'enquiry',label:'Enquiry only',price:r.price_cents/100};
 return {kind:r.available?'available':'unavailable',label:r.available?'Available to enquire':'Sold or reserved',price:r.price_cents/100};
}
function recommendations(products,seeds,stock,limit=4,extraExcluded=[]){
 const selected=seeds.filter(Boolean),excluded=new Set([...selected.map(p=>p.sku),...extraExcluded]);
 const blocked=products.filter(p=>excluded.has(p.sku));
 const scored=[];
 for(const p of products){
  if(!p?.sku||excluded.has(p.sku)||p.cmsOnly||!Number.isFinite(p.price)||p.price<=0||blocked.some(q=>overlap(p,q)))continue;
  const s=state(p,stock);
  if(s.kind==='unavailable')continue;
  // Don't introduce unrelated unverified designs when there are actual matching seeds.
  if(s.kind==='enquiry'&&!selected.some(q=>q.collection===p.collection))continue;
  const t=tokenSet(p);
  let best=0,why='Explore another collection';
  for(const q of selected){
   const same=q.collection===p.collection,shared=[...tokenSet(q)].filter(x=>t.has(x)).length;
   const near=Number.isFinite(p.year)&&Number.isFinite(q.year)&&Math.abs(p.year-q.year)<=10;
   const score=(same?20:0)+Math.min(shared,5)*4+(near?5:0)+(p.type===q.type?2:0);
   if(score>best){best=score;why=same?'Same collection':shared?'Related subject':near?'Similar era':'Another find to explore';}
  }
  if(selected.length&&best<10)continue;
  scored.push({p,state:s,why,score:best+(s.kind==='available'?3:0)});
 }
 scored.sort((a,b)=>b.score-a.score||a.p.sku.localeCompare(b.p.sku));
 const result=[];
 if(!selected.length)return result;
 for(const r of scored){if(result.some(x=>overlap(x.p,r.p)))continue;result.push(r);if(result.length>=limit)break;}
 return result;
}
function watchlist(products,ids,stock,filter='all',query=''){
 const map=new Map(products.map(p=>[p.sku,p])),q=String(query).trim().toLowerCase();
 return [...new Set(ids)].map(sku=>map.get(sku)).filter(Boolean).map(p=>({p,state:state(p,stock)}))
 .filter(x=>(filter==='all'||x.state.kind===filter)&&(!q||[x.p.title,x.p.sku,collection(x.p),x.p.theme,x.p.year].join(' ').toLowerCase().includes(q)));
}
function bagBlock(p,bag,products,stock){
 if(!p||p.cmsOnly)return 'Listing is awaiting review';
 if(state(p,stock).kind==='unavailable')return 'This item is sold or reserved';
 if(bag.includes(p.sku))return 'Already in your bag';
 const conflict=products.find(q=>bag.includes(q.sku)&&overlap(p,q));
 return conflict?'This original overlaps with '+conflict.title+'. Remove the existing selection first.':'';
}
window.BURTON_DISCOVERY=Object.freeze({stockMap,state,recommendations,watchlist,bagBlock,collection});
})();
