/* Burton & Found carrier rating. Server-only, credentials never exposed to the browser.
   All package sizes and weights must be verified and supplied by the owner before live quotes. */
const enc=new TextEncoder();
export const ORIGIN={country:'CA',postal:'P6A1Z1',city:'Sault Ste. Marie',state:'ON'};
export const cleanPostal=(s)=>String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
export function destination(raw,env){
 const country=String(raw?.country||'').trim().toUpperCase();
 const allowed=String(env.SHIPPING_ALLOWED_COUNTRIES||'CA').split(',').map(x=>x.trim().toUpperCase()).filter(Boolean);
 if(!/^[A-Z]{2}$/.test(country)||!allowed.includes(country))throw Error('Shipping to that country is not currently enabled');
 const postal=cleanPostal(raw?.postal);if(country==='CA'&&!/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(postal))throw Error('Enter a complete Canadian postal code');
 if(country==='US'&&!/^\d{5}(\d{4})?$/.test(postal))throw Error('Enter a valid US ZIP code');
 if(country!=='CA'&&country!=='US'&&!/^[A-Z0-9]{2,12}$/.test(postal))throw Error('Enter the destination postal code');
 const city=String(raw?.city||'').trim().slice(0,60);
 const state=String(raw?.state||'').trim().toUpperCase().slice(0,3);
 if(!/^[\p{L}\d .,'-]{2,60}$/u.test(city))throw Error('Enter the destination city');
 if(!/^[A-Z0-9-]{2,3}$/.test(state)&&['CA','US','AU'].includes(country))throw Error('Enter a province or state abbreviation');
 return {country,postal,city,state};
}
export function parcelFor(env,skus){
 let config;try{config=JSON.parse(env.SHIPPING_PACKAGES_JSON||'{}')}catch{throw Error('Shipping package measurements are incorrectly configured')}
 if(!Array.isArray(skus)||!skus.length||skus.length>12||new Set(skus).size!==skus.length)throw Error('Invalid shopping bag');
 const id=skus.slice().sort().join('+');
 // For multiple objects, measure the combined packed parcel before enabling an accurate quote.
 const p=config[id]||(skus.length===1?config[skus[0]]:null);
 if(!p)throw Error('This combination needs a measured, packed parcel before live shipping can be quoted. Please contact the shop.');
 if(p.verified!==true)throw Error('The seller has not confirmed the packed parcel measurements for this order. Please request a manual shipping quote.');
 const vals=[p.weightKg,p.lengthCm,p.widthCm,p.heightCm].map(Number);
 if(vals.some((v)=>!Number.isFinite(v)||v<=0)||vals[0]>30||vals.slice(1).some(v=>v>150))throw Error('Parcel weight or dimensions have not been verified');
 return {weightKg:vals[0],lengthCm:vals[1],widthCm:vals[2],heightCm:vals[3]};
}
const xmlEsc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const xmlVal=(s,t)=>{const m=s.match(new RegExp(`<${t}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${t}>`));return m?m[1].trim():'';};
const dollarsToCents=n=>Math.round(Number(n)*100);
const validPrice=n=>Number.isInteger(n)&&n>=0&&n<=500000;
export function parseCanadaPost(xml){
 const list=[];const rx=/<price-quote(?:\s[^>]*)?>([\s\S]*?)<\/price-quote>/g;let m;
 while((m=rx.exec(xml))){const b=m[1],price=xmlVal(b,'price-details'),std=xmlVal(b,'service-standard');const due=xmlVal(price,'due');const amount=due?dollarsToCents(due):NaN;
  const service=xmlVal(b,'service-code'),name=xmlVal(b,'service-name'),deliveryDate=xmlVal(std,'expected-delivery-date');
  if(!validPrice(amount)||!service||!/^[A-Z0-9.]+$/.test(service))continue;
  list.push({carrier:'Canada Post',code:service,name:name.replace(/<[^>]+>/g,'').slice(0,70),amount_cents:amount,currency:'CAD',estimated_date:/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)?deliveryDate:null,transit_days:Number(xmlVal(std,'expected-transit-time'))||null,guaranteed:xmlVal(std,'guaranteed-delivery')==='true'});
 }
 return list.filter(r=>!['USA.SP.AIR','INT.SP.AIR','INT.SP.SURF'].includes(r.code)); // untracked services excluded for unique originals
}
export function canadaPostRequest(env,to,pkg,shipDate){
 const base=env.CANADA_POST_SANDBOX==='true'?'https://ct.soa-gw.canadapost.ca':'https://soa-gw.canadapost.ca';
 const dest=to.country==='CA'?`<domestic><postal-code>${to.postal}</postal-code></domestic>`:to.country==='US'?`<united-states><zip-code>${to.postal.slice(0,5)}</zip-code></united-states>`:`<international><country-code>${to.country}</country-code><postal-code>${xmlEsc(to.postal)}</postal-code></international>`;
 const cust=env.CANADA_POST_CUSTOMER_NUMBER?`<customer-number>${xmlEsc(env.CANADA_POST_CUSTOMER_NUMBER)}</customer-number>`:'';
 const contract=env.CANADA_POST_CONTRACT_ID?`<contract-id>${xmlEsc(env.CANADA_POST_CONTRACT_ID)}</contract-id>`:'';
 const body=`<?xml version="1.0" encoding="utf-8"?><mailing-scenario xmlns="http://www.canadapost.ca/ws/ship/rate-v4">${cust}${contract}<expected-mailing-date>${shipDate}</expected-mailing-date><parcel-characteristics><weight>${pkg.weightKg}</weight><dimensions><length>${pkg.lengthCm}</length><width>${pkg.widthCm}</width><height>${pkg.heightCm}</height></dimensions></parcel-characteristics><origin-postal-code>${ORIGIN.postal}</origin-postal-code><destination>${dest}</destination></mailing-scenario>`;
 return {url:base+'/rs/ship/price',body};
}
export async function canadaPostRates(env,to,pkg,shipDate){
 if(!env.CANADA_POST_USERNAME||!env.CANADA_POST_PASSWORD)return [];
 const {url,body}=canadaPostRequest(env,to,pkg,shipDate);
 const auth=btoa(`${env.CANADA_POST_USERNAME}:${env.CANADA_POST_PASSWORD}`);
 const res=await fetch(url,{method:'POST',headers:{Authorization:'Basic '+auth,Accept:'application/vnd.cpc.ship.rate-v4+xml','Content-Type':'application/vnd.cpc.ship.rate-v4+xml','Accept-language':'en-CA'},body,signal:AbortSignal.timeout(7500)});
 if(!res.ok)throw Error('Canada Post rates are temporarily unavailable');
 return parseCanadaPost(await res.text());
}
export function fedexRequest(env,to,pkg,shipDate){
 return {accountNumber:{value:String(env.FEDEX_ACCOUNT_NUMBER)},requestedShipment:{shipper:{address:{postalCode:ORIGIN.postal,city:ORIGIN.city,stateOrProvinceCode:ORIGIN.state,countryCode:'CA'}},recipient:{address:{postalCode:to.postal,city:to.city,...(to.state?{stateOrProvinceCode:to.state}:{}),countryCode:to.country,residential:true}},pickupType:'DROPOFF_AT_FEDEX_LOCATION',serviceType:undefined,rateRequestType:['ACCOUNT','LIST'],requestedPackageLineItems:[{weight:{units:'KG',value:pkg.weightKg},dimensions:{length:Math.ceil(pkg.lengthCm),width:Math.ceil(pkg.widthCm),height:Math.ceil(pkg.heightCm),units:'CM'}}],shipDateStamp:shipDate,packagingType:'YOUR_PACKAGING',preferredCurrency:'CAD',totalPackageCount:1},returnTransitTimes:true};
}
export function parseFedex(payload){
 const details=payload?.output?.rateReplyDetails||[],out=[];
 for(const r of details){
  const candidates=r.ratedShipmentDetails||[];
  const best=candidates.find(x=>x.rateType==='ACCOUNT'||x.rateType==='PREFERRED')||candidates.find(x=>x.rateType==='LIST')||candidates[0];
  const amount=best?.totalNetCharge??best?.totalNetFedExCharge??best?.shipmentRateDetail?.totalNetCharge;
  const currency=best?.currency||best?.shipmentRateDetail?.currency||r.currency;
  const cents=dollarsToCents(amount);
  if(String(currency||'').toUpperCase()!=='CAD'||!validPrice(cents))continue;
  // Modern REST replies may present the commitment under operationalDetail instead of commit.
  const date=r.commit?.dateDetail?.date||r.commit?.dateDetail?.deliveryDate||r.operationalDetail?.deliveryDate||r.operationalDetail?.commitDate||r.commit?.dateDetail?.dayFormat||null;
  const iso=/^\d{4}-\d{2}-\d{2}/.test(String(date||''))?String(date).slice(0,10):null;
  const name=String(r.serviceName||r.serviceType||'FedEx service').replaceAll('_',' ').slice(0,70);
  const transitCodes={ONE_DAY:1,TWO_DAYS:2,THREE_DAYS:3,FOUR_DAYS:4,FIVE_DAYS:5,SIX_DAYS:6,SEVEN_DAYS:7,EIGHT_DAYS:8,NINE_DAYS:9,TEN_DAYS:10};
  const transit=transitCodes[r.operationalDetail?.transitTime]||null;
  out.push({carrier:'FedEx',code:String(r.serviceType||'').slice(0,60),name,amount_cents:cents,currency:'CAD',estimated_date:iso,transit_days:transit,guaranteed:false});
 }
 return out;
}
export async function fedexRates(env,to,pkg,shipDate){
 if(!env.FEDEX_CLIENT_ID||!env.FEDEX_CLIENT_SECRET||!env.FEDEX_ACCOUNT_NUMBER)return [];
 const host=env.FEDEX_SANDBOX==='true'?'https://apis-sandbox.fedex.com':'https://apis.fedex.com';
 const login=await fetch(host+'/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',client_id:env.FEDEX_CLIENT_ID,client_secret:env.FEDEX_CLIENT_SECRET}),signal:AbortSignal.timeout(7500)});
 if(!login.ok)throw Error('FedEx authorization unavailable');const token=(await login.json()).access_token;
 if(!token)throw Error('FedEx authorization unavailable');
 const res=await fetch(host+'/rate/v1/rates/quotes',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','X-locale':'en_CA'},body:JSON.stringify(fedexRequest(env,to,pkg,shipDate)),signal:AbortSignal.timeout(7500)});
 if(!res.ok)throw Error('FedEx rates are temporarily unavailable');return parseFedex(await res.json());
}
const b64url=(u)=>btoa(String.fromCharCode(...u)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
const fromB64=(s)=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
async function hmac(secret,s){const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(s)));}
export async function signQuote(env,quote){if(String(env.SHIPPING_QUOTE_SECRET||'').length<32)throw Error('Shipping quote signing not configured');const val=b64url(enc.encode(JSON.stringify(quote)));return val+'.'+b64url(await hmac(env.SHIPPING_QUOTE_SECRET,val));}
export async function verifyQuote(env,token,skus){
 if(typeof token!=='string'||token.length>1800||!token.includes('.')||String(env.SHIPPING_QUOTE_SECRET||'').length<32)throw Error('Please request a fresh shipping estimate');
 const [payload,mac]=token.split('.');if(!payload||!mac)throw Error('Invalid shipping option');
 const expected=await hmac(env.SHIPPING_QUOTE_SECRET,payload);let actual;try{actual=fromB64(mac)}catch{throw Error('Invalid shipping option')}
 if(actual.length!==expected.length)throw Error('Shipping quote was changed; request a new estimate');
 let differences=0;for(let i=0;i<expected.length;i++)differences|=actual[i]^expected[i];
 if(differences)throw Error('Shipping quote was changed; request a new estimate');
 let value;try{value=JSON.parse(new TextDecoder().decode(fromB64(payload)))}catch{throw Error('Invalid shipping option')}
 if(value.v!==2||!Number.isInteger(value.expires)||value.expires<Date.now()/1000||value.expires>Date.now()/1000+1200)throw Error('Shipping estimate has expired; request a new one');
 if(!Array.isArray(value.skus)||value.skus.join(',')!==skus.slice().sort().join(',')||!validPrice(value.amount_cents)||!['Canada Post','FedEx'].includes(value.carrier)||!/^[A-Z0-9._-]{2,65}$/.test(value.code)||!value.to||!value.to.country||!value.to.postal)throw Error('Shipping option no longer matches this bag');
 if(env.SHIPPING_MODE!=='live_carrier')throw Error('Live carrier shipping is not enabled');
 // An edited package profile or disabled destination invalidates previously quoted postage.
 const current=parcelFor(env,skus);
 if([current.weightKg,current.lengthCm,current.widthCm,current.heightCm].join(',')!==value.packed.join(','))throw Error('Packaging has changed; request a new shipping quote');
 const checked=destination(value.to,env);
 if(JSON.stringify(checked)!==JSON.stringify(value.to))throw Error('Shipping destination must be rechecked');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value.ship_date||''))throw Error('Invalid dispatch date');
 return value;
}
export function mailingDate(handlingDays=2,now=new Date()){
 // Ontario shipping origin: use the seller's local calendar date instead of UTC,
 // which can otherwise move the estimated dispatch date forward near midnight.
 const f=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'});
 const parts=Object.fromEntries(f.formatToParts(now).map(p=>[p.type,p.value]));
 const day=new Date(Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),12));
 let remaining=Math.max(0,Math.min(7,Number(handlingDays)||0));
 while(remaining){day.setUTCDate(day.getUTCDate()+1);if(day.getUTCDay()!==0&&day.getUTCDay()!==6)remaining--;}
 if(day.getUTCDay()===0)day.setUTCDate(day.getUTCDate()+1);
 if(day.getUTCDay()===6)day.setUTCDate(day.getUTCDate()+2);
 return day.toISOString().slice(0,10);
}
export function safeQuoteError(e){console.error('Carrier shipping unavailable:',e.message);return 'No live carrier quote is available for this destination or parcel. Please contact Burton & Found for manual shipping confirmation.';}
