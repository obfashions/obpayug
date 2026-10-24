CREATE TABLE public.merchant_payout_preferences (
 merchant_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 fee_mode text NOT NULL DEFAULT 'account' CHECK (fee_mode IN ('account','amount')),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.merchant_payout_preferences TO authenticated;
GRANT ALL ON public.merchant_payout_preferences TO service_role;
ALTER TABLE public.merchant_payout_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own payout preferences" ON public.merchant_payout_preferences FOR SELECT TO authenticated USING (merchant_id = auth.uid());
CREATE POLICY "Insert own payout preferences" ON public.merchant_payout_preferences FOR INSERT TO authenticated WITH CHECK (merchant_id = auth.uid());
CREATE POLICY "Update own payout preferences" ON public.merchant_payout_preferences FOR UPDATE TO authenticated USING (merchant_id = auth.uid()) WITH CHECK (merchant_id = auth.uid());