import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('all automobile pages are enquiry-only with no payment offer or live stock enhancement',()=>{
 const links=JSON.parse(read('public/product-links.js').match(/window\.BURTON_PRODUCT_LINKS = (\{[\s\S]+\});/)[1]);
 const auto=Object.entries(links).filter(([sku])=>/^(VA-|BF-VA-SET)/.test(sku));
 assert.equal(auto.length,98);
 for(const [sku,path] of auto){const html=read('public'+path);assert.match(html,/Enquiry only · physical inventory unverified/);assert.match(html,/request details/);assert.match(html,/noindex,follow/);assert.doesNotMatch(html,/"@type":"Offer"|data-bf-stock-sku|src="\/marketing-stock.js"|add to bag/);assert.match(html,/Vintage automobile advertising/);}
 const feed=JSON.parse(read('public/feeds/collectibles.json'));assert.ok(feed.items.every(x=>!/^VA-|^BF-VA-SET/.test(x._burton.sku)));
 assert.equal(read('marketing-output/automobile-enquiry-promotions.csv').trim().split('\n').length,99);
 assert.equal(read('marketing-output/pinterest-and-social-catalog.csv').trim().split('\n').length,132);
});
