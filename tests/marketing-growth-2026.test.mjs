import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Evergreen gift page includes real catalogue links, search metadata and honest disclaimers',()=>{
  const gift='public/gifts/vintage-gifts-for-collectors.html';
  assert.ok(existsSync(new URL('../'+gift,import.meta.url)));
  const html=read(gift);
  assert.match(html,/Vintage gift ideas for collectors/);
  assert.match(html,/For vintage advertising fans/);
  assert.match(html,/For classic movie lovers/);
  assert.match(html,/For the collector who enjoys a theme/);
  assert.match(html,/\/products\/[a-z0-9-]+\.html/);
  assert.match(html,/meta property="og:image:alt"/);
  assert.match(html,/meta name="twitter:image"/);
  assert.match(html,/data-bf-copy-link/);
  assert.match(html,/data-bf-share-platform="pinterest"/);
  assert.match(html,/Check current checkout availability in the shop/);
  assert.match(html,/noindex,follow/);
  assert.match(read('public/sitemap.xml'),/\/gifts\/vintage-gifts-for-collectors\.html/);
});
test('Storefront links to gifting and has working share assets without third party embeds',()=>{
  for(const p of ['public/index.html','public/storefront.html']){
    const html=read(p);
    assert.match(html,/gifts\/vintage-gifts-for-collectors\.html/);
    assert.match(html,/src="marketing-share\.js"/);
    assert.match(html,/href="marketing-growth\.css"/);
    assert.match(html,/data-bf-share-platform="facebook"/);
  }
  const code=read('public/marketing-share.js');
  assert.match(code,/navigator\.share/);
  assert.match(code,/navigator\.clipboard/);
  assert.match(code,/pinterest\.com\/pin\/create/);
  assert.doesNotMatch(code,/gtag\(|fbq\(|analytics\.js|localStorage|sendBeacon/);
  execFileSync(process.execPath,['--check',new URL('../public/marketing-share.js',import.meta.url).pathname]);
});
test('Product page marketing has social metadata and in-context sharing without fake Offers',()=>{
  const text=read('public/product-links.js').match(/window\.BURTON_PRODUCT_LINKS = (\{[\s\S]+\});/)[1];
  const paths=Object.values(JSON.parse(text));
  assert.equal(paths.length,229);
  for(const url of paths.slice(0,12)){
    const html=read('public'+url);
    assert.match(html,/meta property="og:image:alt"/);
    assert.match(html,/meta name="twitter:image"/);
    assert.match(html,/data-bf-copy-link/);
    assert.match(html,/data-bf-share-platform="pinterest"/);
    assert.doesNotMatch(html,/"@type":"Offer"/);
  }
  const config=JSON.parse(read('wrangler.jsonc'));
  for(const flag of ['LIVE_CHECKOUT_ENABLED','LIVE_PAYMENTS_APPROVED','TAX_CONFIGURATION_APPROVED','MARKETING_INDEXING_APPROVED'])
    assert.equal(config.vars[flag],'false');
});
