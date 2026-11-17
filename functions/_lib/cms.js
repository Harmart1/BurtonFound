/* Burton & Found CMS permissions and field validation.
 * All editorial writes go through Cloudflare, never directly through the public browser.
 * Owner = allowlisted bf_admin_users; delegated roles = bf_cms_members.
 * Nothing in this module can approve payments, stock, shipping or taxes.
 */
import {db,verifiedUser} from './core.js';

export const CMS_KINDS=['product','automobile','set','page'];
const PAGE_KEYS=new Set(['home','vintage','announcement']);
const COLLECTIONS=new Set(['coca-cola','hollywood','books','collectibles']);
const ID=/^[A-Za-z0-9][A-Za-z0-9._-]{1,79}$/;

export async function cmsActor(request,env){
 const user=await verifiedUser(request,env);
 if(!user?.email_confirmed_at||user.is_anonymous===true)return null;
 const admin=await db(env,'bf_admin_users',{query:'?user_id=eq.'+encodeURIComponent(user.id)+'&select=user_id&limit=1'});
 if(Array.isArray(admin)&&admin.length)return {id:user.id,email:user.email,role:'owner'};
 const member=await db(env,'bf_cms_members',{query:'?user_id=eq.'+encodeURIComponent(user.id)+'&select=role,active&limit=1'});
 if(Array.isArray(member)&&member[0]?.active&&['editor','manager'].includes(member[0].role))
   return {id:user.id,email:user.email,role:member[0].role};
 return null;
}
export function isManager(actor){return actor?.role==='owner'||actor?.role==='manager';}
export function isOwner(actor){return actor?.role==='owner';}
function text(value,max,label,required=false){
 const v=String(value??'').trim();
 if((required&&!v)||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))
   throw Error(label+' must contain '+(required?'1–':'at most ')+max+' readable characters');
 return v;
}
function price(value,label){
 const n=Number(value);
 if(value===null||value===''||!Number.isFinite(n)||n<1||n>100000||Math.round(n*100)!==n*100)
   throw Error(label+' must be a valid CAD amount with up to two decimals');
 return n;
}
function imagePath(value,env){
 const v=text(value,1100,'Photo URL');
 if(!v)return '';
 const local=/^assets\/images\/[a-zA-Z0-9_./-]+\.(webp|png|jpg|jpeg)$/i;
 const publicMedia=(env.SUPABASE_URL||'').replace(/\/$/,'')+'/storage/v1/object/public/bf-cms-media/';
 if(local.test(v)&&!v.includes('..'))return v;
 if(v.startsWith(publicMedia)&&/^[a-zA-Z0-9_./-]+\.(webp|png|jpg|jpeg)$/i.test(v.slice(publicMedia.length))&&!v.includes('..'))return v;
 throw Error('Use an existing product image or a photograph uploaded through the studio');
}
const allowed={
 product:['title','shortDescription','description','priceCAD','image','collection','year','condition'],
 automobile:['title','summary','description','suggestedPriceCAD','image','brand','year'],
 set:['title','description','theme','suggestedSetPriceCAD','componentSkus'],
 page:['headline','body']
};
export function validateCmsInput(kind,key,input,env){
 if(!CMS_KINDS.includes(kind)||!ID.test(key))throw Error('Invalid catalogue entry identifier');
 if(kind==='page'&&!PAGE_KEYS.has(key))throw Error('Unsupported editable page section');
 if(!input||Array.isArray(input)||typeof input!=='object')throw Error('Missing content fields');
 const keys=Object.keys(input);
 if(keys.some(k=>!allowed[kind].includes(k)))throw Error('Unexpected or restricted content field');
 const out={};
 if(kind==='product'){
   out.title=text(input.title,140,'Title',true);
   out.shortDescription=text(input.shortDescription,340,'Short description',true);
   out.description=text(input.description,2400,'Long description');
   out.collection=text(input.collection||'collectibles',30,'Collection');
   if(!COLLECTIONS.has(out.collection))throw Error('Choose a supported collection');
   out.image=imagePath(input.image,env);
   if(!out.image)throw Error('Add a real item photograph before saving');
   out.condition=text(input.condition,240,'Condition');
   out.year=input.year===null||input.year===''?null:Number(input.year);
   if(out.year!==null&&(!Number.isInteger(out.year)||out.year<1870||out.year>2100))throw Error('Invalid year');
   if(input.priceCAD!==undefined&&input.priceCAD!=='')out.priceCAD=price(input.priceCAD,'Product price');
 }else if(kind==='automobile'){
   out.title=text(input.title,140,'Title',true);
   out.summary=text(input.summary,400,'Summary',true);
   out.description=text(input.description,2400,'Description',true);
   out.brand=text(input.brand,90,'Manufacturer',true);
   out.image=imagePath(input.image,env);
   if(!out.image)throw Error('Add a real advertising-page photograph');
   out.year=input.year===null||input.year===''?null:Number(input.year);
   if(out.year!==null&&(!Number.isInteger(out.year)||out.year<1870||out.year>2100))throw Error('Invalid year');
   out.suggestedPriceCAD=price(input.suggestedPriceCAD,'Suggested asking price');
 }else if(kind==='set'){
   out.title=text(input.title,140,'Set title',true);
   out.description=text(input.description,1800,'Set description',true);
   out.theme=text(input.theme,140,'Set theme',true);
   out.suggestedSetPriceCAD=price(input.suggestedSetPriceCAD,'Suggested set price');
   if(!Array.isArray(input.componentSkus)||input.componentSkus.length<2||input.componentSkus.length>8)
     throw Error('A set must contain between 2 and 8 distinct page SKUs');
   out.componentSkus=input.componentSkus.map(x=>text(x,80,'Page SKU',true));
   if(out.componentSkus.some(x=>!ID.test(x))||new Set(out.componentSkus).size!==out.componentSkus.length)
     throw Error('Set page SKUs must be unique and correctly formatted');
 }else{
   out.headline=text(input.headline,180,'Heading',true);
   out.body=text(input.body,900,'Supporting copy',true);
 }
 return out;
}
export function safeEntry(e){
 return {kind:e.kind,key:e.item_key,revision:e.revision,draft:e.draft_data,published:e.published_data,
         isPublished:!!e.is_published,updatedAt:e.updated_at,publishedAt:e.published_at,
         updatedBy:e.updated_by};
}
export function contentError(e){
 if(/revision|changed since|conflict/i.test(e.message||''))return [409,'This entry changed. Reload before saving.'];
 if(/Invalid|Missing|Unsupported|must |Choose|Add a|Unexpected|restricted|already/i.test(e.message||''))
   return [400,e.message];
 return [503,'Content service temporarily unavailable'];
}
