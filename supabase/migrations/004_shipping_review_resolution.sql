-- Shipping review resolution. Apply after migrations 001, 002 and 003.
-- Manual acknowledgment ONLY for a paid/owned shipping-address mismatch.
-- Never unblocks a duplicate inventory sale or releases payment without verification.
BEGIN;
ALTER TABLE public.bf_orders ADD COLUMN IF NOT EXISTS shipping_review_resolved_at timestamptz;
ALTER TABLE public.bf_orders ADD COLUMN IF NOT EXISTS shipping_review_resolved_by uuid references auth.users(id) on delete set null;
ALTER TABLE public.bf_orders ADD COLUMN IF NOT EXISTS shipping_review_resolution_note text NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.bf_resolve_shipping_review(
 p_order_id uuid, p_admin_id uuid, p_note text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_order public.bf_orders%rowtype; v_hold public.bf_checkout_holds%rowtype;
BEGIN
 IF p_admin_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.bf_admin_users a WHERE a.user_id=p_admin_id) THEN
    RAISE EXCEPTION 'Administrator authorization required';
 END IF;
 IF length(btrim(coalesce(p_note,'')))<20 OR length(p_note)>1000 THEN
    RAISE EXCEPTION 'A specific review note of 20–1000 characters is required';
 END IF;
 SELECT * INTO v_order FROM public.bf_orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
 IF v_order.payment_status<>'review' OR v_order.fulfillment_status<>'needs_attention' THEN
   RAISE EXCEPTION 'Order is not awaiting review';
 END IF;
 IF v_order.shipping_review_reason='' THEN
   RAISE EXCEPTION 'This hold does not concern a shipping-address mismatch';
 END IF;
 SELECT * INTO v_hold FROM public.bf_checkout_holds WHERE id=v_order.hold_id FOR UPDATE;
 IF NOT FOUND OR v_hold.status<>'paid' THEN
   RAISE EXCEPTION 'Underlying payment inventory requires manual reconciliation/refund';
 END IF;
 -- Every physical unit must already belong exclusively to this paid order.
 IF EXISTS(SELECT 1 FROM public.bf_units u WHERE u.id=ANY(v_hold.unit_ids) AND u.sold_order_id IS DISTINCT FROM v_order.id) THEN
   RAISE EXCEPTION 'Inventory conflict. Do not fulfill this order';
 END IF;
 UPDATE public.bf_orders
 SET payment_status='paid', fulfillment_status='processing',
 shipping_review_resolved_at=now(),shipping_review_resolved_by=p_admin_id,
 shipping_review_resolution_note=left(btrim(p_note),1000)
 WHERE id=p_order_id;
 INSERT INTO public.bf_fulfillment_events(order_id,admin_id,previous_status,new_status,carrier,tracking_number)
 VALUES (p_order_id,p_admin_id,'needs_attention','processing',v_order.carrier,v_order.tracking_number);
 RETURN (SELECT to_jsonb(o) FROM public.bf_orders o WHERE o.id=p_order_id);
END $$;
REVOKE EXECUTE ON FUNCTION public.bf_resolve_shipping_review(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bf_resolve_shipping_review(uuid,uuid,text) TO service_role;
-- Customer-facing confirmation must not report an order as fully accepted while
-- paid shipping details or an inventory conflict still need owner attention.
CREATE OR REPLACE VIEW public.bf_checkout_public_status AS
 SELECT h.stripe_session_id,
 CASE WHEN o.payment_status='review' OR o.fulfillment_status='needs_attention' OR h.status='review' THEN 'review'
      WHEN h.status='paid' AND o.payment_status='paid' THEN 'paid'
      WHEN h.status IN ('expired','released') THEN 'expired'
      ELSE 'processing' END AS status,
 CASE WHEN o.payment_status='paid' THEN left(o.id::text,8) ELSE NULL END AS order_ref
 FROM public.bf_checkout_holds h LEFT JOIN public.bf_orders o ON o.hold_id=h.id;
REVOKE ALL ON public.bf_checkout_public_status FROM anon,authenticated;
GRANT SELECT ON public.bf_checkout_public_status TO service_role;

COMMIT;
