import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('new Burton & Found Supabase project URL is public API HTTPS and payment flags remain off',()=>{
  const wrangler=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
  assert.equal(wrangler.vars.SUPABASE_URL,'https://nyvdrgpcwfasajyncnhi.supabase.co');
  assert.ok(!wrangler.vars.SUPABASE_SECRET_KEY);
  assert.match(wrangler.vars.SUPABASE_PUBLISHABLE_KEY,/^sb_publishable_[A-Za-z0-9_-]+$/);
  assert.ok(!wrangler.vars.STRIPE_SECRET_KEY);
  assert.ok(!wrangler.vars.STRIPE_WEBHOOK_SECRET);
  assert.equal(wrangler.vars.LIVE_CHECKOUT_ENABLED,'false');
  assert.equal(wrangler.vars.LIVE_PAYMENTS_APPROVED,'false');
  assert.equal(wrangler.vars.TAX_CONFIGURATION_APPROVED,'false');
  assert.equal(wrangler.vars.CARRIER_QUOTES_ENABLED,'false');
});
