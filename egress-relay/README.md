# ObPay static-egress relay

MarzPay's `/send-money` and `/balance` endpoints only accept calls from IP
addresses on your MarzPay whitelist. ObPay runs on a serverless edge platform
whose outbound IP **changes on every request**, so no fixed set of addresses can
ever be whitelisted — that is why payouts kept failing while collections (which
are not IP-restricted) worked.

The fix is to send MarzPay traffic through one small server that owns a
permanent IP. ObPay already supports this: when `EGRESS_PROXY_URL` is set, every
MarzPay call is tunnelled through the relay automatically, with an automatic
direct fallback if the relay is ever unreachable (so collections never break).

## 1. Get a host with a fixed IP

Any of these work and cost ~$4–6/month:

| Provider     | Plan                | Fixed IP |
| ------------ | ------------------- | -------- |
| Hetzner      | CX22                | yes      |
| DigitalOcean | Basic droplet       | yes      |
| Vultr        | Regular cloud       | yes      |
| Contabo      | VPS S               | yes      |

Alternatively, any managed static-egress product (QuotaGuard Static, Fixie) can
host the same script.

## 2. Install

```bash
scp egress-relay/relay.mjs root@YOUR_SERVER:/opt/relay.mjs
ssh root@YOUR_SERVER
apt update && apt install -y nodejs   # Node 18+
openssl rand -hex 32                  # copy this token
```

`/etc/systemd/system/obpay-relay.service`:

```ini
[Unit]
Description=ObPay egress relay
After=network.target

[Service]
Environment=RELAY_TOKEN=PASTE_TOKEN_HERE
Environment=PORT=8787
ExecStart=/usr/bin/node /opt/relay.mjs
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
systemctl enable --now obpay-relay
curl http://localhost:8787/health   # {"ok":true}
```

Put it behind HTTPS (Caddy one-liner: `caddy reverse-proxy --from relay.yourdomain.com --to :8787`)
so the URL is `https://relay.yourdomain.com/`.

## 3. Connect it to ObPay

Send Lovable the relay URL and token; they are stored as the secrets
`EGRESS_PROXY_URL` and `EGRESS_PROXY_TOKEN`.

## 4. Whitelist the relay IP in MarzPay

```bash
curl https://obpay.online/api/public/egress-ip
```

Returns `proxy_ip` — add exactly that address in **MarzPay → Security → IP
Whitelist**. It never changes, so payouts stay working.

## Security

- The relay only forwards to `wallet.wearemarz.com` (and `api.ipify.org` for the
  IP diagnostic); everything else is rejected with 403.
- Requests without the bearer token are rejected with 401.
- No credentials are stored on the relay — they are passed per request by ObPay
  and never logged.
