/* Burton & Found — Old Hollywood items are ordinary shop products.
 * Source: 71 priced pieces, 2 scans used only as additional product views,
 * and 11 collector sets linked to those SAME individual inventory units in Supabase.
 */
(()=>{
 'use strict';
 const D=window.BURTON_DATA;
 if(!D||!Array.isArray(D.inventory))return;
 const source=window.BURTON_NEW_HOLLYWOOD_ITEMS;
 const setData=window.BURTON_HOLLYWOOD_CURATED_SETS;
 if(!Array.isArray(source)||source.length!==73||!Array.isArray(setData?.sets)||setData.sets.length!==11){
   console.warn('Old Hollywood source catalogue incomplete; no new products added.');return;
 }
 const alternateFor={
   'OH-NEW-003-05':'OH-NEW-003-04',
   'OH-NEW-007-08':'OH-NEW-007-07'
 };
 const bySku=new Map(source.map(p=>[p.sku,p]));
 const setMembership=new Map();
 for(const set of setData.sets){
   for(const member of set.memberSkus){
     if(setMembership.has(member)||!bySku.has(member)||bySku.get(member).suggestedPriceCad==null){
       throw Error('Duplicate or unpriced set member: '+member);
     }
     setMembership.set(member,set.id);
   }
 }
 const itemBase={
   collection:'hollywood',type:'original',status:'available',stockState:'available',
   quantity:1,availableForCheckout:true,year:null,issue:'Publication date unverified',
   dateLabel:'Print date not confirmed',publicationConfidence:'Printing year, paper format and publisher not independently confirmed',
   condition:'See photographs; further inspection available on request',
   authenticityNote:'The original printing process, publication source and issue date have not been independently authenticated. The title describes the scanned image and any visible printed identification, not a certified studio-issued collectible.',
   photoNote:'The photographs reproduce the supplied scans. Ask for reverse-side images and exact measurements before ordering.',
   priceQualifier:'ASKING PRICE',edition:'Vintage printed paper · format to be confirmed',
   tags:['Old Hollywood']
 };
 const additions=[];
 for(const scan of source){
   if(scan.suggestedPriceCad==null)continue;
   const photos=[scan.image,...Object.entries(alternateFor)
     .filter(([,parent])=>parent===scan.sku).map(([alternate])=>bySku.get(alternate)?.image).filter(Boolean)];
   additions.push({...itemBase,
     sku:scan.sku,title:scan.title,shortDescription:scan.description,
     cmsLongDescription:scan.description,theme:scan.category,category:scan.category,
     image:scan.image,images:photos,catalogIds:[scan.sku],
     price:scan.suggestedPriceCad,priceStatus:'asking_price',
     conditionNotes:'Check the photographs for visible age-related marks. Exact dimensions, reverse and paper type can be confirmed before dispatch.',
     tags:scan.tags||['Old Hollywood'],sourceGroup:scan.sourceGroup,
     memberOfSet:setMembership.get(scan.sku)||null
   });
 }
 for(const set of setData.sets){
   const members=set.memberSkus.map(id=>bySku.get(id));
   const gallery=members.map(m=>m.image).filter(image=>image!==set.image);
   additions.push({...itemBase,type:'bundle',sku:set.id,title:set.title,
     shortDescription:set.description,cmsLongDescription:set.description,
     theme:set.category,category:set.category,
     image:set.image,images:gallery,catalogIds:[...set.memberSkus],
     price:set.proposedSetPriceCad,priceStatus:'asking_price',
     edition:'Curated Old Hollywood paper collection · '+members.length+' listed pieces',
     conditionNotes:'Pieces are catalogued individually. Ask for condition and format information on each member before purchasing this set.',
     tags:['Old Hollywood','Curated collector set',set.category],
     memberDetails:members.map(m=>({sku:m.sku,title:m.title,image:m.image})),
     bundleDiscountPercent:set.indicativeDiscountPercent,
     setSlug:set.slug
   });
 }
 if(additions.length!==82||new Set(additions.map(p=>p.sku)).size!==82||
    additions.some(p=>D.inventory.some(existing=>existing.sku===p.sku))){
   console.error('Old Hollywood SKU or stock mismatch; refusing to change catalogue.');return;
 }
 D.inventory.push(...additions);
 window.BURTON_HOLLYWOOD_INTEGRATION=Object.freeze({
   individualProducts:71,curatedSets:11,additionalPhotos:2,listedProducts:82,
   backendProductUnitsLinked:true
 });
})();