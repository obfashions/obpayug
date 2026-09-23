import { createFileRoute } from "@tanstack/react-router";

/**
 * Diagnostic: reports the outbound IP address this server uses when it calls the
 * banking partner. `direct` rotates (serverless edge runtime) — `proxy` is the
 * fixed address that can be approved by the partner.
 */
export const Route = createFileRoute("/api/public/egress-ip")({
  server: {
    handlers: {
      GET: async () => {
        const { probeEgressIp, proxyConfig } = await import("@/lib/gateway.server");
        const proxy = proxyConfig();
        const [direct, viaProxy] = await Promise.all([
          probeEgressIp(false),
          proxy ? probeEgressIp(true) : Promise.resolve(null),
        ]);
        return new Response(
          JSON.stringify({
            direct_ip: direct,
            proxy_configured: !!proxy,
            proxy_ip: viaProxy,
            whitelist_ip: viaProxy || null,
            note: proxy
              ? "Ask the payment partner to approve proxy_ip. It is stable."
              : "No static-egress relay configured; direct_ip changes between requests.",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
