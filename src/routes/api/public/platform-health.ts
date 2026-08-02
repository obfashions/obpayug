import { createFileRoute } from "@tanstack/react-router";

/**
 * Lightweight health probe: confirms the server can see the credentials it
 * needs to verify merchant sessions and reach ObPay's managed storage.
 * Returns booleans only — never any key material.
 */
export const Route = createFileRoute("/api/public/platform-health")({
  server: {
    handlers: {
      GET: async () => {
        const { legacyConfigStatus } = await import("@/lib/identity.server");
        const status = legacyConfigStatus();
        return new Response(
          JSON.stringify({
            legacyAuthUrl: status.hasUrl,
            legacyAuthKey: status.hasKey,
            managedStorage: Boolean(process.env["SUPABASE_URL"] && process.env["SUPABASE_SERVICE_ROLE_KEY"]),
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
