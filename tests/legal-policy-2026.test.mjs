import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const read=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const slugs=['privacy','terms','shipping-returns','cookies','accessibility'];
const staticPages=['index','storefront','account','books','collectibles','vintage-cars','papertrail','preview','review','old-hollywood-new','checkout-success'];
test('five substantive Ontario/Canada policy pages provide fully functional standalone navigation',()=>{
  for(const slug of slugs){
    const path='public/policies/'+slug+'.html';
    assert.ok(existsSync(new URL('../'+path,import.meta.url)),path);
    const html=read(path);
    assert.match(html,/lang="en-CA"/);
    assert.match(html,/data-bf-policy-content/);
    assert.match(html,/Effective 20 November 2026/);
    assert.match(html,/<h1>/);
    assert.match(html,/privacy\.html/);
    assert.match(html,/terms\.html/);
    assert.match(html,/shipping-returns\.html/);
    assert.match(html,/cookies\.html/);
    assert.match(html,/accessibility\.html/);
    assert.match(html,/src="\/policy-modal\.js"/);
    assert.match(html,/href="\/policy-pages\.css"/);
    assert.ok((html.match(/<h2>/g)||[]).length>=5,'Policy must contain detailed sections');
    assert.doesNotMatch(html,/<script[^>]*>\s*\S/,'Policies should not embed inline executable scripts');
  }
});
test('Privacy, marketing and consumer policies are grounded in applicable statutes, not waived',()=>{
  const privacy=read('public/policies/privacy.html');
  for(const term of ['PIPEDA','Cloudflare','Supabase','Stripe','cross','marketing','access','retained','browser','privacy'])assert.ok(privacy.toLowerCase().includes(term.toLowerCase()),term);
  assert.match(privacy,/Anti-Spam Legislation/);
  const sale=read('public/policies/shipping-returns.html');
  assert.match(sale,/Consumer Protection Act, 2002/);
  assert.match(sale,/Online card checkout is disabled/);
  assert.match(sale,/not yet established an optional change-of-mind return window/);
  assert.match(sale,/does not override, statutory cancellation/);
  const terms=read('public/policies/terms.html');
  assert.match(terms,/statutory warranties/);
  assert.match(terms,/not affiliated/);
  assert.match(terms,/cannot be guaranteed/);
  const cookies=read('public/policies/cookies.html');
  assert.match(cookies,/local storage/);
  assert.match(cookies,/does not intentionally install/);
  assert.match(read('public/policies/accessibility.html'),/Accessibility for Ontarians with Disabilities Act/);
});
test('Every static visitor-facing page links to all policies with a safe modal fallback',()=>{
  for(const name of staticPages){
    const html=read('public/'+name+'.html');
    assert.match(html,/src="\/policy-modal\.js"/,name);
    assert.match(html,/href="\/policy-modal\.css"/,name);
    for(const slug of slugs){
      assert.ok(html.includes('href="/policies/'+slug+'.html" data-policy="'+slug+'"'),name+' '+slug);
    }
    assert.match(html,/<footer[\s>]/,name);
  }
  const account=read('public/account.html');
  assert.match(account,/<a href="\/policies\/privacy\.html" data-policy="privacy">full Privacy Policy<\/a>/);
});
test('Generated collectible detail, gift, collection and guide pages expose the policies',()=>{
  for(const p of ['public/collections/coca-cola.html','public/collections/hollywood.html','public/collections/sets.html','public/gifts/vintage-gifts-for-collectors.html','public/guides/caring-for-vintage-paper.html']){
    const html=read(p);
    assert.match(html,/src="\/policy-modal\.js"/);
    for(const slug of slugs)assert.ok(html.includes('data-policy="'+slug+'"'),p+' '+slug);
  }
  const urls=JSON.parse(read('public/product-links.js').match(/window\.BURTON_PRODUCT_LINKS = (\{[\s\S]*\});/)[1]);
  assert.equal(Object.keys(urls).length,131);
  for(const path of Object.values(urls).slice(0,10)){
    const html=read('public'+path);
    assert.match(html,/data-policy="privacy"/);
    assert.match(html,/data-policy="terms"/);
    assert.match(html,/src="\/policy-modal\.js"/);
  }
});
test('Policy modal uses native dialog, close buttons and focus restoration without intrusive browser windows',()=>{
  const js=read('public/policy-modal.js');
  assert.match(js,/createElement\('dialog'\)/);
  assert.match(js,/dialog\.showModal\(\)/);
  assert.match(js,/dialog\.close\(\)/);
  assert.match(js,/addEventListener\('close'/);
  assert.match(js,/element\.focus/);
  assert.match(js,/data-policy/);
  assert.match(js,/if\(!slug\)return/);
  assert.match(js,/Open the full policy page/);
  assert.match(js,/dialog\.querySelectorAll\('\.bf-policy-dialog-close,\.bf-policy-dialog-bottom-close'\)/);
  assert.doesNotMatch(js,/window\.open\(/);
  execFileSync(process.execPath,['--check',new URL('../public/policy-modal.js',import.meta.url).pathname]);
  execFileSync(process.execPath,['--check',new URL('../public/store.js',import.meta.url).pathname]);
});
test('Publishing policy pages did not enable financial, shipping, or search indexing gates',()=>{
  const vars=JSON.parse(read('wrangler.jsonc')).vars;
  for(const key of ['LIVE_CHECKOUT_ENABLED','LIVE_PAYMENTS_APPROVED','TAX_CONFIGURATION_APPROVED','CARRIER_QUOTES_ENABLED','MARKETING_INDEXING_APPROVED'])
    assert.equal(vars[key],'false',key);
  assert.match(read('public/index.html'),/noindex, nofollow/);
  assert.match(read('public/marketing-stock.js'),/api\/catalog/);
});
