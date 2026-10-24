ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS currency_fees jsonb NOT NULL DEFAULT '{"RWF":{"withdraw":1}}'::jsonb;

UPDATE public.platform_settings
SET supported_currencies = ARRAY['UGX','KES','RWF','NGN','XOF','USD','ZMW','SLL','CDF','XAF']
WHERE supported_currencies IS NULL OR array_length(supported_currencies, 1) < 10;