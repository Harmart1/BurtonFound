/* Canada Post 2026 Developer Portal Rating API, server-side only.
 * Matched to official OpenAPI: Rating v4.0, POST /rating/v1/prices;
 * public specification /download/4632/document (verified 2026-11-25).
 * Test-app responses are stubbed by Canada Post and are NOT live prices. */
const API='https://api.canadapost-postescanada.ca/prod/devportal-portaildesdeveloppeurs';
const TOKEN_URL=API+'/cpc-api-native-oauth-provider/oauth2/token';
const RATES_URL=API+'/rating/v1/prices';
const isoDate=s=>/^\\d{4}-\\d{2}-\\d{2}(?:T|$)/.test(String(s||''))?String(s).slice(0,10):null;
const money=n=>typeof n==='number'&&Number.isFinite(n)&&n>0&&n<=5000&&Math.round(n*100)===Math.round(Number(n.toFixed(2))*100)?Math.round(n*100):NaN;
const excludedService=new Set(['USA.SP.AIR','INT.SP.AIR','INT.SP.SURF','USA.PW.ENV','USA.PW.PAK']);

export function canadaPostJsonRequest(env,to,pkg,shipDate){
 if(!['CA','US'].includes(to.country))throw Error('Canada Post rating is configured for Canada and US only');
 if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(shipDate))throw Error('Invalid shipping dispatch date');
 const dims=[pkg.lengthCm,pkg.widthCm,pkg.heightCm].map(Number).sort((a,b)=>b-a);
 const weight=Number(pkg.weightKg);
 if(!Number.isFinite(weight)||weight<=0||weight>30||dims.some(v=>!Number.isFinite(v)||v<=0||v>150))throw Error('Verified packed dimensions required');
 const customer=String(env.CANADA_POST_CUSTOMER_NUMBER||'').trim();
 const contract=String(env.CANADA_POST_CONTRACT_ID||'').trim();
 if(customer&&!/^\\d{1,10}$/.test(customer)||contract&&!/^\\d{1,10}$/.test(contract))throw Error('Invalid Canada Post customer or contract number');
 if(contract&&!customer)throw Error('Canada Post contract requires a matching customer number');
 return {
  ...(customer?{customerNumber:customer}:{}),
  ...(contract?{contractId:contract}:{}),
  quoteType:customer?'commercial':'counter',
  expectedMailingDate:shipDate,
  parcelCharacteristics:{weight:Number(weight.toFixed(3)),dimensions:{length:Number(dims[0].toFixed(1)),width:Number(dims[1].toFixed(1)),height:Number(dims[2].toFixed(1))},unpackaged:false,mailingTube:false,oversized:false},
  originPostalCode:'P6A1Z1',
  destination:to.country==='CA'?{domestic:{postalCode:to.postal}}:{unitedStates:{zipCode:to.postal.slice(0,5)}}
 };
}
export function parseCanadaPostJson(payload,country){
 // Official new Rating schema returns a top-level ARRAY of price-quotes.
 if(!Array.isArray(payload)||!['CA','US'].includes(country))return [];
 const out=[],seen=new Set();
 for(const entry of payload){
  const code=String(entry?.serviceCode||'');
  if(!/^(DOM|USA)\\.[A-Z0-9.]{2,35}$/.test(code))continue;
  if(country==='CA'&&!code.startsWith('DOM.')||country==='US'&&!code.startsWith('USA.'))continue;
  if(excludedService.has(code)||seen.has(code))continue;
  const amount=money(entry?.priceDetails?.due);
  if(!Number.isInteger(amount)||amount<=0)continue;
  const std=entry.serviceStandard||{};
  const transit=Number(std.expectedTransitTime);
  const name=String(entry.serviceName||code).replace(/[<>]/g,'').slice(0,70);
  out.push({carrier:'Canada Post',code,name,amount_cents:amount,currency:'CAD',
   estimated_date:isoDate(std.expectedDeliveryDate),
   transit_days:Number.isInteger(transit)&&transit>0&&transit<=90?transit:null,
   guaranteed:std.guaranteedDelivery===true});
  seen.add(code);
 }
 return out;
}
export async function canadaPostJsonRates(env,to,pkg,shipDate){
 if(!env.CANADA_POST_CLIENT_ID||!env.CANADA_POST_CLIENT_SECRET)return [];
 const auth=btoa(String(env.CANADA_POST_CLIENT_ID)+':'+String(env.CANADA_POST_CLIENT_SECRET));
 const tokenResult=await fetch(TOKEN_URL,{method:'POST',headers:{
  Authorization:'Basic '+auth,'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'
 },body:new URLSearchParams({grant_type:'client_credentials',scope:'merchant'}),signal:AbortSignal.timeout(7500)});
 if(!tokenResult.ok)throw Error('Canada Post OAuth authorization is unavailable');
 const token=(await tokenResult.json()).access_token;
 if(typeof token!=='string'||token.length<10)throw Error('Canada Post did not issue a valid access token');
 const response=await fetch(RATES_URL,{method:'POST',headers:{
  Authorization:'Bearer '+token,Accept:'application/json','Content-Type':'application/json','Accept-Language':'en-CA'
 },body:JSON.stringify(canadaPostJsonRequest(env,to,pkg,shipDate)),signal:AbortSignal.timeout(7500)});
 if(!response.ok)throw Error('Canada Post JSON rates are unavailable');
 return parseCanadaPostJson(await response.json(),to.country);
}
