/* Integrate the 80 distinct scanned automobile designs and 18 curated sets
 * into the normal Burton & Found bag, account and filter catalogue.
 * Prices are existing researched CAD suggestions. Physical stock, original format,
 * condition and ownership are NOT verified; enquiry-only is enforced separately
 * from the site's live payment status. No new back-end inventory is created.
 */
(()=>{
 'use strict';
 const D=window.BURTON_DATA,individuals=window.BURTON_VINTAGE_CARS,sets=window.BURTON_VINTAGE_SETS;
 if(!Array.isArray(D?.inventory)||!Array.isArray(individuals)||!Array.isArray(sets))return;
 if(individuals.length!==80||sets.length!==18)throw Error('Automobile catalogue changed: review before publishing');
 const map=new Map(individuals.map(i=>[i.sku,i]));
 const bySku=new Set(D.inventory.map(i=>i.sku));
 const rows=[];
 const common={
   collection:'automobiles',status:'enquiry_only',stockState:'verification_required',
   availableForCheckout:false,requiresVerification:true,
   priceStatus:'indicative',quantity:0,
   category:'Vintage automobile advertising',
   condition:'Physical paper not yet inspected',
   conditionNotes:'Physical stock, ownership, dimensions, verso, printing date, and condition must be confirmed before any sale.',
   issue:'Magazine issue unverified',publicationConfidence:'The image is catalogued; precise printed issue and source have not been independently authenticated.',
   photoNote:'Photograph of the catalogued advertising design; physical original and exact print format have not been verified.',
   authenticityNote:'No authentication or verified provenance is asserted. The depicted vehicle period may differ from the printing date.',
   edition:'Vintage automobile advertising · printed-paper format to be verified',
   priceQualifier:'INDICATIVE CAD PRICE'
 };
 for(const p of individuals){
   if(!/^VA-\d{3}$/.test(p.sku)||bySku.has(p.sku)||!p.title||!p.image||!Number.isFinite(p.suggestedPriceCAD)||p.suggestedPriceCAD<=0||p.physicalItemVerified||p.salesEnabled)throw Error('Invalid or unverified automobile product '+p.sku);
   bySku.add(p.sku);
   rows.push({...common,type:'original',sku:p.sku,title:p.title,
     year:Number.isInteger(p.year)?p.year:null,dateLabel:p.year?String(p.year)+' automobile image · printing date unverified':'Printing date unverified',
     theme:p.brand+' vintage motoring',brand:p.brand||'Unknown',shortDescription:p.summary||p.description,
     cmsLongDescription:p.description,price:p.suggestedPriceCAD,image:p.image,
     images:[p.image,...(p.originalImage&&p.originalImage!==p.image?[p.originalImage]:[])],
     catalogIds:[p.sku],tags:['Vintage automobiles',p.brand,String(p.year||'Date unknown')]
   });
 }
 for(const set of sets){
   const members=(set.componentSkus||[]).map(id=>map.get(id));
   if(!/^BF-VA-SET\d{2}$/.test(set.sku)||bySku.has(set.sku)||members.some(x=>!x)||
     !members.length||members.length!==set.componentCount||
     new Set(set.componentSkus).size!==members.length||set.salesEnabled||
     !Number.isFinite(set.suggestedSetPriceCAD)||set.suggestedSetPriceCAD<=0)throw Error('Invalid proposed automobile set '+set.sku);
   bySku.add(set.sku);
   rows.push({...common,type:'bundle',sku:set.sku,title:set.title,year:null,
     theme:set.theme,category:'Curated automobile advertising sets',
     shortDescription:set.description,cmsLongDescription:set.description,
     price:set.suggestedSetPriceCAD,
     image:members[0].image,images:members.slice(1).map(x=>x.image),
     catalogIds:[...set.componentSkus],memberDetails:members.map(x=>({sku:x.sku,title:x.title,image:x.image})),
     edition:'Proposed curated automobile advertising group · '+members.length+' scanned designs',
     tags:['Vintage automobiles','Curated collector sets',set.theme],
     priceQualifier:'INDICATIVE SET PRICE'
   });
 }
 if(rows.length!==98||rows.some(p=>!Number.isFinite(p.price)))throw Error('Automobile integration incomplete');
 D.inventory.push(...rows);
 window.BURTON_AUTOMOBILE_INTEGRATION=Object.freeze({
   designs:80,sets:18,bagEligible:98,checkoutEligible:0,
   physicalInventoryVerified:false
 });
})();