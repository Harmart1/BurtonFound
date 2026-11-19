/* Burton & Found — Release the 23 original Coca-Cola archive pages as individual
 * shop products, while retaining all five historic sets and new three-piece set.
 *
 * Original stock IDs (CC-002 etc.) are REUSED; no new physical units are created.
 * Backend bf_product_units links each new SKU to the existing, shared unit ID.
 * Product titles, pictured motifs, year confidence, and condition come from
 * the existing BURTON_DATA.archive record. Prices are CAD seller asking prices.
 */
(()=>{
'use strict';
const D=window.BURTON_DATA;
if(!D||!Array.isArray(D.archive)||!Array.isArray(D.inventory))return;
const descriptions={
  "CC-002": "A pre-war Coca-Cola magazine advertisement featuring a blonde woman taking a drink from a Coke glass, with a smaller soda-fountain scene inset. A portrait-led example of the brand's late-1930s refreshment advertising.",
  "CC-003": "A bold Coca-Cola advertising page with a soda-fountain attendant beside an imposing red Coca-Cola cooler. The cooler and counter scene make this a particularly appealing piece for diner and classic beverage collectors.",
  "CC-004": "A wartime-era Coca-Cola page showing a woman enjoying Coke alongside white blossoms and a prominent five-cent price message. Combines classic portrait illustration with nostalgic early bottle-pricing history.",
  "CC-007": "A cheerful postwar Coca-Cola advertisement with graduates and family members celebrating on a porch. A graduation-themed piece combining family occasions and Coca-Cola's familiar invitation to share a drink.",
  "CC-009": "An unusual industrial-themed Coca-Cola advertisement dominated by a large red vending machine against an urban manufacturing scene. The design highlights Coke's mid-century connection to workplaces and vending technology.",
  "CC-012": "A colourful Coca-Cola food-and-picnic advertisement presenting a basket of groceries and the familiar red six-bottle Coke carton. A useful companion to kitchen, packaging and vintage food-art collections.",
  "CC-013": "An elegant mid-century Coca-Cola advertisement depicting a blonde woman in a satin gown, Coke and a prepared meal. The fashion styling and dining theme suit collectors of vintage illustration and entertaining imagery.",
  "CC-014": "A striking Coca-Cola portrait advertisement showing a smiling woman in a military-inspired cap beside an oversized Coke bottle. A graphic early-1950s composition with strong brand imagery.",
  "CC-015": "An aviation-themed Coca-Cola advertisement featuring a woman with a Coke glass beside an airport window and visible aircraft. The travel setting makes it suitable for both aviation and beverage-advertising collections.",
  "CC-016": "A ranch-and-rodeo Coca-Cola print with a smiling denim-clad cowboy, horses and a small rodeo scene. Classic Western advertising imagery with period styling and Coca-Cola branding.",
  "CC-017": "A Coca-Cola soda-fountain page featuring a counter attendant, Coke glasses and familiar diner surroundings. A classic mid-century refreshment scene for soda-shop and restaurant memorabilia enthusiasts.",
  "CC-019": "A 1950s Coca-Cola advertisement featuring a man enjoying Coke, a companion in a white sweater and playful red bubble graphics. A personable fashion-and-refreshment design with period photographic styling.",
  "CC-021": "A scenic Wyoming Coca-Cola print showing a cowboy pouring Coke for a cowgirl with mountains and a wagon behind them. Blends Western travel imagery with the brand's late-1950s 'Sign of Good Taste' campaign.",
  "CC-022": "A Coca-Cola advertisement set amid Swiss alpine meadows, cattle and mountain scenery, with visitors enjoying Coke. A distinctive international-travel design from the 'Sign of Good Taste' era.",
  "CC-024": "A summer-themed Coca-Cola printed advertisement showing women preparing a beach picnic with a red cooler in the sand. A relaxed, nostalgic scene suited to beach, picnic and outdoor-recreation collections.",
  "CC-025": "A vintage Coca-Cola drive-in advertisement depicting a couple enjoying food and Coke from a serving tray at their car window. Strong mid-century diner and motoring appeal, with nostalgic drive-in service details.",
  "CC-026": "A lively Coca-Cola bowling-alley print showing a group wearing red bowling shirts near the lanes. An appealing bowling and recreation design from the late-1950s/early-1960s period.",
  "CC-028": "A graphic Coca-Cola page dominated by a large branded soda glass against a bright yellow field. The oversized drink imagery and strong colour contrast reflect early-1960s advertising design.",
  "CC-029": "A sunny Coca-Cola swimming-pool advertisement showing a woman in a yellow swimsuit passing a Coke to a swimmer. A classic summer recreation scene with bright period swimwear.",
  "CC-030": "A romantic Coca-Cola advertisement showing a dressed-up couple relaxing after a dance, with balloons in the background. A mid-century celebration design suitable for romantic and seasonal displays.",
  "CC-031": "A product-focused Coca-Cola advertisement featuring three branded glasses as soda pours into the centre glass. The simple arrangement spotlights the drink itself and the 'Refreshing New Feeling' campaign.",
  "CC-032": "A Coca-Cola lifestyle advertisement featuring three women wearing matching red jackets as Coke bottles are handed between them. Red fashion accents and shared refreshment create a lively early-1960s composition.",
  "CC-033": "A minimalist Coca-Cola product advertisement showing two glass bottles—Coca-Cola and Coke—resting together in ice. The chilled glass and straightforward branding are especially attractive for bottle and packaging collectors."
};
const prices={
  "CC-002": 16.95,
  "CC-003": 18.95,
  "CC-004": 18.95,
  "CC-007": 18.95,
  "CC-009": 19.95,
  "CC-012": 19.95,
  "CC-013": 24.95,
  "CC-014": 16.95,
  "CC-015": 18.95,
  "CC-016": 14.95,
  "CC-017": 17.95,
  "CC-019": 18.95,
  "CC-021": 18.95,
  "CC-022": 17.95,
  "CC-024": 15.95,
  "CC-025": 16.95,
  "CC-026": 16.95,
  "CC-028": 16.95,
  "CC-029": 16.95,
  "CC-030": 18.95,
  "CC-031": 18.95,
  "CC-032": 14.95,
  "CC-033": 14.95
};
const already=new Set(D.inventory.map(x=>x.sku));
const setMembership=new Map();
for(const set of D.inventory.filter(x=>x.collection==='coca-cola'&&x.type==='bundle')){
 for(const sku of set.catalogIds||[]){
   if(setMembership.has(sku))throw Error('Coca-Cola page belongs to overlapping sets: '+sku);
   setMembership.set(sku,set.sku);
 }
}
const additions=[];
for(const source of D.archive.filter(x=>x.collection==='coca-cola')){
 if(already.has(source.id))continue;
 const price=prices[source.id];
 if(!Number.isFinite(price)||!descriptions[source.id]||!setMembership.has(source.id)){
   console.warn('An unexpected Coca-Cola scan has no approved listing or set:',source.id);
   return;
 }
 const suffix=source.id.toLowerCase();
 additions.push({
   sku:source.id,type:'original',collection:'coca-cola',title:source.title,
   year:source.year,issue:source.issue,price,
   priceStatus:'asking_price',availableForCheckout:true,quantity:1,
   status:'available',stockState:'available',
   image:'assets/images/polished/'+suffix+'.webp',
   // Show the colour-balanced presentation and the original archived photograph.
   images:['assets/images/polished/'+suffix+'.webp',source.photo],
   catalogIds:[source.id],
   shortDescription:descriptions[source.id],
   cmsLongDescription:descriptions[source.id],
   theme:source.theme,category:'Vintage Coca-Cola Advertising',
   condition:source.condition||'Vintage printed paper',
   conditionNotes:source.conditionNotes||'Physical page condition must be confirmed.',
   publicationConfidence:source.publicationConfidence||
     'Year and magazine issue have not been independently verified.',
   authenticityNote:'Catalogued vintage Coca-Cola advertising page; the image and any date attribution do not independently authenticate the printing date, paper source, size or exact condition.',
   photoNote:'Actual catalogue photograph, plus an alternate archived view of the same page. These photographs do not represent two separate physical items.',
   edition:'Printed vintage magazine advertisement · unframed',
   dateLabel:'Archive attribution: '+source.year+'; '+(source.issue||'issue unconfirmed'),
   tags:['Coca-Cola','Vintage advertising',String(source.year),source.theme],
   memberOfSet:setMembership.get(source.id),
   valueReferenceCad:{low:source.valueMin,high:source.valueMax}
 });
}
if(additions.length!==23||new Set(additions.map(x=>x.sku)).size!==23||
   additions.some(x=>already.has(x.sku))||
   additions.some(x=>x.price<x.valueReferenceCad.low||x.price>x.valueReferenceCad.high)){
 console.error('Coca-Cola individual product intake count or prices failed validation; leaving inventory unchanged.');
 return;
}
D.inventory.push(...additions);
window.BURTON_COKE_ARCHIVE_INDIVIDUALS=Object.freeze({
 newSingleListings:23,
 cokeSingles:37,
 cokeSets:6,
 cokeProductListings:43,
 totalProducts:D.inventory.length,
 physicalStockUnitsReused:true
});
})();