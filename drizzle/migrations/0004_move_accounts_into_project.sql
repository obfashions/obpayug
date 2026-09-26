-- Roles
DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('admin','moderator','user'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  email text,
  full_name text,
  phone_number text,
  role text DEFAULT 'merchant',
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  default_currency text DEFAULT 'UGX',
  email_verified boolean DEFAULT true,
  login_verified_at timestamptz,
  login_verification_enabled boolean DEFAULT false,
  support_agent boolean DEFAULT false,
  role_tag text,
  migrated_from_legacy_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin') OR support_agent = true OR role = 'admin');
CREATE POLICY "Profiles insert own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Profiles update own or admin" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Profiles admin delete" ON public.profiles FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Only admins / the server may change privileged profile fields
CREATE OR REPLACE FUNCTION public.guard_profile_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE privileged boolean;
BEGIN
  privileged := coalesce(auth.role(),'') = 'service_role' OR (auth.uid() IS NOT NULL AND public.has_role(auth.uid(),'admin'));
  IF TG_OP = 'INSERT' THEN
    IF NOT privileged THEN
      NEW.role := 'merchant'; NEW.status := 'active'; NEW.support_agent := false; NEW.role_tag := NULL;
      NEW.migrated_from_legacy_at := NULL;
    END IF;
  ELSE
    IF NOT privileged THEN
      NEW.role := OLD.role; NEW.status := OLD.status; NEW.support_agent := OLD.support_agent;
      NEW.role_tag := OLD.role_tag; NEW.migrated_from_legacy_at := OLD.migrated_from_legacy_at; NEW.id := OLD.id;
    END IF;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER profiles_guard BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_profile_fields();

CREATE OR REPLACE FUNCTION public.sync_profile_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role = 'admin' THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id,'admin') ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = NEW.id AND role = 'admin';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER profiles_sync_role AFTER INSERT OR UPDATE OF role ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.sync_profile_role();

-- Wallets
CREATE TABLE public.merchant_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  available_balance numeric DEFAULT 0,
  pending_balance numeric DEFAULT 0,
  total_collections numeric DEFAULT 0,
  total_payouts numeric DEFAULT 0,
  currency text DEFAULT 'UGX',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  welcome_bonus_credited boolean DEFAULT false,
  invested_balance numeric DEFAULT 0,
  daily_withdrawal_limit numeric,
  last_24h_withdrawal_total numeric DEFAULT 0,
  last_withdrawal_reset_at timestamptz DEFAULT now(),
  withdrawals_enabled boolean DEFAULT true,
  payout_mode text DEFAULT 'provider',
  balances_by_currency jsonb
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchant_wallets TO authenticated;
GRANT ALL ON public.merchant_wallets TO service_role;
ALTER TABLE public.merchant_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Wallet read" ON public.merchant_wallets FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Wallet admin write" ON public.merchant_wallets FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Transactions
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reference text NOT NULL,
  amount numeric NOT NULL,
  currency text DEFAULT 'UGX',
  status text DEFAULT 'pending',
  type text NOT NULL,
  payment_method text,
  customer_phone text,
  customer_name text,
  provider_reference text,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  fee_amount numeric DEFAULT 0,
  net_amount numeric DEFAULT 0,
  merchant_reference text,
  completed_at timestamptz,
  description text
);
CREATE INDEX transactions_user_idx ON public.transactions(user_id, created_at DESC);
CREATE INDEX transactions_reference_idx ON public.transactions(reference);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tx read" ON public.transactions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Tx insert own pending" ON public.transactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'pending');
CREATE POLICY "Tx admin write" ON public.transactions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Tx admin delete" ON public.transactions FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Payout requests
CREATE TABLE public.payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  currency text DEFAULT 'UGX',
  phone_number text,
  network text,
  description text,
  status text DEFAULT 'pending',
  provider_reference text,
  rejection_reason text,
  requested_at timestamptz DEFAULT now(),
  processed_at timestamptz,
  completed_at timestamptz,
  fee_amount numeric
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payout_requests TO authenticated;
GRANT ALL ON public.payout_requests TO service_role;
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Payout read" ON public.payout_requests FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Payout insert own" ON public.payout_requests FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'pending');
CREATE POLICY "Payout admin update" ON public.payout_requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Payout admin delete" ON public.payout_requests FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text,
  title text,
  message text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Notif read" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Notif update own" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin')) WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Notif admin insert" ON public.notifications FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Notif delete" ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- Merchant business profiles
