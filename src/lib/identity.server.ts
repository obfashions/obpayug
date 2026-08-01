// Server-only identity resolution.
//
// Merchant accounts and balances still live on the original backend, so a
// caller proves who they are with that backend's access token. Everything else
// (API keys, payment links, webhooks, logs, verification files) lives in
// ObPay's own managed storage and is reached only from these server helpers.

export interface Identity {
  userId: string;
  email: string;
  isAdmin: boolean;
}

function legacyUrl(): string {
  return (
    process.env["LEGACY_SUPABASE_URL"] ||
    process.env["VITE_PUBLIC_SUPABASE_URL"] ||
    ""
  ).replace(/\/+$/, "");
}

function legacyKey(): string {
  return (
    process.env["LEGACY_SUPABASE_ANON_KEY"] ||
    process.env["VITE_PUBLIC_SUPABASE_ANON_KEY"] ||
    ""
  ).trim();
}

/** Resolves the signed-in merchant from their account access token. */
export async function resolveIdentity(accessToken: string): Promise<Identity | null> {
  const token = String(accessToken || "").trim();
  const base = legacyUrl();
  const key = legacyKey();
  if (!token || !base || !key) return null;

  try {
    const resp = await fetch(`${base}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) return null;
    const user = (await resp.json()) as { id?: string; email?: string };
    if (!user?.id) return null;

    let isAdmin = false;
    try {
      const profResp = await fetch(
        `${base}/rest/v1/profiles?id=eq.${user.id}&select=role`,
        { headers: { apikey: key, Authorization: `Bearer ${token}` } },
      );
      if (profResp.ok) {
        const rows = (await profResp.json()) as Array<{ role?: string }>;
        isAdmin = rows?.[0]?.role === "admin";
      }
    } catch {
      /* role lookup is best-effort */
    }

    return { userId: user.id, email: user.email || "", isAdmin };
  } catch {
    return null;
  }
}

export async function requireIdentity(accessToken: string): Promise<Identity> {
  const identity = await resolveIdentity(accessToken);
  if (!identity) throw new Error("Please sign in again to continue.");
  return identity;
}

export async function requireAdmin(accessToken: string): Promise<Identity> {
  const identity = await requireIdentity(accessToken);
  if (!identity.isAdmin) throw new Error("You do not have access to this area.");
  return identity;
}
