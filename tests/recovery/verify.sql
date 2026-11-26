-- TEST FIXTURE ONLY. Assertions run against restored, isolated database.
DO $$
BEGIN
 IF (SELECT count(*) FROM public.bf_products)<>3 THEN RAISE EXCEPTION 'product restore mismatch'; END IF;
 IF (SELECT count(*) FROM public.bf_units)<>2 THEN RAISE EXCEPTION 'physical units restore mismatch'; END IF;
 IF (SELECT count(*) FROM public.bf_orders WHERE payment_status='paid' AND total_cents=1500)<>1 THEN RAISE EXCEPTION 'paid order restore mismatch'; END IF;
 IF (SELECT count(*) FROM public.bf_units WHERE sold_order_id IS NOT NULL)<>1 THEN RAISE EXCEPTION 'sold unit restore mismatch'; END IF;
 IF (SELECT count(*) FROM public.bf_public_stock WHERE available)<>1 THEN RAISE EXCEPTION 'overlap stock protection restore mismatch'; END IF;
 IF (SELECT count(*) FROM public.bf_webhook_events WHERE id='evt_fixture_paid')<>1 THEN RAISE EXCEPTION 'webhook restore mismatch'; END IF;
 IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND (c.relname LIKE 'bf_%' OR c.relname LIKE 'collector_%') AND c.relrowsecurity)<>16 THEN RAISE EXCEPTION 'RLS restore mismatch'; END IF;
 IF has_table_privilege('anon','public.bf_orders','SELECT') OR has_table_privilege('anon','public.bf_admin_users','SELECT') OR has_table_privilege('authenticated','public.bf_checkout_public_status','SELECT') THEN RAISE EXCEPTION 'private table/view grant regression'; END IF;
 IF has_function_privilege('authenticated','public.bf_hold_cart(text[],uuid)','EXECUTE') OR has_function_privilege('anon','public.bf_mark_checkout_paid(text,text,integer,text,text,jsonb,text,integer)','EXECUTE') THEN RAISE EXCEPTION 'privileged RPC grant regression'; END IF;
 IF NOT has_function_privilege('service_role','public.bf_hold_cart(text[],uuid)','EXECUTE') THEN RAISE EXCEPTION 'service grant missing'; END IF;
 IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='bf-cms-media') THEN RAISE EXCEPTION 'storage metadata missing'; END IF;
END $$;
SET ROLE authenticated;
SET request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
DO $$ BEGIN
 IF (SELECT count(*) FROM public.collector_profiles)<>1 THEN RAISE EXCEPTION 'profile RLS failed'; END IF;
 IF (SELECT count(*) FROM public.bf_orders)<>0 THEN RAISE EXCEPTION 'cross-account order exposure'; END IF;
END $$;
SET request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
DO $$ BEGIN
 IF (SELECT count(*) FROM public.bf_orders)<>1 THEN RAISE EXCEPTION 'owner order policy restore failed'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF public.bf_mark_checkout_paid('cs_test_recovery_fixture_001','evt_fixture_paid',1500,'cad','fixture@example.invalid','{}'::jsonb,'pi_fixture',500)->>'status' <> 'duplicate' THEN RAISE EXCEPTION 'idempotency restore failed'; END IF;
END $$;