CREATE TABLE public.merchant_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_name text,
  country text,
  business_address text,
  national_id text,
  id_front_url text,
  id_back_url text,
  verification_status text DEFAULT 'pending',
  rejection_reason text,
  verified_at timestamptz,
  verified_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  merchant_id text,
  merchant_slug text,
  credentials_generated boolean DEFAULT false
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchant_profiles TO authenticated;
GRANT ALL ON public.merchant_profiles TO service_role;
ALTER TABLE public.merchant_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MP read" ON public.merchant_profiles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "MP insert own" ON public.merchant_profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "MP update own" ON public.merchant_profiles FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin')) WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "MP admin delete" ON public.merchant_profiles FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Support chat
CREATE TABLE public.support_messages (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  sender_id uuid NOT NULL,
  receiver_id uuid,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SM read" ON public.support_messages FOR SELECT TO authenticated USING (sender_id = auth.uid() OR receiver_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "SM insert" ON public.support_messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());
CREATE POLICY "SM update" ON public.support_messages FOR UPDATE TO authenticated USING (receiver_id = auth.uid() OR public.has_role(auth.uid(),'admin')) WITH CHECK (receiver_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.support_tickets (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  subject text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'normal',
  assigned_to uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ST read" ON public.support_tickets FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "ST insert" ON public.support_tickets FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "ST admin update" ON public.support_tickets FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.support_ticket_replies (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  ticket_id bigint NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  message text NOT NULL,
  is_internal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_ticket_replies TO authenticated;
GRANT ALL ON public.support_ticket_replies TO service_role;
ALTER TABLE public.support_ticket_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "STR read" ON public.support_ticket_replies FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR (is_internal = false AND EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid())));
CREATE POLICY "STR insert" ON public.support_ticket_replies FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() AND (public.has_role(auth.uid(),'admin') OR (is_internal = false AND EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid()))));

-- Audit logs
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_name text,
  action text NOT NULL,
  resource text,
  resource_id text,
  ip_address text,
  details jsonb,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Audit admin read" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Audit insert own" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Platform settings (no provider secrets stored here)
CREATE TABLE public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_fee_percent numeric DEFAULT 5.0,
  min_collection_amount numeric DEFAULT 1000,
  min_payout_amount numeric DEFAULT 10000,
  max_payout_amount numeric DEFAULT 10000000,
  maintenance_mode boolean DEFAULT false,
  kyc_required boolean DEFAULT true,
  supported_currencies text[],
  supported_payment_methods text[],
  payout_processing_time text DEFAULT 'Same Day',
  auto_approve_threshold numeric DEFAULT 500000,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  payout_flat_fee numeric DEFAULT 0,
  withdraw_fee_percent numeric DEFAULT 4.5,
  platform_airtel_number text,
  support_email text DEFAULT 'support@obpay.online',
  support_phone text DEFAULT '+256762201984',
  support_whatsapp text,
  welcome_bonus_amount numeric DEFAULT 0,
  withdraw_from_julypay boolean DEFAULT false,
  withdraw_from_livepay boolean DEFAULT false,
  require_login_verification boolean DEFAULT false
);
GRANT SELECT ON public.platform_settings TO anon;
GRANT SELECT, INSERT, UPDATE ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Settings public read" ON public.platform_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Settings admin write" ON public.platform_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Company documents
CREATE TABLE public.company_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type text NOT NULL,
  document_name text NOT NULL,
  document_url text NOT NULL,
  description text,
  uploaded_by uuid,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_documents TO authenticated;
GRANT ALL ON public.company_documents TO service_role;
ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Docs read" ON public.company_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Docs admin write" ON public.company_documents FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Email campaign logs
CREATE TABLE public.email_campaign_logs (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  recipient_email text NOT NULL,
  recipient_name text,
  campaign_type text NOT NULL,
  subject text NOT NULL,
  body_preview text,
  status text DEFAULT 'sent',
  sent_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT ON public.email_campaign_logs TO authenticated;
GRANT ALL ON public.email_campaign_logs TO service_role;
ALTER TABLE public.email_campaign_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Campaign admin" ON public.email_campaign_logs FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Live updates for dashboards and chat
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions, public.merchant_wallets, public.support_messages, public.notifications, public.payout_requests;