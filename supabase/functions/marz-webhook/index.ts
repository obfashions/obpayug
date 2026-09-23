// Repurposed: fixed-IP relay. Forwards partner calls through the Fixie static-IP proxy.
const ALLOWED = new Set(["api.liralinkpay.com", "api.ipify.org"]);

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  const token = Deno.env.get("EGRESS_PROXY_TOKEN") || "";
  if (!token || req.headers.get("x-relay-token") !== token) return json(401, { error: "Unauthorized" });
  const fixie = Deno.env.get("FIXIE_URL");
  if (!fixie) return json(503, { error: "FIXIE_URL not configured" });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  let job: any;
  try { job = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }
  let target: URL;
  try { target = new URL(job.url); } catch { return json(400, { error: "Invalid url" }); }
  if (target.protocol !== "https:" || !ALLOWED.has(target.hostname)) return json(403, { error: "Target not allowed" });

  const p = new URL(fixie);
  const client = Deno.createHttpClient({
    proxy: {
      url: `${p.protocol}//${p.host}`,
      basicAuth: { username: decodeURIComponent(p.username), password: decodeURIComponent(p.password) },
    },
  });
  try {
    const up = await fetch(target, {
      method: job.method || "GET",
      headers: job.headers || {},
      ...(job.body ? { body: job.body } : {}),
      client,
    } as RequestInit);
    const text = await up.text();
    return new Response(text, {
      status: up.status,
      headers: { "Content-Type": up.headers.get("content-type") || "application/json" },
    });
  } catch (e) {
    return json(502, { error: `Relay upstream error: ${(e as Error).message}` });
  } finally {
    client.close();
  }
});
