/* Dependency-free GitHub/Cloudflare deploy preflight. Does not contact payment providers. */
import {readFileSync,existsSync,readdirSync,statSync} from 'node:fs';
import {resolve,join,dirname,relative,extname} from 'node:path';
const root=process.cwd(),site=join(root,'public');
const failures=[];
const insist=(condition,message)=>{if(!condition)failures.push(message)};
const read=(file)=>readFileSync(join(root,file),'utf8');
for(const file of ['public/index.html','public/site-menu.js','public/site-menu.css','public/config.js','public/store.js','public/products.js','public/checkout-success.html','public/_routes.json','public/_headers','functions/api/checkout.js','functions/api/public-account-config.js','functions/api/stripe-webhook.js','functions/api/shipping-quotes.js','functions/_lib/core.js','supabase/seed.sql','.gitignore','.dev.vars.example'])insist(existsSync(join(root,file)),`Missing ${file}`);
insist(!existsSync(join(root,'index.html')),'Root index.html detected: deploy only public/ to Cloudflare');
insist(!existsSync(join(root,'public/functions')),'Server Functions may not live inside public/');
const route=JSON.parse(read('public/_routes.json'));
insist(route.version===1&&route.include.includes('/api/*'),'Cloudflare API functions must route under /api/*');
insist(/LIVE_CHECKOUT_ENABLED="false"/.test(read('.dev.vars.example')),'Sample checkout must default to disabled');
insist(/CARRIER_QUOTES_ENABLED="false"/.test(read('.dev.vars.example')),'Sample carrier quotes must default to disabled');
insist(read('public/config.js').indexOf('SUPABASE_SECRET_KEY')===-1,'Private key name in public config');
const all=[];
function walk(d){for(const name of readdirSync(d)){const p=join(d,name);if(statSync(p).isDirectory())walk(p);else all.push(p)}}
walk(site);
const pattern=/(?:src|href)\s*=\s*(["'])(.*?)\1/g;
for(const file of all.filter(x=>extname(x)==='.html')){
 const html=readFileSync(file,'utf8');
 for(const m of html.matchAll(pattern)){
  let value=m[2];if(!value||/^(?:https?:|mailto:|tel:|data:|javascript:|#|\/\/)/i.test(value))continue;
  value=value.split(/[?#]/)[0];if(!value)continue;
  const target=value.startsWith('/')?resolve(site,value.slice(1)):resolve(dirname(file),value);
  if(!target.startsWith(site+'/'))failures.push(`HTML reference escapes public/: ${relative(root,file)}: ${value}`);
  else if(!existsSync(target))failures.push(`Missing reference ${relative(root,file)} -> ${value}`);
 }
}
const js=read('public/products.js');
const start=js.indexOf('=');
if(start<0)failures.push('Missing inventory in products.js');
else {
 const data=JSON.parse(js.slice(start+1).trim().replace(/;$/,''));
 insist(data.inventory.length===22,'Unexpected count of active inventory listings');
 const physical=new Set(data.inventory.flatMap(p=>p.catalogIds||[]));
 insist(physical.size===40,'Unexpected count of physical inventory items');
 for(const p of data.inventory){insist(existsSync(join(site,p.image)),`Missing primary image ${p.sku}: ${p.image}`)}
}
const published=all.filter(x=>/\.(?:html|js|json)$/i.test(x));
for(const file of published){const content=readFileSync(file,'utf8');
 insist(!/sk_live_[A-Za-z0-9]{16,}/.test(content),`Possible live Stripe secret in public/${relative(site,file)}`);
 insist(!/sb_secret_[A-Za-z0-9]{16,}/.test(content),`Possible Supabase secret in public/${relative(site,file)}`);
 insist(!/whsec_[A-Za-z0-9]{20,}/.test(content),`Possible Stripe webhook secret in public/${relative(site,file)}`);
}
if(failures.length){for(const f of failures)console.error('FAIL:',f);process.exitCode=1}
else console.log(`PASS: Cloudflare root Functions + ${all.length} public files + HTML asset paths + inventory + no obvious public payment secrets.`);
