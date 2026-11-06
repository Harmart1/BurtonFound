-- Run AFTER 001 and 002: record the reason a paid international or domestic shipment needs review.
BEGIN;
ALTER TABLE public.bf_orders ADD COLUMN IF NOT EXISTS shipping_review_reason text NOT NULL DEFAULT '';
ALTER TABLE public.bf_orders ADD COLUMN IF NOT EXISTS selected_shipping_carrier text NOT NULL DEFAULT '';
ALTER TABLE public.bf_orders ADD COLUMN IF NOT EXISTS selected_shipping_service text NOT NULL DEFAULT '';
ALTER TABLE public.bf_orders ADD COLUMN IF NOT EXISTS selected_shipping_eta date;
CREATE OR REPLACE FUNCTION public.bf_flag_shipping_mismatch(p_session_id text,p_reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 UPDATE public.bf_orders SET payment_status='review',fulfillment_status='needs_attention',
  shipping_review_reason=left(coalesce(p_reason,'Shipping information requires manual review'),220)
 WHERE stripe_session_id=p_session_id AND payment_status IN ('paid','review');
 RETURN FOUND;
END $$;
REVOKE EXECUTE ON FUNCTION public.bf_flag_shipping_mismatch(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bf_flag_shipping_mismatch(text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.bf_record_shipping_selection(p_session_id text,p_carrier text,p_service text,p_eta text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 UPDATE public.bf_orders SET selected_shipping_carrier=left(coalesce(p_carrier,''),50),
 selected_shipping_service=left(coalesce(p_service,''),80),
 selected_shipping_eta=CASE WHEN p_eta~'^\d{4}-\d{2}-\d{2}$' THEN p_eta::date ELSE NULL END
 WHERE stripe_session_id=p_session_id;
 RETURN FOUND;
END $$;
REVOKE EXECUTE ON FUNCTION public.bf_record_shipping_selection(text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bf_record_shipping_selection(text,text,text,text) TO service_role;
COMMIT;
