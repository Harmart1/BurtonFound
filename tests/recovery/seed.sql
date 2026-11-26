-- TEST FIXTURE ONLY. Synthetic records; no provider connections.
INSERT INTO auth.users(id) VALUES ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
INSERT INTO public.bf_admin_users(user_id) VALUES ('11111111-1111-4111-8111-111111111111');
INSERT INTO public.collector_profiles(user_id,full_name) VALUES ('11111111-1111-4111-8111-111111111111','Synthetic One'),('22222222-2222-4222-8222-222222222222','Synthetic Two');
INSERT INTO public.bf_products(sku,title,price_cents,collection) VALUES ('FIX-001','Synthetic original',1000,'test'),('FIX-002','Synthetic second original',2000,'test'),('FIX-SET','Synthetic set',2500,'test');
INSERT INTO public.bf_units(id) VALUES ('UNIT-001'),('UNIT-002');
INSERT INTO public.bf_product_units(sku,unit_id) VALUES ('FIX-001','UNIT-001'),('FIX-002','UNIT-002'),('FIX-SET','UNIT-001'),('FIX-SET','UNIT-002');
DO $$
DECLARE h uuid;
BEGIN
 h := (public.bf_hold_cart(ARRAY['FIX-001'],'11111111-1111-4111-8111-111111111111') ->> 'id')::uuid;
 PERFORM public.bf_bind_stripe_session(h,'cs_test_recovery_fixture_001');
 PERFORM public.bf_mark_checkout_paid('cs_test_recovery_fixture_001','evt_fixture_paid',1500,'cad','fixture@example.invalid','{}'::jsonb,'pi_fixture',500);
END $$;
