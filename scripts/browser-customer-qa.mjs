// Run actual production HTML, CSS and JS in a browser against an isolated mock backend.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.BF_BROWSER_MODULE||'playwright-core');
const root=resolve('public');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.json':'application/json','.woff2':'font/woff2'};
const json=(res,value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
const ownerRow={id:'fixture-refunded-order',created_at:'2026-11-27T00:00:00Z',stripe_session_id:'cs_live_fixture_refunded',payment_intent:'pi_fixture',payment_status:'refunded',fulfillment_status:'needs_attention',subtotal_cents:1000,shipping_cents:500,total_cents:1500,item_lines:[{sku:'CC-010',price_cents:1000}]};
const ownerClean={...ownerRow,id:'fixture-paid-order',stripe_session_id:'cs_live_fixture_paid',payment_status:'paid',fulfillment_status:'processing'};
const server=createServer(async(req,res)=>{
  try{
    const path=new URL(req.url,'http://127.0.0.1').pathname;
    if(req.method!=='GET'){json(res,{error:'Fixture refuses all real HTTP writes'},405);return;}
    if(path==='/api/public-account-config')return json(res,{configured:true,supabaseUrl:'https://fixture.supabase.co',supabasePublishableKey:'sb_publishable_fixture'});
    if(path==='/api/catalog')return json(res,{configured:true,items:[{sku:'CC-010',price_cents:2495,available:true}]});
    if(path==='/api/health')return json(res,{service:'Burton & Found',checkout:'preview_only',currency:'CAD'});
    if(path==='/api/account-orders')return json(res,{orders:[]});
    if(path.startsWith('/api/admin/')&&req.headers.authorization==='Bearer fixture-owner'){
      if(path==='/api/admin/me')return json(res,{admin:true});
      if(path==='/api/admin/orders')return json(res,{orders:[ownerRow,ownerClean].map(o=>({...o,record_mode:'live',customer_name:'Fixture Collector',email:'collector@example.invalid',item_lines:o.item_lines.map(p=>({...p,title:'Fixture collectible'}))}))});
      if(path==='/api/admin/holds')return json(res,{holds:[]});
      if(path==='/api/admin/bookkeeping')return json(res,{orders:[ownerRow,ownerClean]});
      if(path==='/api/admin/stripe-reconciliation')return json(res,{from:'2026-11-01',to:'2026-11-30',mode:'live',excluded:0,notice:'Synthetic comparison only',rows:[{id:ownerRow.id,issues:['Refund reported — reconcile individual refund status and balance transactions'],refund_reported_cents:1500},{id:ownerClean.id,issues:['Disputed charge — manual review'],refund_reported_cents:0}]});
      if(path==='/api/admin/readiness')return json(res,{checkout:'preview_only'});
    }
    if(path==='/api/admin/me')return json(res,{error:'Fixture non-admin'},403);
    if(path.startsWith('/api/'))return json(res,{configured:false,products:[],collections:[],items:[]});
    if(path==='/account.html'){res.writeHead(307,{Location:'/account'});res.end();return;}
    let file=resolve(root,'.'+decodeURIComponent(path));
    if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
    if(path==='/')file=resolve(root,'index.html');
    else if(!extname(file))file+='.html';
    if(!(await stat(file)).isFile())throw Error('not a file');
    const body=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});res.end(body);
  }catch{res.writeHead(404);res.end();}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
const origin='http://127.0.0.1:'+server.address().port;
let browser;
let passed=0;
try{
 browser=await chromium.launch({executablePath:process.env.BF_CHROME_PATH||undefined,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const test=async(name,viewport,fn)=>{
   const context=await browser.newContext({viewport,serviceWorkers:'block'});
   try{
     // Never permit outbound traffic to a real provider, even if code changes.
     await context.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
     await context.addInitScript(()=>{
       window.__bfCalls=[];
       let session=null,listener=null;
       const account={id:'fixture-user',email:'collector@example.invalid',user_metadata:{full_name:'Fixture Collector'}};
       const fragment=new URLSearchParams(location.hash.slice(1));
       const valid=fragment.get('type')==='recovery'&&fragment.get('access_token')==='fixture-recovery';
       if(valid)session={user:account,access_token:'fixture-recovery'};
       if(location.pathname==='/admin/orders.html'&&new URLSearchParams(location.search).get('owner_fixture')==='1')session={user:{...account,id:'fixture-owner'},access_token:'fixture-owner'};
       const log=(type,extra={})=>window.__bfCalls.push({type,...extra});
       const auth={
         onAuthStateChange(fn){listener=fn;return {data:{subscription:{unsubscribe(){}}}};},
         async getSession(){if(valid&&!window.__bfRecoverySent){window.__bfRecoverySent=true;listener?.('PASSWORD_RECOVERY',session);}return {data:{session}};},
         async signUp(v){log('signup',{email:v.email,redirect:v.options.emailRedirectTo});return {data:{session:null}};},
         async resetPasswordForEmail(email,v){log('recover',{email,redirect:v.redirectTo});return {};},
         async resend(v){log('resend',{email:v.email,redirect:v.options.emailRedirectTo});return {};},
         async signInWithPassword(v){log('signin',{email:v.email});if(v.password!=='FixturePassword123!')return {error:{code:'invalid_credentials'}};session={user:account,access_token:'fixture-session'};return {data:{user:account,session}};},
         async updateUser(v){log('password-update',{valid:typeof v.password==='string'&&v.password.length>=10});return {data:{user:account}};},
         async signOut(){log('signout');session=null;return {};}
       };
       const from=()=>({select(){return this},eq(){return this},order(){return this},maybeSingle(){return Promise.resolve({data:null})},upsert(){return Promise.resolve({data:null})},then(r){r({data:[]})}});
       window.supabase={createClient:()=>({auth,from})};
     });
     const page=await context.newPage();
     page.setDefaultTimeout(12000);
     const errors=[];page.on('pageerror',()=>errors.push('uncaught page exception'));
     await fn(page);
     assert.equal(errors.length,0,'Uncaught JavaScript error');
     passed++;console.log('PASS '+name);
   }finally{await context.close();}
 };
 const ready=async page=>{await page.waitForFunction(()=>window.BURTON_ACCOUNT?.connected());await page.evaluate(()=>window.BURTON_ACCOUNT.ready());};
 const visible=async(page,s)=>{await page.locator(s).waitFor({state:'visible'});};
 const hidden=async(page,s)=>{await page.locator(s).waitFor({state:'hidden'});};
 const message=async(page,pattern)=>{await page.waitForFunction(p=>new RegExp(p,'i').test(document.querySelector('#authMessage')?.textContent||''),pattern);};
 const checkCalls=async(page,expected)=>{const calls=await page.evaluate(()=>window.__bfCalls);for(const [type,redirect] of expected){assert(calls.some(v=>v.type===type&&(!redirect||v.redirect===redirect)),'Missing fixture call '+type);}};
 for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
   const size=viewport.width===390?'mobile':'desktop';
   await test(size+' account registration and recovery requests',viewport,async page=>{
     await page.goto(origin+'/account.html#signup');await ready(page);
     await visible(page,'#signUpForm');await hidden(page,'#signInForm');await hidden(page,'#recoveryForm');
     const f=page.locator('#signUpForm');await f.locator('[name=full_name]').fill('Fixture Collector');await f.locator('[name=email]').fill('collector@example.invalid');await f.locator('[name=password]').fill('FixturePassword123!');await f.locator('[name=confirm_password]').fill('FixturePassword123!');await f.locator('[name=legal]').check();await f.locator('[type=submit]').click();
     await message(page,'If this address is new');await visible(page,'#signInForm');
     await page.locator('#forgotButton').click();await visible(page,'#forgotForm');await page.locator('#forgotForm [name=email]').fill('collector@example.invalid');await page.locator('#forgotForm [type=submit]').click();await message(page,'Request accepted');
     await page.locator('#backSignIn').click();await page.locator('#resendButton').click();await visible(page,'#resendForm');await page.locator('#resendForm [name=email]').fill('collector@example.invalid');await page.locator('#resendForm [type=submit]').click();await message(page,'If confirmation is required');
     await checkCalls(page,[['signup',origin+'/account'],['recover',origin+'/account'],['resend',origin+'/account']]);
     await hidden(page,'#accountDashboard');
   });
   await test(size+' verified recovery, new password and sign-in',viewport,async page=>{
     await page.goto(origin+'/#access_token=fixture-recovery&type=recovery');await page.waitForURL(u=>u.pathname==='/account');await ready(page);
     await visible(page,'#recoveryForm');await hidden(page,'#signInForm');await hidden(page,'#accountDashboard');
     const f=page.locator('#recoveryForm');await f.locator('[name=password]').fill('FixturePassword123!');await f.locator('[name=confirm_password]').fill('NotTheSamePassword');await f.locator('[type=submit]').click();await message(page,'Passwords do not match');
     assert(!(await page.evaluate(()=>window.__bfCalls)).some(x=>x.type==='password-update'));
     await f.locator('[name=confirm_password]').fill('FixturePassword123!');await f.locator('[type=submit]').click();await visible(page,'#signInForm');await message(page,'Password changed successfully');
     assert(!page.url().includes('access_token'));await checkCalls(page,[['password-update'],['signout']]);
     const s=page.locator('#signInForm');await s.locator('[name=email]').fill('collector@example.invalid');await s.locator('[name=password]').fill('incorrect');await s.locator('[type=submit]').click();await message(page,'Email or password did not match');
     await s.locator('[name=password]').fill('FixturePassword123!');await s.locator('[type=submit]').click();await visible(page,'#accountDashboard');await hidden(page,'#ownerConsoleLink');await hidden(page,'#accountAccess');
   });
   await test(size+' expired recovery cannot change a password',viewport,async page=>{
     await page.goto(origin+'/account#error_code=otp_expired&type=recovery');await ready(page);await visible(page,'#recoveryPanel');await hidden(page,'#recoveryForm');await hidden(page,'#accountDashboard');
     await page.locator('#recoveryCancel').click();await visible(page,'#forgotForm');assert(!(await page.evaluate(()=>window.__bfCalls)).some(x=>x.type==='password-update'));
   });
   await test(size+' automobile collection and enquiry page accessibility',viewport,async page=>{
     await page.goto(origin+'/collections/automobiles.html');
     assert.equal(await page.locator('.mk-grid .mk-card').count(),98);
     assert.equal(await page.locator('.mk-grid .mk-enquiry').count(),98);
     assert.equal(await page.locator('h1').count(),1);
     await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement?.textContent),'Skip to content');
     await page.keyboard.press('Enter');await page.waitForURL(u=>u.hash==='#main');
     const cards=page.locator('.mk-grid .mk-card');
     await cards.first().scrollIntoViewIfNeeded();await page.waitForFunction(()=>{const im=document.querySelector('.mk-card img');return im?.complete&&im.naturalWidth>0;});
     assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Collection horizontal overflow');
     assert.equal(await page.locator('img:not([alt])').count(),0);
     await cards.first().click();await page.locator('h1').waitFor({state:'visible'});
     assert.match(await page.locator('[data-bf-availability]').textContent(),/Enquiry only/);
     assert.match(await page.locator('[data-bf-shop-link]').textContent(),/request details/);
     assert.equal(await page.locator('[data-bf-stock-sku]').count(),0);
     assert.equal(await page.locator('script[src="/marketing-stock.js"]').count(),0);
     await page.waitForFunction(()=>{const im=document.querySelector('.mk-gallery img');return im?.complete&&im.naturalWidth>0;});
     assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Product horizontal overflow');
     assert.equal(await page.locator('img:not([alt])').count(),0);
     const metrics=await page.evaluate(()=>({resources:performance.getEntriesByType('resource').length,encodedBytes:performance.getEntriesByType('resource').reduce((n,r)=>n+r.encodedBodySize,0),domReadyMs:Math.round(performance.getEntriesByType('navigation')[0]?.domContentLoadedEventEnd||0)}));
     console.log('Local synthetic page measurements '+size+': '+JSON.stringify(metrics)+' (not real-user Core Web Vitals)');
   });
   await test(size+' private owner exception report and mode isolation',viewport,async page=>{
     await page.goto(origin+'/admin/orders.html?owner_fixture=1');await visible(page,'#dashboard');
     await page.locator('#ledgerFrom').fill('2026-11-01');await page.locator('#ledgerTo').fill('2026-11-30');
     await page.locator('#ledgerLoad').click();await page.locator('#exceptionRows tr').first().waitFor({state:'visible'});
     assert.equal(await page.locator('#exceptionRows tr').count(),1);assert.match(await page.locator('#exceptionRows').textContent(),/Local refunded status/);
     await page.locator('#stripeCompare').click();await page.waitForFunction(()=>document.querySelectorAll('#exceptionRows tr').length===2);
     assert.match(await page.locator('#exceptionRows').textContent(),/Disputed charge/);
     await page.locator('#exceptionFilter').selectOption('review');assert.equal(await page.locator('#exceptionRows tr').count(),1);
     await page.locator('#ledgerMode').selectOption('test');assert.equal(await page.locator('#exceptionRows tr').count(),0);
     assert(await page.locator('#exceptionExport').isDisabled());
     const live=page.locator('.order[data-id="fixture-paid-order"]'),review=page.locator('.order[data-id="fixture-refunded-order"]');
     assert(await live.locator('[data-action="summary"]').isVisible());
     assert.equal(await review.locator('[data-action="summary"]').count(),0);
     await live.locator('[data-action="shipping-cost"]').click();
     const panel=live.locator('.shipping-cost-panel');await panel.waitFor({state:'visible'});
     for(const [i,c] of ['3.00','1.00','0','0.50'].entries())await panel.locator('[data-expense="'+i+'"]').fill(c);
     assert.match(await panel.locator('[role="status"]').textContent(),/Shipping contribution.*0\.50/);
     await panel.locator('[data-expense="0"]').fill('6.00');
     assert.match(await panel.locator('[role="status"]').textContent(),/Shipping shortfall.*2\.50/);
     await live.locator('[data-action="shipping-cost"]').click();assert(await panel.isHidden());
     await live.locator('[data-action="shipping-cost"]').click();assert(await panel.isVisible());
     assert.match(await panel.locator('[role="status"]').textContent(),/Enter all four costs/);

   });
   await test(size+' browse catalogue and guest shopping bag',viewport,async page=>{
     await page.goto(origin+'/#shop');await ready(page);await page.locator('#productGrid .product-card').first().waitFor({state:'visible'});
     assert((await page.locator('#productGrid .product-card').count())>0);
     const card=page.locator('#productGrid [data-sku="CC-010"]');await card.waitFor({state:'attached'});
     await card.locator('[data-view]').first().click();await visible(page,'#productDialog');await page.locator('#productClose').click();await hidden(page,'#productDialog');
     await card.locator('[data-add]').click();await page.waitForFunction(()=>document.querySelector('#cartCount')?.textContent.trim()==='1');await page.locator('#cartOpen').click();await visible(page,'#cartDrawer');await page.locator('#checkoutButton').click();await visible(page,'#infoDialog');assert.match(await page.locator('#enquiryDelivery').textContent(),/open your email app/);assert.match(await page.locator('#enquiryDraft').inputValue(),/CC-010/);await page.locator('#enquiryNote').fill('Please confirm dimensions');assert.match(await page.locator('#enquiryDraft').inputValue(),/Please confirm dimensions/);assert(await page.locator('#enquiryEmail').isVisible());await page.locator('#infoClose').click();await hidden(page,'#infoDialog');
     assert((await page.evaluate(()=>window.__bfCalls)).length===0,'Guest browsing must not call auth');
     await page.locator('#giftFinder summary').click();await page.locator('#giftInterest').selectOption('coca-cola');await page.locator('#giftBudget').selectOption('50');await page.locator('#giftFilter button').click();await page.locator('#giftResults .bf-find-card').first().waitFor({state:'visible'});
     assert.match(await page.locator('#giftResults').textContent(),/CC-010/);
     await page.locator('#giftInterest').selectOption('automobiles');await page.locator('#giftFilter button').click();assert.match(await page.locator('#giftStatus').textContent(),/No matches/);
     await page.locator('#giftIncludeEnquiry').check();await page.locator('#giftFilter button').click();await page.locator('#giftResults .bf-find-card').first().waitFor({state:'visible'});assert.match(await page.locator('#giftResults').textContent(),/Enquiry only/);
     await card.locator('[data-compare]').click();await page.locator('#compareFinds summary').click();await page.locator('#compareResults .bf-find-card').first().waitFor({state:'visible'});assert.match(await page.locator('#compareCount').textContent(),/1 of 3/);await page.locator('#compareClear').click();assert.match(await page.locator('#compareCount').textContent(),/0 of 3/);
   });
 }
 console.log('Browser launch verification: '+passed+' scenarios passed. No external provider traffic or production data.');
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
