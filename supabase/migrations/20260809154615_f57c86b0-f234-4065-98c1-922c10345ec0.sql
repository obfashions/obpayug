insert into public.merchant_api_keys (merchant_id, name, environment, public_key, secret_hash, secret_prefix, secret_last4)
values ('00000000-0000-4000-8000-0000000000aa','Local test key','live','pk_live_test_local','33e72676071a45ad3103c7bfa77968f0b47812123c2f6f8f7230186ae48c0e07','sk_live_tes','_001')
on conflict do nothing;