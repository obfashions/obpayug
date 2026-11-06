CREATE TABLE public.merchant_bank_accounts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 merchant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 bank_name text NOT NULL CHECK (length(bank_name) BETWEEN 1 AND 100),
 account_number text NOT NULL CHECK (account_number ~ '^[0-9]{5,30}$'),
 account_name text NOT NULL CHECK (length(account_name) BETWEEN 2 AND 120),
 branch text NOT NULL DEFAULT '',
 currency text NOT NULL DEFAULT 'UGX' CHECK (currency = 'UGX'),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (merchant_id, bank_name, account_number)
);
GRANT SELECT, INSERT, DELETE ON public.merchant_bank_accounts TO authenticated;
GRANT ALL ON public.merchant_bank_accounts TO service_role;
ALTER TABLE public.merchant_bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY bank_accounts_owner_read ON public.merchant_bank_accounts FOR SELECT TO authenticated USING (merchant_id = auth.uid());
CREATE POLICY bank_accounts_owner_insert ON public.merchant_bank_accounts FOR INSERT TO authenticated WITH CHECK (merchant_id = auth.uid());
CREATE POLICY bank_accounts_owner_delete ON public.merchant_bank_accounts FOR DELETE TO authenticated USING (merchant_id = auth.uid());