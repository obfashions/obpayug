-- Partner confirmed these payouts as completed; settle them (debits balance once).
SELECT public.settle_payment_record_and_balance(id, 'success', coalesce(fee_amount, 0), provider_reference)
FROM public.payment_records
WHERE type = 'payout' AND status = 'pending'
  AND id IN ('622909b9-74b3-431c-8678-a13d8c040d63', '7417cb6d-1b78-4f43-8a8c-1b3f0cabbb3f');