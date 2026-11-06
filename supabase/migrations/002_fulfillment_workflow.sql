-- Burton & Found — manual fulfillment workflow improvements
-- Run after 001_accounts_and_commerce.sql (safe for an existing installation).
-- This script does not change or reset product inventory or existing orders.
BEGIN;
CREATE TABLE IF NOT EXISTS public.bf_fulfillment_events (
 id bigint generated always as identity primary key,
 order_id uuid not null references public.bf_orders(id) on delete restrict,
 admin_id uuid references auth.users(id) on delete set null,
 previous_status text not null,
 new_status text not null,
 carrier text not null default '',
 tracking_number text not null default '',
 created_at timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS bf_fulfillment_events_order_idx ON public.bf_fulfillment_events(order_id,created_at DESC);
ALTER TABLE public.bf_fulfillment_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.bf_fulfillment_events FROM public, anon, authenticated;
GRANT SELECT, INSERT ON public.bf_fulfillment_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.bf_fulfillment_events_id_seq TO service_role;

-- Only trusted server code (service role) may call this function, after verifying
-- the request's JWT belongs to a listed administrator.
CREATE OR REPLACE FUNCTION public.bf_update_fulfillment(
 p_order_id uuid,p_status text,p_carrier text,p_tracking text,p_admin_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_order public.bf_orders%rowtype; v_carrier text; v_tracking text;
BEGIN
 SELECT * INTO v_order FROM public.bf_orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR v_order.payment_status<>'paid' THEN RAISE EXCEPTION 'paid order not found'; END IF;
 IF p_status NOT IN ('processing','packed','shipped','delivered','needs_attention') THEN RAISE EXCEPTION 'invalid fulfillment status'; END IF;
 IF p_admin_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.bf_admin_users WHERE user_id=p_admin_id) THEN RAISE EXCEPTION 'not an authorized owner'; END IF;
 v_carrier:=left(btrim(coalesce(p_carrier,'')),50);
 v_tracking:=left(btrim(coalesce(p_tracking,'')),100);
 IF p_status IN ('shipped','delivered') AND (v_carrier='' OR v_tracking='') THEN RAISE EXCEPTION 'shipped and delivered orders require carrier and tracking'; END IF;
 IF (v_order.fulfillment_status,v_order.carrier,v_order.tracking_number)
  IS DISTINCT FROM (p_status,v_carrier,v_tracking) THEN
   UPDATE public.bf_orders SET fulfillment_status=p_status,carrier=v_carrier,
     tracking_number=v_tracking,
     shipped_at=CASE WHEN p_status='shipped' AND shipped_at IS NULL THEN now() ELSE shipped_at END
   WHERE id=p_order_id;
   INSERT INTO public.bf_fulfillment_events(order_id,admin_id,previous_status,new_status,carrier,tracking_number)
   VALUES(p_order_id,p_admin_id,v_order.fulfillment_status,p_status,v_carrier,v_tracking);
 END IF;
 RETURN (SELECT to_jsonb(o) FROM public.bf_orders o WHERE o.id=p_order_id);
END $$;
REVOKE EXECUTE ON FUNCTION public.bf_update_fulfillment(uuid,text,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bf_update_fulfillment(uuid,text,text,text,uuid) TO service_role;

-- Do not mark a SKU available if no underlying physical piece is registered.
CREATE OR REPLACE VIEW public.bf_public_stock AS
SELECT p.sku,p.price_cents,
 (p.active AND EXISTS(SELECT 1 FROM public.bf_product_units rel WHERE rel.sku=p.sku)
 AND NOT EXISTS (
  SELECT 1 FROM public.bf_product_units pu JOIN public.bf_units u ON u.id=pu.unit_id
  WHERE pu.sku=p.sku AND (
    u.sold_order_id IS NOT NULL OR EXISTS(
      SELECT 1 FROM public.bf_checkout_holds h
      WHERE h.unit_ids @> ARRAY[u.id] AND h.status IN ('creating','reserved','review')
    )
  )
 )) AS available
FROM public.bf_products p;
REVOKE ALL ON public.bf_public_stock FROM anon,authenticated;
GRANT SELECT ON public.bf_public_stock TO service_role;
COMMIT;
