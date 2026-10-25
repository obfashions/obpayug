CREATE OR REPLACE FUNCTION public.protect_main_wallet_currency()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.default_currency IS DISTINCT FROM NEW.default_currency
     AND EXISTS (SELECT 1 FROM public.merchant_wallets WHERE user_id = OLD.id) THEN
    RAISE EXCEPTION 'The account currency cannot relabel existing funds. Choose the displayed wallet without changing the account currency.';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_main_wallet_currency() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER protect_main_wallet_currency
BEFORE UPDATE OF default_currency ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_main_wallet_currency();