import {boundedJson} from '../../_lib/bounded-json.js';
import {json,error,checkSameOrigin,requireAdmin,db,stripe,safeReturnUrl} from '../../_lib/core.js';
import {flatRateFor} from '../../_lib/flat-shipping.js';
const marker='burtonfound-sandbox-v1';
const allowed=env=>env.OWNER_TEST_CHECKOUT_ENABLED==='true'&&env.LIVE_CHECKOUT_ENABLED==='false'&&env.LIVE_PAYMENTS_APPROVED==='false'&&env.STRIPE_WEBHOOK_MODE==='test'&&/^sk_test_[A-Za-z0-9]+$/.test(env.STRIPE_SECRET_KEY||'')&&/^whsec_/.test(env.STRIPE_WEBHOOK_SECRET||'')&&env.SHIPPING_ALLOWED_COUNTRIES==='CA'&&env.FLAT_RATE_PRICES_APPROVED==='true';
const sessionId=v=>typeof v==='string'&&/^cs_test_[A-Za-z0-9_]{12,200}$/.test(v);
const skuValid=s=>typeof s==='string'&&/^[A-Z0-9-]{2,24}$/.test(s);
const merchant=async env=>(await stripe(env,'account',null,'GET'))?.id===env.STRIPE_EXPECTED_ACCOUNT_ID&&/^acct_[A-Za-z0-9]{10,64}$/.test(env.STRIPE_EXPECTED_ACCOUNT_ID||'');
const owned=(s,u)=>s?.livemode===false&&sessionId(s.id)&&s.metadata?.bf_isolated_qa===marker&&s.metadata?.bf_owner_checkout==='v1'&&s.client_reference_id===u.id;
export async function onRequestPost({request,env}){
 if(!checkSameOrigin(request))return error(403,'Invalid origin');
 if(!allowed(env))return error(503,'Owner sandbox checkout is unavailable.');
 try{
  const user=await requireAdmin(request,env);if(!user)return error(403,'Administrator access required');
  let body;try{body=await boundedJson(request,4096)}catch{return error(400,'Invalid test cart')}
  const skus=body?.skus;
  if(!Array.isArray(skus)||!skus.length||skus.length>12||skus.some(s=>!skuValid(s))||new Set(skus).size!==skus.length)return error(400,'Choose one to twelve distinct catalogue items.');
  if(!['standard','express'].includes(body.shipping))return error(400,'Choose a Canadian shipping service.');
  const rate=flatRateFor(env,'CA'),charge=rate[body.shipping];if(!Number.isInteger(charge)||charge<=0)return error(503,'Shipping configuration unavailable.');
  // Read current catalogue prices only. Never reserve or mark a physical item sold.
  const records=await db(env,'bf_public_stock',{query:'?select=sku,price_cents,available&sku=in.('+skus.join(',')+')'});
  if(!Array.isArray(records)||records.length!==skus.length||new Set(records.map(p=>p.sku)).size!==skus.length||skus.some(s=>!records.some(p=>p.sku===s&&p.available===true&&Number.isSafeInteger(p.price_cents)&&p.price_cents>0&&p.price_cents<=10000000)))return error(409,'One or more cart items are unavailable or cannot be priced.');
  if(!await merchant(env))return error(503,'Sandbox merchant verification failed.');
  const origin=safeReturnUrl(request),args={mode:'payment','payment_method_types[0]':'card','customer_email':'test@example.com','success_url':origin+'/admin/orders.html?test_checkout={CHECKOUT_SESSION_ID}#ownerTestCheckout','cancel_url':origin+'/admin/orders.html?test_cancelled=1#ownerTestCheckout','shipping_address_collection[allowed_countries][0]':'CA','client_reference_id':user.id,'metadata[bf_isolated_qa]':marker,'metadata[bf_owner_checkout]':'v1','payment_intent_data[metadata][bf_isolated_qa]':marker,'payment_intent_data[metadata][bf_owner_checkout]':'v1',expires_at:String(Math.floor(Date.now()/1000)+1860)};
  records.forEach((p,i)=>{args['line_items['+i+'][price_data][currency]']='cad';args['line_items['+i+'][price_data][unit_amount]']=String(p.price_cents);args['line_items['+i+'][price_data][product_data][name]']='TEST ONLY — '+p.sku;args['line_items['+i+'][quantity]']='1';});
  args['shipping_options[0][shipping_rate_data][type]']='fixed_amount';args['shipping_options[0][shipping_rate_data][fixed_amount][currency]']='cad';args['shipping_options[0][shipping_rate_data][fixed_amount][amount]']=String(charge);args['shipping_options[0][shipping_rate_data][display_name]']='TEST — '+(body.shipping==='express'?'Express':'Standard tracked')+' Canada';
  const s=await stripe(env,'checkout/sessions',args);
  if(!owned(s,user)||s.status!=='open'||s.payment_status!=='unpaid'||s.currency!=='cad'||s.amount_subtotal!==records.reduce((a,p)=>a+p.price_cents,0)||!/^https:\/\/checkout\.stripe\.com\//.test(s.url||''))return error(503,'Sandbox session could not be verified. No store order was created.');
  return json({url:s.url,mode:'test',session_id:s.id});
 }catch{return error(503,'Sandbox checkout unavailable. No store order was created.');}
}
export async function onRequestGet({request,env}){
 if(!allowed(env))return error(503,'Owner sandbox checkout unavailable.');
 try{
  const u=await requireAdmin(request,env);if(!u)return error(403,'Administrator access required');
  const id=new URL(request.url).searchParams.get('session_id');
  if(!sessionId(id))return error(400,'Invalid sandbox session.');
  if(!await merchant(env))return error(503,'Sandbox merchant verification failed.');
  const s=await stripe(env,'checkout/sessions/'+id,null,'GET');
  if(!owned(s,u)||s.id!==id||s.currency!=='cad')return error(404,'Sandbox session not found.');
  return json({mode:'test',status:s.status,payment_status:s.payment_status,total_cents:s.amount_total,shipping_cents:s.shipping_cost?.amount_total??null,currency:'CAD',store_order_created:false});
 }catch{return error(503,'Sandbox status unavailable.');}
}
