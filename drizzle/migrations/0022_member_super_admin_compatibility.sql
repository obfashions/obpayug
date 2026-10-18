CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid,_role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) OR (_role='admin' AND EXISTS(SELECT 1 FROM public.member_roles WHERE user_id=_user_id AND role='super_admin')) $$;
CREATE OR REPLACE FUNCTION public.set_member_roles(p_user_id uuid,p_roles text[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE actor uuid:=auth.uid(); BEGIN
 IF actor IS NULL OR NOT public.has_permission(actor,'roles') THEN RAISE EXCEPTION 'Not allowed to manage roles'; END IF;
 IF p_roles IS NULL OR EXISTS(SELECT 1 FROM unnest(p_roles) r WHERE r IS NULL OR r NOT IN ('super_admin','finance_admin','kyc_reviewer','support_agent')) THEN RAISE EXCEPTION 'Invalid member role'; END IF;
 IF p_user_id=actor AND NOT ('super_admin'=ANY(p_roles)) THEN RAISE EXCEPTION 'You cannot remove your own administrative access'; END IF;
 DELETE FROM public.member_roles WHERE user_id=p_user_id;
 DELETE FROM public.user_roles WHERE user_id=p_user_id AND role='admin';
 INSERT INTO public.member_roles(user_id,role) SELECT p_user_id,r FROM (SELECT DISTINCT unnest(p_roles) r) roles;
 INSERT INTO public.audit_logs(user_id,action,resource,resource_id,details) VALUES(actor,'member_roles_updated','merchant',p_user_id::text,jsonb_build_object('roles',p_roles));
 END $$;
REVOKE ALL ON FUNCTION public.set_member_roles(uuid,text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_member_roles(uuid,text[]) TO authenticated;