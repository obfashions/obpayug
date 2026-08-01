// ObPay static-egress relay
// -----------------------------------------------------------------------------
// Deploy this ONE file on any host that has a fixed public IP (a $4–6/month VPS
// on Hetzner / DigitalOcean / Contabo / Vultr is plenty). Every MarzPay request
// from ObPay is then forwarded from that single IP, so MarzPay's IP whitelist
// can finally be satisfied.
//
//   1. Copy this file to the server:      scp egress-relay/relay.mjs root@SERVER:/opt/relay.mjs
//   2. Pick a long random token:          openssl rand -hex 32
//   3. Run it (keeps running after exit): 
//        RELAY_TOKEN=<token> PORT=8787 nohup node /opt/relay.mjs > /var/log/obpay-relay.log 2>&1 &
//      (or use the systemd unit in egress-relay/README.md)
//   4. Send Lovable the relay URL (https://your-domain-or-ip:8787/relay) and token.
//   5. Whitelist the server's public IP in MarzPay → Security → IP Whitelist.
//
// Requires Node 18+ (global fetch). No npm install, no dependencies.

import { createServer } from "node:http";

const PORT = Number(process.env.PORT || 8787);
const TOKEN = process.env.RELAY_TOKEN || "";
// Only these hosts may ever be reached through the relay.
const ALLOWED_HOSTS = new Set(["wallet.wearemarz.com", "api.ipify.org"]);

const server = createServer(async (req, res) => {
  const send = (status, body) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(typeof body === "string" ? body : JSON.stringify(body));
  };

  if (req.method === "GET" && req.url === "/health") return send(200, { ok: true });
  if (req.method !== "POST") return send(405, { error: "Method not allowed" });

  if (TOKEN) {
    const auth = req.headers["authorization"] || "";
    if (auth !== `Bearer ${TOKEN}`) return send(401, { error: "Unauthorized" });
  }

  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 1_000_000) return send(413, { error: "Payload too large" });
  }

  let job;
  try {
    job = JSON.parse(raw || "{}");
  } catch {
    return send(400, { error: "Invalid JSON" });
  }

  let target;
  try {
    target = new URL(job.url);
  } catch {
    return send(400, { error: "Invalid url" });
  }
  if (target.protocol !== "https:" || !ALLOWED_HOSTS.has(target.hostname)) {
    return send(403, { error: "Target not allowed" });
  }

  try {
    const upstream = await fetch(target, {
      method: job.method || "GET",
      headers: job.headers || {},
      ...(job.body ? { body: job.body } : {}),
    });
    const text = await upstream.text();
    res.writeHead(upstream.status, {
      "content-type": upstream.headers.get("content-type") || "application/json",
    });
    res.end(text);
  } catch (err) {
    send(502, { error: `Relay upstream error: ${err?.message || err}` });
  }
});

server.listen(PORT, () => console.log(`ObPay egress relay listening on :${PORT}`));
