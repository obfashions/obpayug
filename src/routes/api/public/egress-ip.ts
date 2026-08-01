import { createFileRoute } from "@tanstack/react-router";

/**
 * Diagnostic: reports the outbound IP addresses this deployment uses when it
 * calls MarzPay. `direct` rotates (serverless edge runtime) — `proxy` is the
 * fixed address that must be added to MarzPay → Security → IP Whitelist.
 */
export const Route = createFileRoute("/api/public/egress-ip")({
  server: {
    handlers: {
      GET: async () => {
        const { probeEgressIp, proxyConfig } = await import("@/lib/marz.server");
        const cfg = proxyConfig();
        const [direct, proxy] = await Promise.all([
          probeEgressIp(false),
          cfg ? probeEgressIp(true) : Promise.resolve(null),
        ]);
        return Response.json(
          {
            direct_ip: direct,
            proxy_configured: !!cfg,
            proxy_ip: proxy,
            whitelist_ip: proxy || direct,
            note: cfg
              ? "Whitelist proxy_ip in MarzPay. It is stable."
              : "No static-egress relay configured; direct_ip changes between requests.",
          },
          { headers: { "cache-control": "no-store" } },
        );
      },
    },
  },
});
