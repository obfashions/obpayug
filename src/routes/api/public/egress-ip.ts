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
        const { checkEgressIp } = await import("@/lib/egress-monitor.server");
        const proxy = proxyConfig();
        // Also compares against the approved address and emails the admin if it changed,
        // so pinging this URL on a schedule gives early warning of a change.
        const [state, viaProxy] = await Promise.all([
          checkEgressIp("address watch ping"),
          proxy ? probeEgressIp(true) : Promise.resolve(null),
        ]);
        return new Response(
          JSON.stringify({
            direct_ip: state.current,
            approved_ip: state.approved,
            matches_approved: state.matches,
            proxy_configured: !!proxy,
            proxy_ip: viaProxy,
            whitelist_ip: viaProxy || state.approved || state.current,
            checked_at: state.checkedAt,
            note: proxy
              ? "Ask the payment partner to approve proxy_ip. It is stable."
              : "Ask the partner to approve direct_ip; an email is sent automatically if it ever changes.",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
