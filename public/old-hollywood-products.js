/* Burton & Found: unify catalogued Old Hollywood scans with standard store product model.
 * Safe release: these are editorial product records for watchlists and display ONLY.
 * No Supabase sale inventory, stock allocation, or payment permissions are created.
 */
(()=>{
  'use strict';
  const D=window.BURTON_DATA;
  if(!D||!Array.isArray(D.inventory))return;
  const singles=Array.isArray(window.BURTON_NEW_HOLLYWOOD_ITEMS)?window.BURTON_NEW_HOLLYWOOD_ITEMS:[];
  const sets=Array.isArray(window.BURTON_HOLLYWOOD_CURATED_SETS?.sets)?window.BURTON_HOLLYWOOD_CURATED_SETS.sets:[];
  if(singles.length!==73||sets.length!==11){
    console.warn('Hollywood catalogue intake incomplete; existing store inventory unchanged.');
    return;
  }
  const existing=new Set(D.inventory.map(p=>p.sku));
  const bySku=new Map(singles.map(p=>[p.sku,p]));
  const proposed=[];
  const base={
    collection:'hollywood',cmsOnly:true,status:'preview',stockState:'unavailable',
    quantity:0,availableForCheckout:false,year:null,issue:'Publication unverified',
    dateLabel:'Print/publication date unverified',publicationConfidence:'Not verified',
    condition:'Not inspected',authenticityNote:'The digitized page shows period-style printed material, but its original publisher, printing process, authenticity and physical format have not been independently authenticated.',
    photoNote:'The owner-supplied source scan is shown; one scan does not establish a distinct physical sale unit.',
    reviewStatus:'Requires physical inventory, condition, format, date and duplicate review'
  };
  const memberOf=new Map();
  for(const set of sets){
    for(const sku of set.memberSkus||[]){
      if(memberOf.has(sku)||!bySku.has(sku))throw Error('Old Hollywood set references a repeated or missing source scan: '+sku);
      memberOf.set(sku,set.id);
    }
  }
  for(const item of singles){
    const price=Number.isFinite(item.suggestedPriceCad)?item.suggestedPriceCad:0;
    proposed.push({...base,
      sku:item.sku,type:'original',title:item.title,shortDescription:item.description,
      cmsLongDescription:item.description,theme:item.category,category:item.category,
      image:item.image,images:[item.image],catalogIds:[item.sku],
      price,priceStatus:item.priceStatus||'recommended_only',
      edition:item.format||'Vintage printed paper · Exact physical format unverified',
      conditionNotes:item.physicalCondition||'Physical original must be inspected.',
      tags:Array.isArray(item.tags)?item.tags:['Old Hollywood'],
      draftDuplicate:item.suggestedPriceCad==null,
      draftSourceGroup:item.sourceGroup,
      draftSetId:memberOf.get(item.sku)||null
    });
  }
  for(const set of sets){
    const included=set.memberSkus.map(id=>bySku.get(id));
    if(included.some(x=>!x))throw Error('Missing Old Hollywood member in '+set.id);
    const cover=set.image;
    const gallery=included.map(x=>x.image).filter((x,i,all)=>x!==cover&&all.indexOf(x)===i);
    proposed.push({...base,
      sku:set.id,type:'bundle',title:set.title,shortDescription:set.description,
      cmsLongDescription:set.description,theme:set.category,category:set.category,
      price:set.proposedSetPriceCad,priceStatus:'recommended_only',
      image:cover,images:gallery,catalogIds:[...set.memberSkus],
      edition:'Curated group of source scans · Physical set not assembled',
      conditionNotes:'Every paper item requires inspection; individual availability and bundle ownership must be confirmed before this set is offered.',
      tags:['Old Hollywood','Curated set',set.category],
      draftSetSlug:set.slug,proposedDiscountPercent:set.indicativeDiscountPercent,
      draftMemberDetails:included.map(x=>({sku:x.sku,title:x.title,image:x.image}))
    });
  }
  if(proposed.length!==84||proposed.some(p=>existing.has(p.sku))||new Set(proposed.map(p=>p.sku)).size!==84){
    console.warn('Hollywood SKU collision or catalogue mismatch. Existing store inventory unchanged.');
    return;
  }
  D.inventory.push(...proposed);
  window.BURTON_HOLLYWOOD_INTEGRATION=Object.freeze({sourceScans:73,curatedSets:11,
    publishedRecords:84,checkoutApproved:false});
})();
