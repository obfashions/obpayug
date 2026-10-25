-- Update both reservation overloads without changing locks, allocations or refunds.
DO $migration$
DECLARE f record; definition text;
BEGIN
 FOR f IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='reserve_payout_and_balance' LOOP
  definition := pg_get_functiondef(f.oid);
  IF position('p_currency NOT IN (''UGX'',''KES'',''RWF'')' in definition)=0 THEN
   RAISE EXCEPTION 'Unexpected payout reservation validation; review before migration';
  END IF;
  definition := replace(definition, 'p_currency NOT IN (''UGX'',''KES'',''RWF'')', 'p_amount IS NULL OR p_amount::text IN (''NaN'',''Infinity'',''-Infinity'') OR p_currency IS NULL OR p_currency NOT IN (''UGX'',''KES'',''RWF'',''NGN'',''XOF'',''ZMW'',''SLL'',''CDF'',''XAF'')');
  IF position('debit := coalesce(p_debit, p_amount);' in definition)>0 THEN
   definition := replace(definition, 'debit := coalesce(p_debit, p_amount);', 'debit := coalesce(p_debit, p_amount); IF debit::text IN (''NaN'',''Infinity'',''-Infinity'') THEN RAISE EXCEPTION ''Invalid payout debit''; END IF;');
  END IF;
  EXECUTE definition;
 END LOOP;
END;
$migration$;
REVOKE ALL ON FUNCTION public.reserve_payout_and_balance(text,text,numeric,text,text,text,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_payout_and_balance(text,text,numeric,text,text,text,text,jsonb,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_payout_and_balance(text,text,numeric,text,text,text,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_payout_and_balance(text,text,numeric,text,text,text,text,jsonb,numeric) TO service_role;