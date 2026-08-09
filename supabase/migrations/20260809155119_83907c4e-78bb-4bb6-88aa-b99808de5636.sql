CREATE TABLE public.platform_credentials (
  id TEXT PRIMARY KEY,
  api_key TEXT,
  api_secret TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

REVOKE ALL ON public.platform_credentials FROM anon, authenticated;
GRANT ALL ON public.platform_credentials TO service_role;
ALTER TABLE public.platform_credentials ENABLE ROW LEVEL SECURITY;