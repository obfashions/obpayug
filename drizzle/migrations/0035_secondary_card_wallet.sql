CREATE TABLE public.merchant_card_balances (merchant_id text PRIMARY KEY,currency text NOT NULL DEFAULT 'UGX' CHECK(currency='UGX'),available_balance numeric NOT NULL DEFAULT 0 CHECK(available_balance>=0),updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.merchant_card_balances TO authenticated;
GRANT ALL ON public.merchant_card_balances TO service_role;
ALTER TABLE public.merchant_card_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read card balances" ON public.merchant_card_balances FOR SELECT TO authenticated USING(merchant_id=auth.uid()::text);
CREATE OR REPLACE FUNCTION public.settle_secondary_card(p_record_id uuid,p_status text,p_fee numeric,p_partner_fee numeric) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.payment_records;
BEGIN
SELECT * INTO r FROM public.payment_records WHERE id=p_record_id FOR UPDATE;
IF r.id IS NULL OR r.settled_at IS NOT NULL THEN RETURN jsonb_build_object('claimed',false,'record',to_jsonb(r)); END IF;
IF r.metadata->>'provider' IS DISTINCT FROM 'marz' OR r.metadata->>'service' IS DISTINCT FROM 'card_payments' OR r.type<>'collection' OR r.currency<>'UGX' THEN RAISE EXCEPTION 'Not a secondary card payment'; END IF;
IF p_status NOT IN ('success','failed') OR p_status IS NULL OR p_fee IS NULL OR p_partner_fee IS NULL OR p_fee::text IN ('NaN','Infinity','-Infinity') OR p_partner_fee::text IN ('NaN','Infinity','-Infinity') OR p_partner_fee<0 OR p_fee<p_partner_fee OR p_fee>r.amount THEN RAISE EXCEPTION 'Invalid confirmed card fee or status'; END IF;
PERFORM pg_advisory_xact_lock(hashtextextended(r.merchant_id,0));
IF p_status='success' THEN INSERT INTO public.merchant_card_balances(merchant_id,available_balance) VALUES(r.merchant_id,r.amount-p_fee) ON CONFLICT(merchant_id) DO UPDATE SET available_balance=merchant_card_balances.available_balance+excluded.available_balance,updated_at=now(); END IF;
UPDATE public.payment_records SET status=p_status,fee_amount=CASE WHEN p_status='success' THEN p_fee ELSE 0 END,net_amount=CASE WHEN p_status='success' THEN amount-p_fee ELSE 0 END,settled_at=now(),balance_applied_at=now(),updated_at=now(),metadata=metadata||jsonb_build_object('partner_fee',p_partner_fee,'obpay_fee',p_fee-p_partner_fee,'restricted_card_wallet',true) WHERE id=r.id RETURNING * INTO r;
RETURN jsonb_build_object('claimed',true,'record',to_jsonb(r));
END; $$;
REVOKE ALL ON FUNCTION public.settle_secondary_card(uuid,text,numeric,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.settle_secondary_card(uuid,text,numeric,numeric) TO service_role;