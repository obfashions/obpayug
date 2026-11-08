import { createClient } from "@supabase/supabase-js";
import { ToolError, type ToolContext } from "@lovable.dev/mcp-js";

function runtimeEnv(name: string): string | undefined {
  const runtime = globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> }; Deno?: { env?: { get?: (name: string) => string | undefined } } };
  return runtime.Deno?.env?.get?.(name) ?? runtime.process?.env?.[name];
}
function configuredEnv(names: string[]) {
  return names.map(runtimeEnv).find((value) => value?.trim())?.trim();
}
function supabaseProjectUrl() {
  const url = configuredEnv(["SUPABASE_URL", "VITE_SUPABASE_URL"]) ?? import.meta.env.VITE_SUPABASE_URL;
  if (!url) throw new Error("Account service URL missing");
  return url;
}
function supabasePublishableKey() {
  const direct = configuredEnv(["SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY"]);
  if (direct) return direct;
  try {
    const parsed: unknown = JSON.parse(runtimeEnv("SUPABASE_PUBLISHABLE_KEYS") ?? "null");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const keys = parsed as Record<string, unknown>;
      const key = [keys.default, ...Object.values(keys)].find((value): value is string => typeof value === "string" && value.trim().startsWith("sb_publishable_"));
      if (key) return key.trim();
    }
  } catch { /* Continue to legacy fallback. */ }
  const legacy = configuredEnv(["SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY"]) ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!legacy) throw new Error("Account service public key missing");
  return legacy;
}
export function supabaseForUser(ctx: ToolContext) {
  const token = ctx.getToken();
  if (!token || !ctx.getUserId()) throw new ToolError("Sign in to ObPay to use account tools.");
  return createClient(supabaseProjectUrl(), supabasePublishableKey(), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}