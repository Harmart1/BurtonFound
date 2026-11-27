-- Disposable CI database only; never run against hosted Supabase.
INSERT INTO public.bf_products(sku,title,price_cents,collection) VALUES ('QA-001','QA original',1000,'test'),('QA-002','QA second original',2000,'test'),('QA-SET','QA overlapping set',2500,'test');
INSERT INTO public.bf_units(id) VALUES ('QA-UNIT-1'),('QA-UNIT-2');
INSERT INTO public.bf_product_units(sku,unit_id) VALUES ('QA-001','QA-UNIT-1'),('QA-002','QA-UNIT-2'),('QA-SET','QA-UNIT-1'),('QA-SET','QA-UNIT-2');
