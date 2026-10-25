CREATE TABLE public.merchant_fee_exemptions (
  merchant_id uuid PRIMARY KEY,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.merchant_fee_exemptions TO authenticated;
GRANT ALL ON public.merchant_fee_exemptions TO service_role;
ALTER TABLE public.merchant_fee_exemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchants read own fee exemption" ON public.merchant_fee_exemptions
  FOR SELECT TO authenticated USING (merchant_id = auth.uid());