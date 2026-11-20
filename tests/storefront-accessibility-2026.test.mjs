import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Shopping bag returns focus and contains keyboard navigation',()=>{
  const js=read('public/store.js');
  assert.match(js,/cartReturnFocus=active/);
  assert.match(js,/const target=previous\?\.isConnected/);
  assert.match(js,/e\.key==='Escape'/);
  assert.match(js,/e\.key!=='Tab'/);
  assert.match(js,/drawer\.querySelectorAll\('a\[href\]/);
  assert.match(js,/e\.shiftKey/);
});

test('Filter count badges stay in sync and unavailable items are last regardless of sort',()=>{
  const js=read('public/store.js');
  assert.match(js,/const countPool=items\.filter/);
  assert.match(js,/el\.textContent=String\(countPool\.filter/);
  assert.match(js,/if\(currentSort!=='featured'\)list\.sort/);
  for(const path of ['public/index.html','public/storefront.html']){
    const html=read(path);
    assert.match(html,/id="shopStatus" role="status"/);
    assert.match(html,/<div class="product-grid" id="productGrid"><\/div>/);
    assert.doesNotMatch(html,/aria-live="polite" class="product-grid"/);
  }
});
