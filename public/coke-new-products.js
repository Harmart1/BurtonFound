/* Coca-Cola intake from owner-supplied Coke.pdf, Nov 2026.
 * Duplicate source pages were excluded: p1/p5 = CC-034; p2 = CC-033; p6 = CC-031.
 * p8 is a Lincoln Continental advertisement, not a Coke product.
 * Three unique printed-paper pieces plus one set sharing the same physical units.
 */
(()=>{
 'use strict';
 const D=window.BURTON_DATA;
 if(!D||!Array.isArray(D.inventory))return;
 const root='assets/images/coca-cola/new-2026/';
 const pieces=[
  {
   sku:'CC-NEW-001',
   title:"Coca-Cola at the Brussels World's Fair · 1958",
   shortDescription:"Colour illustrated Coca-Cola magazine advertisement depicting visitors at the company's Brussels World's Fair pavilion, complete with Coke bottles, a visitor map and multilingual welcome signs. An appealing travel-and-exposition-era design, shown as the pictured printed-paper page.",
   image:root+'brussels-1958-hero.webp',
   images:[root+'brussels-1958-hero.webp',root+'brussels-1958-full.webp'],
   price:24.95,year:1958,
   theme:'Worlds fairs and travel',
   category:'International Coca-Cola advertising',
   conditionNotes:'The source photograph shows the printed front with subtle age-related toning and minor marks. Exact paper dimensions, reverse-side printing, and condition should be confirmed before shipping.',
   sourcePdfPage:3,
   catalogIds:['CC-NEW-001']
  },
  {
   sku:'CC-NEW-002',
   title:"Love That Coke! · Lace-Heart Romance Advertisement",
   shortDescription:"Mid-century Coca-Cola illustrated magazine advertisement featuring a smiling couple framed by a white lace heart, with a branded Coke glass between them. The red-and-white romantic design bears the headline “Be Really Refreshed ... Love That Coke!”—a charming Valentine's-era paper collectible.",
   image:root+'love-that-coke-1959-hero.webp',
   images:[root+'love-that-coke-1959-hero.webp',root+'love-that-coke-1959-full.webp'],
   price:24.95,year:1959,
   theme:'Romance and seasonal advertising',
   category:'Coca-Cola romance',
   conditionNotes:'The full-page scan shows mild age-related paper toning and some small blemishes. Original dimensions, verso, and any edge damage require physical inspection before dispatch.',
   sourcePdfPage:4,
   catalogIds:['CC-NEW-002']
  },
  {
   sku:'CC-NEW-003',
   title:"Float with Coke · Refreshing New Feeling Advertisement",
   shortDescription:"Colour Coca-Cola magazine advertisement featuring three branded glasses, two generous ice-cream floats, a cherry and an ice-cream scoop overhead. The playful “Tan’ ta li zing!” lettering and “Refreshing New Feeling” slogan capture early-1960s soda-fountain style.",
   image:root+'coke-floats-1961-hero.webp',
   images:[root+'coke-floats-1961-hero.webp',root+'coke-floats-1961-full.webp'],
   price:24.95,year:1961,
   theme:'Ice cream floats and soda fountains',
   category:'Coca-Cola food and drink',
   conditionNotes:'The supplied scan shows visible paper aging and small surface flecks. Please inspect the physical page and confirm measurements and reverse before mailing.',
   sourcePdfPage:7,
   catalogIds:['CC-NEW-003']
  }
 ];
 const shared={
   collection:'coca-cola',type:'original',status:'available',stockState:'available',
   availableForCheckout:true,quantity:1,priceStatus:'asking_price',
   issue:'Vintage advertisement · printing year attributed, not independently verified',
   dateLabel:'Period attributed from advertisement and vintage comparisons',
   publicationConfidence:'An advertising campaign/date attribution is not proof of this specific sheet’s print date, publication or provenance.',
   condition:'Vintage paper · condition details available on request',
   authenticityNote:'This is a catalogued printed-paper item, not a reproduction marketed as a metal sign, an original Coca-Cola artwork or a certified studio print. Printing date and publisher of this physical sheet have not been independently verified.',
   photoNote:'Digitized photograph of the supplied item. A second image shows the complete scanned page.',
   edition:'Vintage magazine advertising page · unframed',
   tags:['Coca-Cola','Vintage printed advertising','Mid-century paper']
 };
 const additions=pieces.map(p=>({
   ...shared,...p,
   memberOfSet:'CC-SET-F',
   cmsLongDescription:p.shortDescription,
   tags:[...shared.tags,p.theme]
 }));
 const set={
   ...shared,
   type:'bundle',sku:'CC-SET-F',title:'Coca-Cola · Good Taste, Good Times Collector Set',
   shortDescription:"Three different mid-century Coca-Cola advertisement pages that follow the brand from the 1958 Brussels World's Fair to a lace-heart romance scene and a colourful soda-fountain ice-cream float. An inviting display-ready collection of travel, affection and refreshment imagery.",
   cmsLongDescription:"A cohesive three-piece Coca-Cola printed-paper collection: the 1958 Brussels World's Fair welcome, the 'Love That Coke!' romantic heart advertisement, and the early-1960s 'Float with Coke' design. All three are catalogued separately and share their stock with this set.",
   image:pieces[0].image,images:pieces.slice(1).map(x=>x.image),
   catalogIds:pieces.map(x=>x.sku),
   price:62.95,year:null,theme:'Three mid-century Coca-Cola designs',
   category:'Curated Coca-Cola sets',
   conditionNotes:'Three individually photographed vintage-paper items. Exact physical sizes, reverse images and paper condition should be confirmed for each page before shipping this set.',
   memberDetails:pieces.map(p=>({sku:p.sku,title:p.title,image:p.image})),
   bundleDiscountPercent:16,
   edition:'Curated three-piece printed-advertising set · sold unframed',
   tags:['Coca-Cola','Curated collector set','Travel','Romance','Soda fountain']
 };
 additions.push(set);
 if(additions.length!==4||additions.some(p=>D.inventory.some(x=>x.sku===p.sku))||
    new Set(additions.map(x=>x.sku)).size!==4){
    console.warn('Coca-Cola intake collision; leaving existing stock unchanged.');return;
 }
 D.inventory.push(...additions);
 if(Array.isArray(D.archive)){
   const archiveIds=new Set(D.archive.map(x=>x.id));
   for(const p of pieces){
     if(archiveIds.has(p.sku))continue;
     D.archive.push({
       id:p.sku,year:p.year,issue:'Publication / issue unverified',title:p.title,
       description:p.shortDescription,theme:p.theme,collection:'coca-cola',
       condition:'Vintage used paper — verify condition',conditionNotes:p.conditionNotes,
       publicationConfidence:shared.publicationConfidence,
       photo:p.image,valueMin:15,valueMax:28,
       originalPhotoFile:'Coke.pdf · source page '+p.sourcePdfPage
     });
   }
 }
 window.BURTON_NEW_COKE_INTEGRATION=Object.freeze({
   uniquePieces:3,curatedSets:1,duplicateImagesExcluded:4,nonCokePagesExcluded:1,
   listedProducts:4,inventorySharedAcrossSets:true
 });
})();