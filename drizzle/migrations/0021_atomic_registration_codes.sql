CREATE OR REPLACE FUNCTION public.claim_registration_code(p_user_id uuid,p_email text,p_hash text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE code_id uuid; BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text,1));
 IF EXISTS(SELECT 1 FROM verification_codes WHERE user_id=p_user_id AND type='registration' AND created_at>now()-interval '60 seconds') THEN RETURN NULL; END IF;
 IF (SELECT count(*) FROM verification_codes WHERE user_id=p_user_id AND type='registration' AND created_at>now()-interval '1 hour')>=5 THEN RAISE EXCEPTION 'Please wait before requesting another code'; END IF;
 UPDATE verification_codes SET used=true WHERE user_id=p_user_id AND type='registration' AND used=false;
 INSERT INTO verification_codes(user_id,email,type,code_hash,expires_at) VALUES(p_user_id,p_email,'registration',p_hash,now()+interval '10 minutes') RETURNING id INTO code_id;
 RETURN code_id; END $$;
CREATE OR REPLACE FUNCTION public.consume_registration_code(p_user_id uuid,p_hash text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE r public.verification_codes; BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text,1));
 SELECT * INTO r FROM verification_codes WHERE user_id=p_user_id AND type='registration' AND used=false ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 IF r.id IS NULL OR r.expires_at<=now() OR r.attempts>=5 THEN RETURN false; END IF;
 UPDATE verification_codes SET attempts=attempts+1,used=(code_hash=p_hash) WHERE id=r.id;
 RETURN r.code_hash=p_hash; END $$;
REVOKE ALL ON FUNCTION public.claim_registration_code(uuid,text,text),public.consume_registration_code(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_registration_code(uuid,text,text),public.consume_registration_code(uuid,text) TO service_role;