CREATE OR REPLACE FUNCTION public.admin_merchant_directory(p_search text DEFAULT '', p_status text DEFAULT 'all', p_verification text DEFAULT 'all', p_account_type text DEFAULT 'all', p_page integer DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
WITH accounts AS (
 SELECT p.id,p.full_name,p.email,p.phone_number,p.role,p.status,p.created_at,
 coalesce(k.account_type,'personal') AS account_type,
 coalesce(k.status,mp.verification_status,'not_submitted') AS verification_status,
 coalesce(nullif(k.business_name,''),mp.company_name) AS company_name,
 mp.country,mp.business_address,mp.merchant_slug,mp.merchant_id
 FROM public.profiles p
 LEFT JOIN public.merchant_profiles mp ON mp.user_id=p.id
 LEFT JOIN LATERAL (SELECT account_type,status,business_name FROM public.kyc_submissions WHERE merchant_id=p.id::text ORDER BY created_at DESC LIMIT 1) k ON true
 WHERE p.status <> 'deactivated'
), filtered AS (
 SELECT * FROM accounts WHERE
 (p_status='all' OR status=p_status) AND
 (p_verification='all' OR verification_status=p_verification) AND
 (p_account_type='all' OR account_type=p_account_type) AND
 (p_search='' OR full_name ILIKE '%'||left(p_search,120)||'%' OR email ILIKE '%'||left(p_search,120)||'%' OR company_name ILIKE '%'||left(p_search,120)||'%' OR merchant_id ILIKE '%'||left(p_search,120)||'%')
), page_rows AS (SELECT * FROM filtered ORDER BY created_at DESC,id DESC LIMIT 50 OFFSET greatest(0,least(p_page,100000))*50)
SELECT jsonb_build_object('total',(SELECT count(*) FROM filtered),'rows',coalesce((SELECT jsonb_agg(to_jsonb(r)) FROM page_rows r),'[]'::jsonb),'summary',jsonb_build_object('accounts',(SELECT count(*) FROM accounts),'business',(SELECT count(*) FROM accounts WHERE account_type='business'),'pending',(SELECT count(*) FROM accounts WHERE verification_status='pending'),'active',(SELECT count(*) FROM accounts WHERE status='active')));
$$;
REVOKE ALL ON FUNCTION public.admin_merchant_directory(text,text,text,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_merchant_directory(text,text,text,text,integer) TO service_role;
CREATE INDEX IF NOT EXISTS profiles_directory_order_idx ON public.profiles(created_at DESC,id DESC) WHERE status <> 'deactivated';
CREATE INDEX IF NOT EXISTS kyc_directory_merchant_time_idx ON public.kyc_submissions(merchant_id,created_at DESC);