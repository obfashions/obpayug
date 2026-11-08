import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({ authorization_id: typeof search.authorization_id === "string" ? search.authorization_id : "" }),
  head: () => ({ meta: [
    { title: "Connect an agent — ObPay" },
    { name: "description", content: "Review and approve secure agent access to your ObPay account." },
    { property: "og:title", content: "Connect an agent — ObPay" },
    { property: "og:description", content: "Review and approve secure agent access to your ObPay account." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("This connection request is missing its authorization ID. Start again from your agent.");
    const next = location.pathname + location.searchStr + (location.hash ? `#${location.hash}` : "");
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login", search: { next } });
    const [profile, settings] = await Promise.all([
      supabase.from("profiles").select("status,email_verified,login_verified_at").eq("id", data.user.id).maybeSingle(),
      supabase.from("platform_settings").select("require_login_verification").limit(1).maybeSingle(),
    ]);
    if (profile.error || settings.error || !profile.data) throw new Error("Your account could not be checked. Please try again.");
    if (!profile.data.status || !["active", "pending"].includes(profile.data.status)) throw new Error("This account is unavailable. Please sign in with an active account.");
    if (!profile.data.email_verified) throw redirect({ to: "/verify-email", search: { next } });
    if ((settings.data?.require_login_verification ?? true) && !profile.data.login_verified_at) throw redirect({ to: "/verify-login", search: { next } });
  },
  loader: async ({ location }) => {
    const id = new URLSearchParams(location.searchStr).get("authorization_id");
    if (!id) throw new Error("Missing connection request.");
    const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(id);
    if (error) throw error;
    if (data && "redirect_url" in data && data.redirect_url) throw redirect({ href: data.redirect_url });
    return data;
  },
  pendingComponent: () => <main className="min-h-screen bg-background-50 p-8 text-foreground-900">Loading connection request…</main>,
  errorComponent: ({ error }) => <main className="min-h-screen bg-background-50 p-8 text-foreground-900"><div className="mx-auto max-w-lg"><h1 className="text-2xl font-heading mb-4">Connection unavailable</h1><p role="alert">{error instanceof Error ? error.message : "This request is unavailable or expired. Start again from your agent."}</p><a href="/login" className="text-primary-600 mt-6 inline-block">Sign in to ObPay</a></div></main>,
  component: Consent,
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const { profile, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const client = details && "client" in details ? details.client : undefined;
  const clientName = client?.name || "Your agent";
  const scopes = details && "scope" in details && typeof details.scope === "string" ? details.scope.split(" ").filter(Boolean) : [];
  async function decide(approve: boolean) {
    setBusy(true); setError("");
    try {
      const result = approve ? await supabase.auth.oauth.approveAuthorization(authorization_id) : await supabase.auth.oauth.denyAuthorization(authorization_id);
      if (result.error) throw result.error;
      const target = result.data?.redirect_url;
      if (!target) throw new Error("The connection did not return a destination. Start again from your agent.");
      window.location.assign(target);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "The connection could not be updated. Please try again."); setBusy(false); }
  }
  return <main className="min-h-screen bg-background-50 text-foreground-900 px-5 py-16"><div className="mx-auto max-w-lg space-y-6">
    <p className="font-heading font-bold text-xl">ObPay</p>
    <h1 className="font-heading text-2xl font-semibold">Connect {clientName} to ObPay</h1>
    <p className="text-foreground-600">This lets {clientName} use ObPay as you.</p>
    <div className="border-y border-background-200 py-4 space-y-2"><p className="break-all">{profile?.email || "Signed-in ObPay account"}</p><p className="text-sm break-all text-foreground-600">{details && "redirect_uri" in details ? details.redirect_uri : ""}</p></div>
    <ul className="space-y-2 text-sm text-foreground-700"><li>Read your wallet balances, separately by currency.</li><li>Read your recent dashboard transactions.</li><li>No payments, withdrawals, transfers or account changes.</li>{scopes.map((scope) => <li key={scope}>{({ openid: "Confirm your identity", email: "Share your email address", profile: "Share your basic profile" } as Record<string, string>)[scope] ?? `Additional permission requested: ${scope}`}</li>)}</ul>
    <p className="text-sm text-foreground-600">This does not bypass ObPay account permissions or data protections.</p>
    {error && <p role="alert" className="text-accent-700">{error}</p>}
    <div className="flex flex-wrap gap-3"><Button disabled={busy} onClick={() => decide(true)}>Approve connection</Button><Button variant="outline" disabled={busy} onClick={() => decide(false)}>Cancel connection</Button></div>
    <Button variant="ghost" disabled={busy} onClick={async () => { setBusy(true); try { await signOut(); window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`); } catch { setError("Could not sign out. Please try again."); setBusy(false); } }}>Use another account</Button>
  </div></main>;
}