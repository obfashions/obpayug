import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/envprobe")({
  server: {
    handlers: {
      GET: async () =>
        new Response(
          JSON.stringify({
            procUrl: !!process.env["VITE_PUBLIC_SUPABASE_URL"],
            procAnon: !!process.env["VITE_PUBLIC_SUPABASE_ANON_KEY"],
            metaUrl: !!import.meta.env.VITE_PUBLIC_SUPABASE_URL,
            marz: !!process.env["MARZ_API_KEY"],
            ip: await fetch("https://api.ipify.org").then((r) => r.text()).catch(() => "?"),
          }),
          { headers: { "content-type": "application/json" } },
        ),
    },
  },
});
