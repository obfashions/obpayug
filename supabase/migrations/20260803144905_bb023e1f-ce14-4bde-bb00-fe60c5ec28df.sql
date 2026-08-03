-- Defense in depth: these tables are only ever accessed by trusted server code
-- using the service role. Explicitly revoke all Data API access so no future
-- default-privilege change can expose them to browsers.

REVOKE ALL ON public.kyc_submissions   FROM anon, authenticated;
REVOKE ALL ON public.kyc_documents     FROM anon, authenticated;
REVOKE ALL ON public.merchant_api_keys FROM anon, authenticated;
REVOKE ALL ON public.payment_records   FROM anon, authenticated;
REVOKE ALL ON public.payment_links     FROM anon, authenticated;
REVOKE ALL ON public.webhook_endpoints FROM anon, authenticated;
REVOKE ALL ON public.webhook_deliveries FROM anon, authenticated;
REVOKE ALL ON public.api_request_logs  FROM anon, authenticated;

GRANT ALL ON public.kyc_submissions   TO service_role;
GRANT ALL ON public.kyc_documents     TO service_role;
GRANT ALL ON public.merchant_api_keys TO service_role;
GRANT ALL ON public.payment_records   TO service_role;
GRANT ALL ON public.payment_links     TO service_role;
GRANT ALL ON public.webhook_endpoints TO service_role;
GRANT ALL ON public.webhook_deliveries TO service_role;
GRANT ALL ON public.api_request_logs  TO service_role;

-- Keep the deny-by-default posture for anything added later in this schema.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;

COMMENT ON TABLE public.kyc_submissions IS 'Server-only (service role). RLS enabled with no policies: all browser access denied by design; ownership is enforced in server functions.';
COMMENT ON TABLE public.merchant_api_keys IS 'Server-only (service role). Secret hashes; RLS enabled with no policies by design.';
COMMENT ON TABLE public.payment_records IS 'Server-only (service role). RLS enabled with no policies by design.';
COMMENT ON TABLE public.webhook_endpoints IS 'Server-only (service role). Webhook secrets; RLS enabled with no policies by design.';